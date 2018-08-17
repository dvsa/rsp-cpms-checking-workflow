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
		try {
			const response = await this.paymentHttpClient.get(`${getPaymentPath}/${PenaltyId}`);
			const item = response.data;
			const itemNotFound = typeof item === 'undefined' || isEmptyObject(item);
			if (itemNotFound) throw new Error('Item not found');
			return item;
		} catch (err) {
			if (err.message === 'Item not found') throw err;
			if (err.response.status === 404) throw err;
			throw err;
		}
	}
	async createPaymentRecord(IsGroupPayment, body) {
		const getPaymentPath = IsGroupPayment ? 'groupPayments' : 'payments';
		try {
			const paymentRecord = await this.paymentHttpClient.post(`${getPaymentPath}`, body);
			return paymentRecord;
		} catch (err) {
			throw err;
		}
	}
}
