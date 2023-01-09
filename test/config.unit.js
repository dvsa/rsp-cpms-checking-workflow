import expect from 'expect';
import sinon from 'sinon';
import { SecretsManager } from '@dvsa/secrets-manager';
import config from '../src/config';

const mockSecrets = {
	CLIENT_ID: 'client_id',
	CLIENT_SECRET: 'client_secret',
	CPMS_SERVICE_URL: 'https://url.com',
	DOCUMENT_SERVICE_URL: 'https://url.com',
	PAYMENT_SERVICE_URL: 'https://url.com',
	REGION: 'eu-west-1',
};

describe('Config', async () => {

	context('Working as expected', async () => {
		let mockSM;

		beforeEach(async () => {
			mockSM = sinon.stub(SecretsManager.prototype, 'getSecret').resolves(mockSecrets);
			await config.configInit();
		});

		afterEach(() => {
			mockSM.restore();
		});

		const options = [
			{ method: config.clientId, secret: 'CLIENT_ID' },
			{ method: config.clientSecret, secret: 'CLIENT_SECRET' },
			{ method: config.region, secret: 'REGION' },
			{ method: config.cpmsServiceUrl, secret: 'CPMS_SERVICE_URL' },
			{ method: config.documentServiceUrl, secret: 'DOCUMENT_SERVICE_URL' },
			{ method: config.paymentServiceUrl, secret: 'PAYMENT_SERVICE_URL' },
		];

		options.forEach((opt) => {
			it(`Should get the ${opt.secret} secret from secrets manager`, () => {
				expect(opt.method()).toEqual(mockSecrets[opt.secret]);
			});
		});
	});
	context('With missing secrets', async () => {
		let mockSM;

		beforeEach(() => {
			mockSM = sinon.stub(SecretsManager.prototype, 'getSecret').resolves(
				{
					CLIENT_SECRET: 'client_secret',
				},
			);
		});

		afterEach(() => {
			mockSM.restore();
		});

		it('Should throw an error', async () => {
			await expect(async () => {
				await config.configInit();
			}).rejects.toThrow('Error getting secrets from Secret Manager. Missing \'CLIENT_ID\' from secret manager');
		});
	});

	context('Not authorised to get secrets', async () => {
		let mockSM;

		beforeEach(() => {
			mockSM = sinon.stub(SecretsManager.prototype, 'getSecret').rejects({
				message: 'The security token included in the request is invalid',
			});
		});

		afterEach(() => {
			mockSM.restore();
		});

		it('Should throw an error', async () => {
			await expect(async () => {
				await config.configInit();
			}).rejects.toThrow('An error occurred getting secrets from secret manager: The security token included in the request is invalid');
		});
	});
});
