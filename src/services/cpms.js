import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';

export default class CpmsService {
	constructor() {
		this.cpmsHttpClient = new SignedHttpClient(appConfig.cpmsServiceUrl);
	}
	confirm(penaltyType, receiptReference) {
		this.cpmsHttpClient.post('confirm', {
			receipt_reference: receiptReference,
			penalty_type: penaltyType,
		});
	}
}
