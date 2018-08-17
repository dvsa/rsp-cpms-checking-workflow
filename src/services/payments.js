import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';
import isEmptyObject from '../utils/isEmptyObject';

export default class PaymentsService {
	constructor() {
		this.paymentHttpClient = new SignedHttpClient(appConfig.paymentServiceUrl);
	}
	async getPaymentRecord(IsGroupPayment, PenaltyId) {
		// Check if payment was recorded in the appropriate payments table;
		const getPaymentPath = IsGroupPayment ? 'groupPayments' : 'payments';
		return new Promise((resolve, reject) => {
			try {
				const response = this.paymentHttpClient.get(`${getPaymentPath}/${PenaltyId}`);
				const { item } = response;
				const itemNotFound = typeof item === 'undefined' || isEmptyObject(item);
				if (itemNotFound) return reject(new Error('Item not found'));
				return resolve(item);
			} catch (err) {
				if (err.response.status === 404) return reject(err);
				return reject(err);
			}
		});
	}
	createPaymentRecord(IsGroupPayment) {
		const getPaymentPath = IsGroupPayment ? 'groupPayments' : 'payments';
		this.paymentHttpClient.post(`${getPaymentPath}`);
	}
}
