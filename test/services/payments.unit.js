import expect from 'expect';
import sinon from 'sinon';
import PaymentsService from '../../src/services/payments';
import appConfig from '../../src/config';
import { StatusCode } from '../../src/logger';

describe('PaymentsService', () => {
	let paymentsService;
	let getStub;
	let postStub;
	let errorLogStub;

	beforeEach(() => {
		sinon.stub(appConfig, 'paymentServiceUrl').returns('http://payments.dummy.invalid/api/');
		paymentsService = new PaymentsService();
		getStub = sinon.stub(paymentsService.paymentHttpClient, 'get');
		postStub = sinon.stub(paymentsService.paymentHttpClient, 'post');
		errorLogStub = sinon.stub(console, 'error');
	});

	afterEach(() => sinon.restore());

	it('gets an individual penalty payment record', async () => {
		const record = { PaymentCode: 'DUMMY-TOKEN', PenaltyStatus: 'PAID' };
		getStub.resolves({ data: record });

		expect(await paymentsService.getPaymentRecord(false, 'DUMMY-PENALTY', 'FPN')).toEqual(record);
		expect(getStub.getCall(0).args[0]).toEqual('payments/DUMMY-PENALTY');
	});

	it('gets the requested payment from a group record', async () => {
		const record = { PaymentCode: 'DUMMY-TOKEN', PenaltyStatus: 'PAID' };
		getStub.resolves({ data: { Payments: { FPN: record } } });

		expect(await paymentsService.getPaymentRecord(true, 'DUMMY-GROUP', 'FPN')).toEqual(record);
		expect(getStub.getCall(0).args[0]).toEqual('groupPayments/DUMMY-GROUP');
	});

	it('reports a missing payment when the response is undefined', async () => {
		getStub.resolves({ data: undefined });

		await expect(paymentsService.getPaymentRecord(false, 'DUMMY-PENALTY', 'FPN'))
			.rejects.toThrow('Item not found');
	});

	it('reports a missing payment when the response is an empty object', async () => {
		getStub.resolves({ data: {} });

		await expect(paymentsService.getPaymentRecord(false, 'DUMMY-PENALTY', 'FPN'))
			.rejects.toThrow('Item not found');
	});

	it('reports a missing category when a group exists without that payment type', async () => {
		getStub.resolves({ data: { Payments: {} } });

		await expect(paymentsService.getPaymentRecord(true, 'DUMMY-GROUP', 'FPN'))
			.rejects.toThrow('Payment for type: FPN not found in item');
	});

	it('normalizes an HTTP 404 response to the missing-item error', async () => {
		getStub.rejects({
			message: 'Dummy not found response',
			response: { status: 404 },
		});

		await expect(paymentsService.getPaymentRecord(false, 'DUMMY-PENALTY', 'FPN'))
			.rejects.toThrow('Item not found');
	});

	it('propagates non-404 retrieval errors unchanged', async () => {
		const failure = new Error('Dummy payments service failure');
		getStub.rejects(failure);

		await expect(paymentsService.getPaymentRecord(false, 'DUMMY-PENALTY', 'FPN'))
			.rejects.toBe(failure);
	});

	it('creates individual payment records', async () => {
		const record = { PaymentCode: 'DUMMY-TOKEN', PenaltyStatus: 'PAID' };
		postStub.resolves({ data: { saved: true } });

		expect(await paymentsService.createPaymentRecord(false, record)).toEqual({ saved: true });
		expect(postStub.getCall(0).args).toEqual(['payments', record]);
	});

	it('creates group payment records', async () => {
		const record = { PaymentCode: 'DUMMY-GROUP', PenaltyType: 'FPN' };
		postStub.resolves({ data: { saved: true } });

		expect(await paymentsService.createPaymentRecord(true, record)).toEqual({ saved: true });
		expect(postStub.getCall(0).args).toEqual(['groupPayments', record]);
	});

	it('logs and rethrows payment creation errors', async () => {
		const failure = new Error('Dummy create failure');
		postStub.rejects(failure);

		await expect(paymentsService.createPaymentRecord(false, {})).rejects.toBe(failure);
		expect(errorLogStub.getCall(0).args[0]).toEqual({
			logName: StatusCode.PaymentServiceError,
			message: failure.message,
			logLevel: 'ERROR',
		});
	});
});
