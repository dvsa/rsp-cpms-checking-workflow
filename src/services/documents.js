import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';

export default class DocumentsService {
	constructor() {
		this.documentsHttpClient = new SignedHttpClient(appConfig.documentServiceUrl);
	}
	async getDocument(IsGroupPayment, PenaltyId) {
		const endpoint = IsGroupPayment ? 'penaltyGroup' : 'documents';
		try {
			const document = await this.documentsHttpClient.get(`${endpoint}/${PenaltyId}`);
			return document;
		} catch (err) {
			throw err;
		}
	}
}
