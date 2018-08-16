import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';
import isEmptyObject from '../utils/isEmptyObject';

const cpmsHttpClient = new SignedHttpClient(appConfig.cpmsServiceUrl);
const paymentHttpClient = new SignedHttpClient(appConfig.paymentServiceUrl);

export default (event, context, callback) => {
	const { MessageId } = event.messageData;
	const { ReceiptReference, IsGroupPayment, PaymentCode } = event.paymentData;
	// Check if payment was recorded in the appropriate payments table;
	const getPaymentPath = IsGroupPayment ? 'groupPayments' : 'payments';
	paymentHttpClient.get(`${getPaymentPath}/${PaymentCode}`)
		.then((item) => {
			if (isEmptyObject(item)) return callback(null, { paymentRecordFound: false });
			return callback(null, { paymentRecordFound: true });
		})
		.catch(err => callback(err));
};
