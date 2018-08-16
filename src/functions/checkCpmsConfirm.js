import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';

const cpmsHttpClient = new SignedHttpClient(appConfig.cpmsServiceUrl);

export default (event, context, callback) => {
	const { ReceiptReference, PenaltyType } = event;
	console.log(event);
	cpmsHttpClient.post('confirm', {
		receipt_reference: ReceiptReference,
		penalty_type: PenaltyType,
	})
		.then(data => callback(null, data))
		.catch(err => callback(err));
};
