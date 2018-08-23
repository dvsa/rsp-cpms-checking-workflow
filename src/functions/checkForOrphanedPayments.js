import parseMessageAttributes from '../utils/parseMessageAttributes';
import PaymentsService from '../services/payments';
import CpmsService from '../services/cpms';
import DocumentsService from '../services/documents';
import buildPaymentRecord from '../utils/buildPaymentRecord';

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
	} = parseMessageAttributes(messageAttributes);
	try {
		console.log('messageAttributes');
		console.log(parseMessageAttributes(messageAttributes));
		// Check if the payment is in the payments table
		const item = await paymentsService.getPaymentRecord(IsGroupPayment, PenaltyId, PenaltyType);
		// Exit and delete message off the queue
		return callback(null, item);
	} catch (getPaymentRecordError) {
		// If the item doesn't exist, check in cpms
		const notFoundErrors = [`Payment for type: ${PenaltyType} not found in item`, 'Item not found'];
		const { message } = getPaymentRecordError;
		if (notFoundErrors.includes(message) || getPaymentRecordError.response.status === 404) {
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
						const paymentRecord = buildPaymentRecord(IsGroupPayment, PenaltyType, document, {
							authCode: auth_code,
							receiptReference: ReceiptReference,
						});
						// Create the payment record and exit
						const createPaymentRecordResponse = await paymentsService.createPaymentRecord(
							IsGroupPayment,
							paymentRecord,
						);
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
