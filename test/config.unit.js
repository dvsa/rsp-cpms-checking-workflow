import expect from 'expect';
import sinon from 'sinon';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import config from '../src/config';

const mockSecrets = {
	CLIENT_ID: 'dummy-client-id',
	CLIENT_SECRET: 'dummy-client-secret',
	CPMS_SERVICE_URL: 'https://cpms.dummy.invalid/',
	DOCUMENT_SERVICE_URL: 'https://documents.dummy.invalid/',
	PAYMENT_SERVICE_URL: 'https://payments.dummy.invalid/',
	REGION: 'eu-west-1',
};

describe('Config', () => {
	let sendStub;
	let originalSecretName;
	let originalEnvironment;
	let secretNumber = 0;

	beforeEach(() => {
		originalEnvironment = {};
		['USE_SECRETS_MANAGER', ...Object.keys(mockSecrets)].forEach((key) => {
			originalEnvironment[key] = process.env[key];
			delete process.env[key];
		});
		originalSecretName = process.env.SECRETS_MANAGER_SECRET_NAME;
		secretNumber += 1;
		process.env.SECRETS_MANAGER_SECRET_NAME = `dummy-config-secret-${secretNumber}`;
		sendStub = sinon.stub(SecretsManagerClient.prototype, 'send')
			.resolves({ SecretString: JSON.stringify(mockSecrets) });
	});

	afterEach(() => {
		sinon.restore();
		Object.entries(originalEnvironment).forEach(([key, value]) => {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		});
		if (originalSecretName === undefined) {
			delete process.env.SECRETS_MANAGER_SECRET_NAME;
		} else {
			process.env.SECRETS_MANAGER_SECRET_NAME = originalSecretName;
		}
	});

	it('requests the configured secret with the v3 command and exposes its settings', async () => {
		await config.configInit();

		const command = sendStub.firstCall.args[0];
		expect(command).toBeInstanceOf(GetSecretValueCommand);
		expect(command.input).toEqual({ SecretId: process.env.SECRETS_MANAGER_SECRET_NAME });
		expect(config.clientId()).toEqual(mockSecrets.CLIENT_ID);
		expect(config.clientSecret()).toEqual(mockSecrets.CLIENT_SECRET);
		expect(config.region()).toEqual(mockSecrets.REGION);
		expect(config.cpmsServiceUrl()).toEqual(mockSecrets.CPMS_SERVICE_URL);
		expect(config.documentServiceUrl()).toEqual(mockSecrets.DOCUMENT_SERVICE_URL);
		expect(config.paymentServiceUrl()).toEqual(mockSecrets.PAYMENT_SERVICE_URL);
	});

	it('reuses a successfully fetched secret across invocations', async () => {
		await config.configInit();
		await config.configInit();

		expect(sendStub.calledOnce).toEqual(true);
		expect(config.clientId()).toEqual(mockSecrets.CLIENT_ID);
	});

	it('uses Secrets Manager when explicitly enabled even if local values exist', async () => {
		Object.assign(process.env, mockSecrets, {
			USE_SECRETS_MANAGER: 'true',
			CLIENT_ID: 'dummy-local-override',
		});

		await config.configInit();

		expect(sendStub.calledOnce).toEqual(true);
		expect(config.clientId()).toEqual(mockSecrets.CLIENT_ID);
	});

	it('uses local settings without making an AWS call when explicitly disabled', async () => {
		Object.assign(process.env, mockSecrets, { USE_SECRETS_MANAGER: 'false' });
		delete process.env.SECRETS_MANAGER_SECRET_NAME;
		sendStub.rejects(new Error('Unexpected AWS request'));

		await config.configInit();

		expect(sendStub.notCalled).toEqual(true);
		expect(config.clientId()).toEqual(mockSecrets.CLIENT_ID);
		expect(config.clientSecret()).toEqual(mockSecrets.CLIENT_SECRET);
		expect(config.region()).toEqual(mockSecrets.REGION);
		expect(config.cpmsServiceUrl()).toEqual(mockSecrets.CPMS_SERVICE_URL);
		expect(config.documentServiceUrl()).toEqual(mockSecrets.DOCUMENT_SERVICE_URL);
		expect(config.paymentServiceUrl()).toEqual(mockSecrets.PAYMENT_SERVICE_URL);
	});

	it('rejects missing local settings instead of reusing previously loaded configuration', async () => {
		await config.configInit();
		Object.assign(process.env, mockSecrets, { USE_SECRETS_MANAGER: 'false' });
		delete process.env.CLIENT_ID;

		await expect(config.configInit()).rejects.toThrow("Missing 'CLIENT_ID' from environment variables");
		expect(sendStub.calledOnce).toEqual(true);
	});

	it('rejects missing configuration fields', async () => {
		sendStub.resolves({ SecretString: JSON.stringify({ CLIENT_SECRET: 'dummy-secret' }) });

		await expect(config.configInit()).rejects.toThrow(
			'Error getting secrets from Secret Manager. Missing \'CLIENT_ID\' from secret manager',
		);
	});

	it('preserves the missing-secret error message', async () => {
		const error = new Error('SDK resource not found');
		error.name = 'ResourceNotFoundException';
		sendStub.rejects(error);

		await expect(config.configInit()).rejects.toThrow(
			`An error occurred getting secrets from secret manager: Secret with name ${process.env.SECRETS_MANAGER_SECRET_NAME} does not exist.`,
		);
	});

	it('wraps authentication failures and allows retrying the same secret', async () => {
		sendStub.onFirstCall().rejects(new Error('Dummy authentication failure'));

		await expect(config.configInit()).rejects.toThrow(
			'An error occurred getting secrets from secret manager: Dummy authentication failure',
		);
		await config.configInit();
		expect(sendStub.calledTwice).toEqual(true);
	});

	it('rejects malformed secret JSON', async () => {
		sendStub.resolves({ SecretString: 'not-json' });

		await expect(config.configInit()).rejects.toThrow(
			'An error occurred getting secrets from secret manager:',
		);
	});
});
