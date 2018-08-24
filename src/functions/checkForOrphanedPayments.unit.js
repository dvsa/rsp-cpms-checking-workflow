import expect from 'expect';
import sinon from 'sinon';

import checkForOrphanedPayments from './checkForOrphanedPayments';
import PaymentsService from '../services/payments';
import CpmsService from '../services/cpms';
// import DocumentsService from '../services/documents';
import Utils from '../services/utils';

describe('checkForOrphanedPayments', () => {

	let event;

	afterEach(() => {
		PaymentsService.prototype.getPaymentRecord.restore();
		Utils.parseMessageAttributes.restore();
		Utils.buildPaymentRecord.restore();
	});

	beforeEach(() => {
		event = {
			Records: [{
				messageAttributes: {},
			}],
		};
		sinon.stub(Utils, 'parseMessageAttributes').returns({
			PenaltyType: 'type',
			ReceiptReference: 'ref',
			PenaltyId: 'id',
			IsGroupPayment: 'group',
		});
		sinon.stub(Utils, 'buildPaymentRecord');
	});

	describe('when a payment record has already been created', () => {
		let getPaymentRecordStub;
		before(() => {
			getPaymentRecordStub = sinon.stub(PaymentsService.prototype, 'getPaymentRecord').resolves({ payment: 'payment' });
		});

		it('should exit with success', (done) => {
			checkForOrphanedPayments(event, null, (err, res) => {
				expect(err).toBe(null);
				expect(Utils.parseMessageAttributes.getCall(0).args[0]).toEqual({});
				expect(getPaymentRecordStub.getCall(0).args).toEqual(['group', 'id', 'type']);
				expect(res).toEqual({ payment: 'payment' });
				done();
			});
		});

	});

	describe('when a payment record has not been created and the payment was cancelled', () => {
		before(() => {
			sinon.stub(PaymentsService.prototype, 'getPaymentRecord').throws(new Error('Item not found'));
			sinon.stub(CpmsService.prototype, 'confirm').resolves({
				code: 807,
				auth_code: 'auth_code',
			});
		});

		it('should exit with success saying the payment had been cancelled', (done) => {

			checkForOrphanedPayments(event, null, (err, res) => {
				expect(err).toBe(null);
				expect(Utils.parseMessageAttributes.getCall(0).args).toEqual([{}]);
				expect(CpmsService.prototype.confirm.getCall(0).args).toEqual(['type', 'ref']);
				expect(res).toEqual('Payment was cancelled');
				done();
			});

		});

	});

});
