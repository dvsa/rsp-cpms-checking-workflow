import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';

// const paymentHttpClient = new SignedHttpClient(appConfig.paymentServiceUrl);
const documentHttpClient = new SignedHttpClient(appConfig.documentServiceUrl);

export default (event, context, callback) => {
	const { ReceiptReference, IsGroupPayment, PenaltyId } = event; // eslint-disable-line
	// Get the penalty group / document
	const getPenaltyPath = IsGroupPayment ? 'penaltyGroup' : 'documents';
	documentHttpClient.get(`${getPenaltyPath}/${PenaltyId}`)
		.then((item) => {
			callback(null, item);
		});

};
