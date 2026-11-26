import expect from 'expect';
import sinon from 'sinon';
import {
	StatusCode, logInfo, logDebug, logError,
} from '../src/logger';

describe('logger', () => {
	let logStub;
	let errorStub;

	beforeEach(() => {
		logStub = sinon.stub(console, 'log');
		errorStub = sinon.stub(console, 'error');
	});

	afterEach(() => sinon.restore());

	it('exports the service status codes', () => {
		expect(StatusCode).toEqual({
			PaymentAlreadyExists: 'PaymentAlreadyExists',
			CancelledPayment: 'CancelledPayment',
			ConfirmedPayment: 'ConfirmedPayment',
			PaymentPending: 'PaymentPending',
			PaymentServiceError: 'PaymentServiceError',
			DocumentsServiceError: 'DocumentsServiceError',
			CpmsCodeReceived: 'CpmsCodeReceived',
		});
	});

	it('logs info messages with the expected structured fields', () => {
		logInfo('DummyEvent', 'Dummy information');
		expect(logStub.getCall(0).args[0]).toEqual({
			logName: 'DummyEvent',
			message: 'Dummy information',
			logLevel: 'INFO',
		});
	});

	it('logs debug messages with the expected structured fields', () => {
		logDebug('DummyEvent', 'Dummy details');
		expect(logStub.getCall(0).args[0]).toEqual({
			logName: 'DummyEvent',
			message: 'Dummy details',
			logLevel: 'DEBUG',
		});
	});

	it('logs errors with the expected structured fields', () => {
		logError('DummyEvent', 'Dummy failure');
		expect(errorStub.getCall(0).args[0]).toEqual({
			logName: 'DummyEvent',
			message: 'Dummy failure',
			logLevel: 'ERROR',
		});
	});
});
