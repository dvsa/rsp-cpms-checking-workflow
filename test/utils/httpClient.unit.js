import expect from 'expect';
import sinon from 'sinon';
import axios from 'axios';
import aws4 from 'aws4';
import SignedHttpClient from '../../src/utils/httpClient';
import config from '../../src/config';

describe('SignedHttpClient', () => {
	let getStub;
	let postStub;
	let signStub;

	beforeEach(() => {
		sinon.stub(config, 'clientId').returns('DUMMY-CLIENT-ID');
		sinon.stub(config, 'clientSecret').returns('DUMMY-CLIENT-SECRET');
		sinon.stub(config, 'region').returns('eu-west-1');
		getStub = sinon.stub(axios, 'get').resolves({ data: { result: 'dummy' } });
		postStub = sinon.stub(axios, 'post').resolves({ data: { result: 'dummy' } });
		signStub = sinon.stub(aws4, 'sign').callsFake((options) => options);
	});

	afterEach(() => sinon.restore());

	it('signs and sends GET requests with the configured host, region, and base path', async () => {
		const client = new SignedHttpClient('https://payments.dummy.invalid/api/');
		const result = await client.get('payments/DUMMY-PENALTY-001');

		expect(result).toEqual({ data: { result: 'dummy' } });
		expect(signStub.getCall(0).args).toEqual([
			{
				path: '/api/payments/DUMMY-PENALTY-001',
				host: 'payments.dummy.invalid',
				region: 'eu-west-1',
			},
			{
				accessKeyId: 'DUMMY-CLIENT-ID',
				secretAccessKey: 'DUMMY-CLIENT-SECRET',
			},
		]);
		expect(getStub.getCall(0).args[0]).toEqual('https://payments.dummy.invalid/api/payments/DUMMY-PENALTY-001');
	});

	it('signs and sends JSON POST requests', async () => {
		const client = new SignedHttpClient('https://cpms.dummy.invalid/base/');
		const payload = { receipt_reference: 'DUMMY-RECEIPT', penalty_type: 'FPN' };
		const result = await client.post('confirm', payload);
		const signedOptions = signStub.getCall(0).args[0];

		expect(result).toEqual({ data: { result: 'dummy' } });
		expect(signedOptions).toEqual({
			body: JSON.stringify(payload),
			path: '/base/confirm',
			headers: { 'Content-Type': 'application/json' },
			host: 'cpms.dummy.invalid',
			region: 'eu-west-1',
		});
		expect(postStub.getCall(0).args).toEqual([
			'https://cpms.dummy.invalid/base/confirm',
			payload,
			signedOptions,
		]);
	});
});
