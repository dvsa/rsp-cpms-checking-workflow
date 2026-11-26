import expect from 'expect';
import sinon from 'sinon';
import buildPaymentRecord from '../../src/utils/buildPaymentRecord';

describe('buildPaymentRecord', () => {
	beforeEach(() => {
		sinon.useFakeTimers(new Date('2025-01-15T00:00:00Z'));
	});

	afterEach(() => sinon.restore());

	it('builds a paid individual penalty record', () => {
		const result = buildPaymentRecord(false, 'FPN', {
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

	it('uses the ID prefix as the reference for immobilisation records', () => {
		const result = buildPaymentRecord(false, 'IM', {
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
		expect(result.PaymentDetail.PaymentAmount).toEqual(250);
	});

	it('builds a group payment record with the selected category amount and penalty IDs', () => {
		const result = buildPaymentRecord(true, 'FPN', {
			ID: 'DUMMY-GROUP-001',
			PaymentStatus: 'UNPAID',
			VehicleRegistration: 'DUMMY-REG',
			Location: 'DUMMY-LOCATION',
			Timestamp: 1736899200,
			TotalAmount: 300,
			Payments: [
				{
					PaymentCategory: 'FPN',
					TotalAmount: 100,
					PaymentStatus: 'UNPAID',
					Penalties: [
						{ ID: 'DUMMY-FPN-001_FPN', Value: { penaltyType: 'fpn' } },
						{ ID: 'DUMMY-FPN-002_FPN', Value: { penaltyType: 'fpn' } },
					],
				},
			],
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
