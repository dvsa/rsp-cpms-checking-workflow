import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';
import isEmptyObject from '../utils/isEmptyObject';
import PaymentsService from '../services/payments';

const paymentsService = new PaymentsService();

export default (event, context, callback) => {
	const {
		ReceiptReference, // eslint-disable-line
		IsGroupPayment,
		PenaltyId,
		PenaltyType,
	} = event;
	paymentsService.getPaymentRecord(IsGroupPayment, PenaltyId)
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
