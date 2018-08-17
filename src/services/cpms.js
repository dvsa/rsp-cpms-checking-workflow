import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';

export default class CpmsService {
	constructor() {
		this.cpmsHttpClient = new SignedHttpClient(appConfig.cpmsServiceUrl);
	}
	async confirm(penaltyType, receiptReference) {
		try {
			const response = await this.cpmsHttpClient.post('confirm', {
				receipt_reference: receiptReference,
				penalty_type: penaltyType,
			});
			console.log('response from cpms service');
			console.log(response);
			return response.data.code;
		} catch (err) {
			console.log('err from cpms service');
			console.log(err);
			throw err;
		}
	}
}
