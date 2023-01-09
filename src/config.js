import { SecretsManager } from '@dvsa/secrets-manager';

const configMetadata = {
	clientId: 'CLIENT_ID',
	clientSecret: 'CLIENT_SECRET',
	paymentServiceUrl: 'PAYMENT_SERVICE_URL',
	cpmsServiceUrl: 'CPMS_SERVICE_URL',
	documentServiceUrl: 'DOCUMENT_SERVICE_URL',
	region: 'REGION',
};

const configuration = {};

const configInit = async () => {
	let secrets;
	try {
		const secretManagerName = process.env.SECRETS_MANAGER_SECRET_NAME;
		const secretManager = new SecretsManager();
		secrets = await secretManager.getSecret(secretManagerName);
	} catch (err) {
		throw new Error(`An error occurred getting secrets from secret manager: ${err.message}`);
	}
	Object.values(configMetadata).forEach((secretName) => {
		if (!secrets[secretName]) {
			throw new Error(`Error getting secrets from Secret Manager. Missing '${secretName}' from secret manager`);
		}
		configuration[secretName] = secrets[secretName];
	});
};

const fromConfiguration = (configKey) => () => {
	return configuration[configKey];
};

export default {
	configInit,
	clientId: fromConfiguration(configMetadata.clientId),
	clientSecret: fromConfiguration(configMetadata.clientSecret),
	paymentServiceUrl: fromConfiguration(configMetadata.paymentServiceUrl),
	cpmsServiceUrl: fromConfiguration(configMetadata.cpmsServiceUrl),
	documentServiceUrl: fromConfiguration(configMetadata.documentServiceUrl),
	region: fromConfiguration(configMetadata.region),
};
