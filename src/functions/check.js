import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';
import isEmptyObject from '../utils/isEmptyObject';

const paymentHttpClient = new SignedHttpClient(appConfig.paymentServiceUrl);

export default (event, context, callback) => {
	const {
		ReceiptReference,
		IsGroupPayment,
		PenaltyId,
		PenaltyType,
	} = event;
	// Check if payment was recorded in the appropriate payments table;
	const getPaymentPath = IsGroupPayment ? 'groupPayments' : 'payments';
	const penaltyTypeSuffix = IsGroupPayment ? '' : `_${PenaltyType}`;
	paymentHttpClient.get(`${getPaymentPath}/${PenaltyId}${penaltyTypeSuffix}`)
		.then((response) => {
			const item = response.data;
			if (typeof item === 'undefined' || isEmptyObject(item)) return callback(null, { paymentRecordFound: false, ...event });
			return callback(null, { paymentRecordFound: true, ...event });
		})
		.catch((err) => {
			if (err.response.status === 404) {
				return callback(null, { paymentRecordFound: false, ...event });
			}
			return callback(err);
		});
};
