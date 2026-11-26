import expect from 'expect';
import parseMessageAttributes from '../../src/utils/parseMessageAttributes';

describe('parseMessageAttributes', () => {
	const attributes = {
		PenaltyId: { stringValue: 'DUMMY-PENALTY-001' },
		ReceiptReference: { stringValue: 'DUMMY-RECEIPT-001' },
		RegistrationNumber: { stringValue: 'DUMMY-REG' },
		PenaltyType: { stringValue: 'FPN' },
	};

	it('returns the SQS string values and parses a true group flag', () => {
		const result = parseMessageAttributes({
			...attributes,
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

	it('parses any non-true group flag as false', () => {
		const result = parseMessageAttributes({
			...attributes,
			IsGroupPayment: { stringValue: 'false' },
		});

		expect(result.IsGroupPayment).toEqual(false);
	});
});
