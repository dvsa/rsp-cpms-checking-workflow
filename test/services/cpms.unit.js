import expect from 'expect';
import sinon from 'sinon';
import CpmsService from '../../src/services/cpms';
import appConfig from '../../src/config';

describe('CpmsService', () => {
	let service;
	let postStub;
	let configStub;

	beforeEach(() => {
		configStub = sinon.stub(appConfig, 'cpmsServiceUrl').returns('http://dummy.invalid/cpms/');
		service = new CpmsService();
		postStub = sinon.stub(service.cpmsHttpClient, 'post');
	});

	afterEach(() => sinon.restore());

	it('posts the receipt reference and penalty type to the confirm endpoint', async () => {
		postStub.resolves({ data: { code: 801, auth_code: 'DUMMY-AUTH' } });

		const response = await service.confirm('FPN', 'DUMMY-RECEIPT');

		expect(postStub.getCall(0).args).toEqual([
			'confirm',
			{ receipt_reference: 'DUMMY-RECEIPT', penalty_type: 'FPN' },
		]);
		expect(response).toEqual({ code: 801, auth_code: 'DUMMY-AUTH' });
		expect(configStub.calledOnce).toEqual(true);
	});

	it('propagates confirm request failures', async () => {
		const failure = new Error('Dummy CPMS failure');
		postStub.rejects(failure);

		await expect(service.confirm('FPN', 'DUMMY-RECEIPT')).rejects.toBe(failure);
	});
});
