import expect from 'expect';
import sinon from 'sinon';
import Utils from '../../src/services/utils';

describe('Utils', () => {
	afterEach(() => sinon.restore());

	it('extracts message attributes and parses the group-payment flag', () => {
		const result = Utils.parseMessageAttributes({
			PenaltyId: { stringValue: 'DUMMY-PENALTY-001' },
			ReceiptReference: { stringValue: 'DUMMY-RECEIPT-001' },
			RegistrationNumber: { stringValue: 'DUMMY-REG' },
			PenaltyType: { stringValue: 'FPN' },
			IsGroupPayment: { stringValue: 'true' },
		});

		expect(result).toEqual({
			PenaltyId: 'DUMMY-PENALTY-001',
			ReceiptReference: 'DUMMY-RECEIPT-001',
			RegistrationNumber: 'DUMMY-REG',
			PenaltyType: 'FPN',
			IsGroupPayment: true,
		});
	});

	it('builds an individual penalty payment with a rounded Unix timestamp', () => {
		const clock = sinon.useFakeTimers(new Date('2025-01-15T00:00:00Z'));
		const result = Utils.buildPaymentRecord(false, 'FPN', {
			ID: 'DUMMY-FPN-001',
			Value: {
				paymentToken: 'DUMMY-TOKEN-001',
				referenceNo: 'DUMMY-REFERENCE-001',
				penaltyAmount: 125,
			},
		}, {
			authCode: 'DUMMY-AUTH-001',
			receiptReference: 'DUMMY-RECEIPT-001',
		});
		expect(result).toEqual({
			PaymentCode: 'DUMMY-TOKEN-001',
			PenaltyStatus: 'PAID',
			PenaltyType: 'FPN',
			PenaltyReference: 'DUMMY-REFERENCE-001',
			PaymentDetail: {
				PaymentMethod: 'CARD',
				PaymentRef: 'DUMMY-RECEIPT-001',
				AuthCode: 'DUMMY-AUTH-001',
				PaymentAmount: 125,
				PaymentDate: 1736899200,
			},
		});
	});

	it('uses the group ID prefix for immobilisation payments', () => {
		const result = Utils.buildPaymentRecord(false, 'IM', {
			ID: 'DUMMY-IM-001_SUFFIX',
			Value: {
				paymentToken: 'DUMMY-TOKEN-IM',
				referenceNo: 'DUMMY-REFERENCE-IM',
				penaltyAmount: 250,
			},
		}, {
			authCode: 'DUMMY-AUTH-IM',
			receiptReference: 'DUMMY-RECEIPT-IM',
		});

		expect(result.PenaltyReference).toEqual('DUMMY-IM-001');
	});

	it('builds a group payment with the chosen category amount and penalty references', () => {
		const clock = sinon.useFakeTimers(new Date('2025-01-15T00:00:00Z'));
		const result = Utils.buildPaymentRecord(true, 'FPN', {
			ID: 'DUMMY-GROUP-001',
			PaymentStatus: 'UNPAID',
			VehicleRegistration: 'DUMMY-REG',
			Location: 'DUMMY-LOCATION',
			Timestamp: 1736899200,
			TotalAmount: 300,
			Payments: [{
				PaymentCategory: 'FPN',
				TotalAmount: 100,
				PaymentStatus: 'UNPAID',
				Penalties: [
					{ ID: 'DUMMY-FPN-001_FPN', Value: { penaltyType: 'fpn' } },
					{ ID: 'DUMMY-FPN-002_FPN', Value: { penaltyType: 'fpn' } },
				],
			}],
		}, {
			authCode: 'DUMMY-AUTH-GROUP',
			ReceiptReference: 'DUMMY-RECEIPT-GROUP',
		});
		expect(result).toEqual({
			PaymentCode: 'DUMMY-GROUP-001',
			PenaltyType: 'FPN',
			PaymentDetail: {
				PaymentMethod: 'CARD',
				PaymentRef: 'DUMMY-RECEIPT-GROUP',
				AuthCode: 'DUMMY-AUTH-GROUP',
				PaymentAmount: 100,
				PaymentDate: 1736899200,
			},
			PenaltyIds: ['DUMMY-FPN-001_FPN', 'DUMMY-FPN-002_FPN'],
		});
	});
});
