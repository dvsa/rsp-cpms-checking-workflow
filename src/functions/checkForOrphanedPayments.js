import parseMessageAttributes from '../utils/parseMessageAttributes';
import PaymentsService from '../services/payments';
import CpmsService from '../services/cpms';
import DocumentsService from '../services/documents';

const paymentsService = new PaymentsService();
const cpmsService = new CpmsService();
const documentsService = new DocumentsService();

export default async (event, context, callback) => {
	const message = event.Records[0];
	const {
		PenaltyType,
		ReceiptReference,
		PenaltyId,
		IsGroupPayment,
	} = parseMessageAttributes(message.messageAttributes);
	try {
		console.log('messageAttributes');
		console.log(parseMessageAttributes(message.messageAttributes));
		// Check if the payment is in the payments table
		const item = await paymentsService.getPaymentRecord(IsGroupPayment, PenaltyId);
		// Exit and delete message off the queue
		callback(null, item);
	} catch (getPaymentRecordError) {
		// If the item doesn't exist, check in cpms
		if (getPaymentRecordError.message === 'Item not found' || getPaymentRecordError.response.status === 404) {
			try {
				const code = await cpmsService.confirm(PenaltyType, ReceiptReference);
				console.log('code from lambda');
				console.log(code);
				// If payment is confirmed by CPMS, create a record in the payments table
				if (code === 801) {
					console.log('payment successful');
					try {
						// Fetch the document from the documents service
						console.log('getting document');
						const document = await documentsService.getDocument(IsGroupPayment, PenaltyId);
						console.log(document);
						// Create the payment record and exit
						const paymentRecord = await paymentsService.createPaymentRecord(
							IsGroupPayment,
							document,
						);
						callback(null, paymentRecord);
					} catch (getDocumentOrCreatePaymentRecordError) {
						callback(getDocumentOrCreatePaymentRecordError);
					}
				}
			} catch (cpmsConfirmError) {
				console.log('cpmsConfirmError from lambda');
				console.log(cpmsConfirmError);
			}
		}
		callback(getPaymentRecordError);
	}
};