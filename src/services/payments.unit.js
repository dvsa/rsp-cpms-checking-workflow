import expect from 'expect';
import sinon from 'sinon';

import PaymentsService from './payments';

describe('payments service', () => {

	let paymentsSvc;
	let mockGet;
	let mockPost;
	const mockPaymentGetResponse = {
		data: {
			Payments: { type: 'payment' },
		},
	};
	const mockPaymentRecord = {
		type: 'type',
		id: 'id',
	};
	const mockPaymentPostResponse = {
		data: 'data',
	};

	beforeEach(() => {
		paymentsSvc = new PaymentsService();
		mockGet = sinon.stub(paymentsSvc.paymentHttpClient, 'get').resolves(mockPaymentGetResponse);
		mockPost = sinon.stub(paymentsSvc.paymentHttpClient, 'post').resolves(mockPaymentPostResponse);
	});
	afterEach(() => {
		mockGet.restore();
		mockPost.restore();
	});

	describe('when getPaymentRecord is called for a group payment', () => {

		it('should should call the correct endpoint on the http client and respond correctly', (done) => {
			paymentsSvc.getPaymentRecord(true, 'id', 'type')
				.then((res) => {
					expect(mockGet.getCall(0).args[0]).toEqual('groupPayments/id');
					expect(res).toEqual('payment');
					done();
				});
		});

	});

	describe('when getPaymentRecord is called for a single penalty payment', () => {

		it('should should call the correct endpoint on the http client and respond correctly', (done) => {
			paymentsSvc.getPaymentRecord(false, 'id', 'type')
				.then((res) => {
					expect(mockGet.getCall(0).args[0]).toEqual('payments/id');
					expect(res).toEqual(mockPaymentGetResponse.data);
					done();
				});
		});

	});

	describe('when createPaymentRecord is called for a single penalty payment', () => {
		it('should should call the correct endpoint on the http client', (done) => {
			paymentsSvc.createPaymentRecord(false, mockPaymentRecord)
				.then((res) => {
					expect(mockPost.getCall(0).args[0]).toEqual('payments');
					expect(res).toEqual('data');
					done();
				});
		});

	});

	describe('when createPaymentRecord is called for a group payment', () => {
		it('should should call the correct endpoint on the http client', (done) => {
			paymentsSvc.createPaymentRecord(true, mockPaymentRecord)
				.then((res) => {
					expect(mockPost.getCall(0).args[0]).toEqual('groupPayments');
					expect(res).toEqual('data');
					done();
				});
		});

	});

});
