import expect from 'expect';
import sinon from 'sinon';

import checkForOrphanedPayments from '../../src/functions/checkForOrphanedPayments';
import PaymentsService from '../../src/services/payments';
import CpmsService from '../../src/services/cpms';
import Utils from '../../src/services/utils';
import DocumentsService from '../../src/services/documents';
import config from '../../src/config';

describe('checkForOrphanedPayments', () => {

	let event;
	let configStub;

	afterEach(() => {
		if (typeof PaymentsService.prototype.getPaymentRecord.restore === 'function') PaymentsService.prototype.getPaymentRecord.restore();
		if (typeof PaymentsService.prototype.createPaymentRecord.restore === 'function') PaymentsService.prototype.createPaymentRecord.restore();
		if (typeof Utils.parseMessageAttributes.restore === 'function') Utils.parseMessageAttributes.restore();
		if (typeof Utils.buildPaymentRecord.restore === 'function') Utils.buildPaymentRecord.restore();
		if (typeof DocumentsService.prototype.getDocument.restore === 'function') DocumentsService.prototype.getDocument.restore();
		if (typeof CpmsService.prototype.confirm.restore === 'function') CpmsService.prototype.confirm.restore();
		sinon.restore();
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
		sinon.stub(console, 'log');
		sinon.stub(console, 'debug');
		sinon.stub(console, 'error');
		configStub = sinon.stub(config, 'configInit');
	});

	describe('when a payment record has already been created', () => {
		let getPaymentRecordStub;
		beforeEach(() => {
			configStub.resolves({});
			getPaymentRecordStub = sinon.stub(PaymentsService.prototype, 'getPaymentRecord').resolves({ payment: 'payment' });
		});

		it('should exit with success', async () => {
			const res = await checkForOrphanedPayments(event);
			expect(getPaymentRecordStub.getCall(0).args).toEqual(['group', 'id', 'type']);
			expect(res).toEqual({ payment: 'payment' });
		});

	});

	describe('when a payment record has not been created and the payment was cancelled', () => {
		beforeEach(() => {
			configStub.resolves({});
			sinon.stub(PaymentsService.prototype, 'getPaymentRecord').throws(new Error('Item not found'));
			sinon.stub(CpmsService.prototype, 'confirm').resolves({
				code: 807,
				auth_code: 'auth_code',
			});
		});

		it('should exit with success saying the payment had been cancelled', async () => {

			const res = await checkForOrphanedPayments(event);
			expect(Utils.parseMessageAttributes.getCall(0).args).toEqual([{}]);
			expect(CpmsService.prototype.confirm.getCall(0).args).toEqual(['type', 'ref']);
			expect(res).toEqual('Payment cancelled with receipt reference ref. Removing from SQS queue.');

		});

	});

	describe('when a payment record has not been created and the payment failed from capita with a final status code', () => {
		beforeEach(() => {
			configStub.resolves({});
			sinon.stub(PaymentsService.prototype, 'getPaymentRecord').throws(new Error('Item not found'));
			sinon.stub(CpmsService.prototype, 'confirm').resolves({
				code: 810,
				auth_code: 'auth_code',
			});
		});

		it('should exit with success saying the payment had been cancelled', async () => {
			const res = await checkForOrphanedPayments(event);
			expect(Utils.parseMessageAttributes.getCall(0).args).toEqual([{}]);
			expect(CpmsService.prototype.confirm.getCall(0).args).toEqual(['type', 'ref']);
			expect(res).toEqual('Payment with receipt reference ref failed. CPMS returned code 810. Removing from SQS queue.');
		});

	});

	describe('when a payment record has not been created and the payment request fails', () => {
		const axiosError = {
			message: 'Status 500 was returned',
			isAxiosError: true,
			response: {
				data: {
					message: 'An Internal Server Error',
				},
			},
		};
		beforeEach(() => {
			configStub.resolves({});
			sinon.stub(PaymentsService.prototype, 'getPaymentRecord').throws(axiosError);
		});

		it('should exit with an error saying the payment was not found', async () => {
			await expect(async () => {
				await checkForOrphanedPayments(event);
			}).rejects.toThrow('An unknown error occurred: Error: Status 500 was returned. An Internal Server Error');
		});

	});

	describe('when a payment record has not been created and the payment was successful', () => {
		const doc = { doc: 'doc' };
		beforeEach(() => {
			configStub.resolves({});
			sinon.stub(PaymentsService.prototype, 'getPaymentRecord').throws(new Error('Item not found'));
			sinon.stub(CpmsService.prototype, 'confirm').resolves({
				code: 801,
				auth_code: 'auth_code',
			});
			sinon.stub(DocumentsService.prototype, 'getDocument').resolves(doc);
			sinon.stub(PaymentsService.prototype, 'createPaymentRecord').resolves({ createdDoc: 'yes' });
		});

		it('should call the correct services and exit with success', async () => {
			const res = await checkForOrphanedPayments(event);

			expect(Utils.parseMessageAttributes.getCall(0).args).toEqual([{}]);
			expect(CpmsService.prototype.confirm.getCall(0).args).toEqual(['type', 'ref']);
			expect(DocumentsService.prototype.getDocument.getCall(0).args).toEqual(['group', 'id']);
			expect(Utils.buildPaymentRecord.getCall(0).args).toEqual(['group', 'type', doc, {
				authCode: 'auth_code',
				receiptReference: 'ref',
			}]);
			expect(res).toEqual({ createdDoc: 'yes' });
		});

	});

	describe('when secret manager fails', () => {
		beforeEach(() => {
			configStub.rejects({
				message: 'An error occurred getting secrets from secret manager: The security token included in the request is invalid.',
			});
		});
		it('should throw an error', async () => {
			await expect(async () => {
				await checkForOrphanedPayments(event);
			}).rejects.toThrow('An error occurred: Error: An error occurred getting secrets from secret manager: The security token included in the request is invalid.');
		});
	});
});
