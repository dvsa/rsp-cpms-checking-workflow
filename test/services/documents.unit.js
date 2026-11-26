import expect from 'expect';
import sinon from 'sinon';
import DocumentsService from '../../src/services/documents';
import appConfig from '../../src/config';
import { StatusCode } from '../../src/logger';

describe('DocumentsService', () => {
	let service;
	let getStub;
	let errorLogStub;

	beforeEach(() => {
		sinon.stub(appConfig, 'documentServiceUrl').returns('http://dummy.invalid/documents/');
		service = new DocumentsService();
		getStub = sinon.stub(service.documentsHttpClient, 'get');
		errorLogStub = sinon.stub(console, 'error');
	});

	afterEach(() => sinon.restore());

	it('gets an individual penalty document', async () => {
		const document = { ID: 'DUMMY-PENALTY-001' };
		getStub.resolves({ data: document });

		expect(await service.getDocument(false, 'DUMMY-PENALTY-001')).toEqual(document);
		expect(getStub.getCall(0).args[0]).toEqual('documents/DUMMY-PENALTY-001');
	});

	it('gets a group penalty document', async () => {
		const document = { ID: 'DUMMY-GROUP-001' };
		getStub.resolves({ data: document });

		expect(await service.getDocument(true, 'DUMMY-GROUP-001')).toEqual(document);
		expect(getStub.getCall(0).args[0]).toEqual('penaltyGroup/DUMMY-GROUP-001');
	});

	it('logs a service error and rethrows the original failure', async () => {
		const failure = new Error('Dummy document failure');
		getStub.rejects(failure);

		await expect(service.getDocument(false, 'DUMMY-PENALTY-001')).rejects.toBe(failure);
		expect(errorLogStub.getCall(0).args[0]).toEqual({
			logName: {
				statusCode: StatusCode.DocumentsServiceError,
				message: failure.message,
			},
			message: undefined,
			logLevel: 'ERROR',
		});
	});
});
