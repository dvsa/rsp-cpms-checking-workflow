import PaymentsService from '../services/payments';
import CpmsService from '../services/cpms';
import DocumentsService from '../services/documents';
import Utils from '../services/utils';

const paymentsService = new PaymentsService();
const cpmsService = new CpmsService();
const documentsService = new DocumentsService();

export default async (event, context, callback) => {
	// Lambda SQS integration must have a batchSize of 1
	const { messageAttributes } = event.Records[0];
	const {
		PenaltyType,
		ReceiptReference,
		PenaltyId,
		IsGroupPayment,
	} = Utils.parseMessageAttributes(messageAttributes);
	try {
		console.log('messageAttributes');
		console.log(Utils.parseMessageAttributes(messageAttributes));
		// Check if the payment is in the payments table
		const payment = await paymentsService.getPaymentRecord(IsGroupPayment, PenaltyId, PenaltyType);
		// Exit and delete message off the queue
		return callback(null, payment);
	} catch (getPaymentRecordError) {
		// If the payment item doesn't exist, check in cpms
		const notFoundErrors = [`Payment for type: ${PenaltyType} not found in item`, 'Item not found'];
		const { message } = getPaymentRecordError;
		if (notFoundErrors.includes(message)) {
			try {
				const { code, auth_code } = await cpmsService.confirm(PenaltyType, ReceiptReference); // eslint-disable-line
				console.log('code from lambda');
				console.log(code);
				// If the payment was cancelled, exit and delete the message from the queue
				if (code === 807) return callback(null, 'Payment was cancelled');
				// If payment is confirmed by CPMS, create a record in the payments table
				if (code === 801) {
					try {
						// Fetch the document from the documents service
						const document = await documentsService.getDocument(IsGroupPayment, PenaltyId);
						const paymentRecord = Utils.buildPaymentRecord(IsGroupPayment, PenaltyType, document, {
							authCode: auth_code,
							receiptReference: ReceiptReference,
						});
						// Create the payment record and exit
						const createPaymentRecordResponse = await paymentsService.createPaymentRecord(
							IsGroupPayment,
							paymentRecord,
						);
						console.log('payment record created, calling back with success');
						// Succeed when payment record has been created
						return callback(null, createPaymentRecordResponse);
					} catch (getDocumentOrCreatePaymentRecordError) {
						return callback(getDocumentOrCreatePaymentRecordError);
					}
				}
				return callback(new Error(`CPMS payment unsuccessful, code: ${code} `));
			} catch (cpmsConfirmError) {
				return callback(cpmsConfirmError);
			}
		}
		return callback(getPaymentRecordError);
	}
};
