import SignedHttpClient from '../utils/httpClient';
import appConfig from '../config';
import { StatusCode, logError } from '../logger';

export default class DocumentsService {
	constructor() {
		this.documentsHttpClient = new SignedHttpClient(appConfig.documentServiceUrl);
	}

	async getDocument(IsGroupPayment, PenaltyId) {
		const endpoint = IsGroupPayment ? 'penaltyGroup' : 'documents';
		try {
			const response = await this.documentsHttpClient.get(`${endpoint}/${PenaltyId}`);
			return response.data;
		} catch (err) {
			logError({
				statusCode: StatusCode.DocumentsServiceError,
				message: err.message,
			});
			throw err;
		}
	}
}
