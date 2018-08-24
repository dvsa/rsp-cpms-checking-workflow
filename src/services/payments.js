import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';
import isEmptyObject from '../utils/isEmptyObject';

export default class PaymentsService {
	constructor() {
		this.paymentHttpClient = new SignedHttpClient(appConfig.paymentServiceUrl);
	}
	async getPaymentRecord(IsGroupPayment, PenaltyId, PenaltyType) {
		// Check if payment was recorded in the appropriate payments table;
		const getPaymentPath = IsGroupPayment ? 'groupPayments' : 'payments';
		try {
			const response = await this.paymentHttpClient.get(`${getPaymentPath}/${PenaltyId}`);
			const item = response.data;
			const itemNotFound = typeof item === 'undefined' || isEmptyObject(item);
			if (itemNotFound) throw new Error('Item not found');
			// Return payment record for a specific penalty in a penalty group
			if (IsGroupPayment) {
				const payment = item.Payments[PenaltyType];
				if (typeof payment === 'undefined') throw new Error(`Payment for type: ${PenaltyType} not found in item`);
				return payment;
			}
			return item;
		} catch (err) {
			if (err.message === 'Item not found') throw err;
			if (typeof err.response !== 'undefined' && err.response.status === 404) throw new Error('Item not found');
			throw err;
		}
	}
	async createPaymentRecord(IsGroupPayment, body) {
		const getPaymentPath = IsGroupPayment ? 'groupPayments' : 'payments';
		try {
			const { data } = await this.paymentHttpClient.post(getPaymentPath, body);
			return data;
		} catch (err) {
			throw err;
		}
	}
}
