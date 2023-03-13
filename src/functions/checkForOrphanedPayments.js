import PaymentsService from '../services/payments';
import CpmsService from '../services/cpms';
import DocumentsService from '../services/documents';
import Utils from '../services/utils';
import {
	StatusCode, logInfo, logError,
} from '../logger';
import config from '../config';
import handleError from '../utils/handleError';

let paymentsService;
let cpmsService;
let documentsService;

export const handler = async (event) => {
	try {
		await config.configInit();
		paymentsService = new PaymentsService();
		cpmsService = new CpmsService();
		documentsService = new DocumentsService();
	} catch (err) {
		const msg = `Error: ${err.message}. ${handleError.errorMessageFromAxiosError(err)}`;
		logError('SecretsManagerError', msg);
		throw new Error(`An error occurred: ${msg}`);
	}
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

		const msg = `Error: ${getPaymentRecordError.message}. ${handleError.errorMessageFromAxiosError(getPaymentRecordError)}`;
		logError(StatusCode.PaymentServiceError, msg);

		throw new Error(`An unknown error occurred: ${msg}`);
	}
};

async function handlePenNotExist(message) {
	try {
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

		// If the payment failed, exit and delete the message from the queue
		if (code === 810) {
			const cancelMessage = `Payment with receipt reference ${message.ReceiptReference} failed. CPMS returned code ${code}. Removing from SQS queue.`;
			logInfo(StatusCode.CpmsCodeReceived, cancelMessage);
			return cancelMessage;
		}

		// If payment is confirmed by CPMS, create a record in the payments table
		if (code === 801) {
			return handlePaymentConfirmed(message, auth_code);
		}

		if (code === 830) {
			logInfo(StatusCode.PaymentPending, `CPMS payment unsuccessful. CPMS code: ${code}. Payment is actively being taken on the 3rd party's payment page. Will return message to the queue for retry`);
			throw new Error(`CPMS payment pending, code: ${code}. Will retry.`);
		}

		logInfo(StatusCode.PaymentPending, `CPMS payment unsuccessful. CPMS code: ${code}`);

		throw new Error(`CPMS payment unsuccessful, code: ${code} `);
	} catch (err) {
		const errorMessage = handleError.errorMessage(err);
		logError('handlePenaltyNotExistError', { errorMessage });
		throw new Error(`An unknown error occurred attempting to check payment with CPMS: ${errorMessage}`);
	}
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

export default handler;
