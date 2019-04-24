import PaymentsService from '../services/payments';
import CpmsService from '../services/cpms';
import DocumentsService from '../services/documents';
import Utils from '../services/utils';
import { StatusCode, logInfo } from '../logger';

const paymentsService = new PaymentsService();
const cpmsService = new CpmsService();
const documentsService = new DocumentsService();

export default async (event) => {
	// Lambda SQS integration must have a batchSize of 1
	const { messageAttributes } = event.Records[0];
	const message = Utils.parseMessageAttributes(messageAttributes);
	try {
		// Check if the payment is in the payments table
		const payment = await paymentsService.getPaymentRecord(
			message.IsGroupPayment,
			message.PenaltyId,
			message.PenaltyType,
		);

		logInfo(
			StatusCode.PaymentAlreadyExists,
			`Payment already recorded in RSP database for penalty id ${message.PenaltyId}, penalty type ${message.PenaltyType}`,
		);
		// Exit and delete message off the queue
		return payment;
	} catch (getPaymentRecordError) {
		// If the payment item doesn't exist, check in cpms
		const notFoundErrors = [`Payment for type: ${message.PenaltyType} not found in item`, 'Item not found'];

		if (notFoundErrors.includes(getPaymentRecordError.message)) {
			return handlePenNotExist(message);
		}
		logInfo(
			StatusCode.PaymentServiceError,
			`Invalid response returned from payments service: ${getPaymentRecordError.message}`,
		);
		throw getPaymentRecordError;
	}
};

async function handlePenNotExist(message) {
	const { code, auth_code } = await cpmsService.confirm(message.PenaltyType, message.ReceiptReference); // eslint-disable-line

	logInfo(
		StatusCode.CpmsCodeReceived,
		`Received CPMS status code ${code} for penalty reference ${message.PenaltyId} and receipt reference ${message.ReceiptReference}`,
	);

	// If the payment was cancelled, exit and delete the message from the queue
	if (code === 807) {
		const cancelMessage = `Payment cancelled with receipt reference ${message.ReceiptReference}. Removing from SQS queue.`;
		logInfo(StatusCode.CancelledPayment, cancelMessage);
		return cancelMessage;
	}
	// If payment is confirmed by CPMS, create a record in the payments table
	if (code === 801) {
		return handlePaymentConfirmed(message, auth_code);
	}

	logInfo(StatusCode.PaymentPending, `CPMS payment unsuccessful. CPMS code: ${code}`);

	throw new Error(`CPMS payment unsuccessful, code: ${code} `);
}

async function handlePaymentConfirmed(message, authCode) {
	logInfo(StatusCode.ConfirmedPayment, 'Payment confirmed');
	const document = await documentsService.getDocument(message.IsGroupPayment, message.PenaltyId);
	const paymentRecord = Utils.buildPaymentRecord(
		message.IsGroupPayment,
		message.PenaltyType,
		document,
		{
			authCode,
			receiptReference: message.ReceiptReference,
		},
	);
	// Create the payment record and exit
	const createPaymentRecordResponse = await paymentsService.createPaymentRecord(
		message.IsGroupPayment,
		paymentRecord,
	);
	// Succeed when payment record has been created
	return createPaymentRecordResponse;
}
