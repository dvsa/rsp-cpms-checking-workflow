import expect from 'expect';
import sinon from 'sinon';
import checkForOrphanedPayments from '../../src/functions/checkForOrphanedPayments';
import PaymentsService from '../../src/services/payments';
import CpmsService from '../../src/services/cpms';
import DocumentsService from '../../src/services/documents';
import Utils from '../../src/services/utils';
import config from '../../src/config';

describe('checkForOrphanedPayments error and retry branches', () => {
	const event = { Records: [{ messageAttributes: {} }] };
	const message = {
		PenaltyId: 'DUMMY-PENALTY-001',
		ReceiptReference: 'DUMMY-RECEIPT-001',
		PenaltyType: 'FPN',
		IsGroupPayment: false,
	};

	beforeEach(() => {
		sinon.stub(config, 'configInit').resolves();
		sinon.stub(Utils, 'parseMessageAttributes').returns(message);
		sinon.stub(Utils, 'buildPaymentRecord').returns({ PaymentCode: 'DUMMY-TOKEN' });
		sinon.stub(console, 'log');
		sinon.stub(console, 'error');
	});

	afterEach(() => sinon.restore());

	it('treats a group category missing from the payment record as not found', async () => {
		sinon.stub(PaymentsService.prototype, 'getPaymentRecord')
			.rejects(new Error('Payment for type: FPN not found in item'));
		sinon.stub(CpmsService.prototype, 'confirm').resolves({ code: 807 });

		const result = await checkForOrphanedPayments(event);

		expect(result).toEqual('Payment cancelled with receipt reference DUMMY-RECEIPT-001. Removing from SQS queue.');
	});

	it('wraps errors from the CPMS confirmation call', async () => {
		sinon.stub(PaymentsService.prototype, 'getPaymentRecord').rejects(new Error('Item not found'));
		sinon.stub(CpmsService.prototype, 'confirm').rejects(new Error('Dummy CPMS failure'));

		await expect(checkForOrphanedPayments(event)).rejects.toThrow(
			'An unknown error occurred attempting to check payment with CPMS: Dummy CPMS failure',
		);
	});

	it('returns a retry error while CPMS reports a pending payment', async () => {
		sinon.stub(PaymentsService.prototype, 'getPaymentRecord').rejects(new Error('Item not found'));
		sinon.stub(CpmsService.prototype, 'confirm').resolves({ code: 830 });

		await expect(checkForOrphanedPayments(event)).rejects.toThrow(
			'An unknown error occurred attempting to check payment with CPMS: CPMS payment pending, code: 830. Will retry.',
		);
	});

	it('returns an error for an unrecognized CPMS status', async () => {
		sinon.stub(PaymentsService.prototype, 'getPaymentRecord').rejects(new Error('Item not found'));
		sinon.stub(CpmsService.prototype, 'confirm').resolves({ code: 999 });

		await expect(checkForOrphanedPayments(event)).rejects.toThrow(
			'An unknown error occurred attempting to check payment with CPMS: CPMS payment unsuccessful, code: 999 ',
		);
	});

	it('propagates document service failures after CPMS confirms payment', async () => {
		sinon.stub(PaymentsService.prototype, 'getPaymentRecord').rejects(new Error('Item not found'));
		sinon.stub(CpmsService.prototype, 'confirm').resolves({ code: 801, auth_code: 'DUMMY-AUTH' });
		sinon.stub(DocumentsService.prototype, 'getDocument').rejects(new Error('Dummy document failure'));

		await expect(checkForOrphanedPayments(event)).rejects.toThrow(
			'Dummy document failure',
		);
	});

	it('propagates payment persistence failures after CPMS confirms payment', async () => {
		sinon.stub(PaymentsService.prototype, 'getPaymentRecord').rejects(new Error('Item not found'));
		sinon.stub(CpmsService.prototype, 'confirm').resolves({ code: 801, auth_code: 'DUMMY-AUTH' });
		sinon.stub(DocumentsService.prototype, 'getDocument').resolves({ ID: 'DUMMY-PENALTY-001' });
		sinon.stub(PaymentsService.prototype, 'createPaymentRecord').rejects(new Error('Dummy save failure'));

		await expect(checkForOrphanedPayments(event)).rejects.toThrow(
			'Dummy save failure',
		);
	});
});
