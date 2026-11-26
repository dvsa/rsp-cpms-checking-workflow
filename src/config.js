import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { logError, logInfo } from './logger';

const configMetadata = {
	clientId: 'CLIENT_ID',
	clientSecret: 'CLIENT_SECRET',
	paymentServiceUrl: 'PAYMENT_SERVICE_URL',
	cpmsServiceUrl: 'CPMS_SERVICE_URL',
	documentServiceUrl: 'DOCUMENT_SERVICE_URL',
	region: 'REGION',
};

let configuration = {};

const configInit = async () => {
	if (process.env.USE_SECRETS_MANAGER === 'true') {
		const SecretId = process.env.SECRETS_MANAGER_SECRET_NAME;
		logInfo('CheckingWorkflowSecretsManagerSecretId', { secretId: SecretId });
		const secretsManagerClient = new SecretsManagerClient({ region: process.env.REGION });
		try {
			const response = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId }));
			configuration = JSON.parse(response.SecretString);
		} catch (error) {
			logError('CheckingWorkflowSecretsManagerError', error.message);
			throw error;
		}
		return configuration;
	}
	logInfo('CheckingWorkflowServiceEnvVars', 'Using envvars for config');
	configuration = Object.values(configMetadata)
		.reduce((config, envkey) => ({ [envkey]: process.env[envkey], ...config }), configuration);
	return configuration;
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
