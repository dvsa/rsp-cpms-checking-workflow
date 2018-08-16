import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';
import isEmptyObject from '../utils/isEmptyObject';

const paymentHttpClient = new SignedHttpClient(appConfig.paymentServiceUrl);
const documentHttpClient = new SignedHttpClient(appConfig.documentServiceUrl);

export default (event, context, callback) => {
	const { ReceiptReference, IsGroupPayment, PenaltyId } = event;
	// Get the penalty group / document
	const getPenaltyPath = IsGroupPayment ? 'penaltyGroup' : 'documents';
	documentHttpClient.get(`${getPenaltyPath}/${PenaltyId}`)
		.then((item) => {
			callback(null, item);
		});

};
