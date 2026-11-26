import expect from 'expect';
import parsePenaltyGroup from '../../src/utils/parsePenaltyGroup';

const makePenalty = (type, id, fields = {}) => ({
	PaymentCategory: type,
	TotalAmount: fields.amount || 100,
	PaymentStatus: fields.status || 'UNPAID',
	Penalties: [{
		ID: id,
		Value: {
			paymentToken: `DUMMY-TOKEN-${type}`,
			dateTime: 1736899200,
			vehicleDetails: { regNo: 'DUMMY-REG' },
			referenceNo: `DUMMY-REFERENCE-${type}`,
			penaltyAmount: 100,
			paymentStatus: fields.status || 'UNPAID',
			paymentDate: fields.paymentDate,
			paymentAuthCode: 'DUMMY-AUTH',
			paymentRef: 'DUMMY-RECEIPT',
			penaltyType: type.toLowerCase(),
			placeWhereIssued: 'DUMMY-LOCATION',
		},
	}],
});

const makeGroup = (payments) => ({
	Payments: payments,
	ID: 'DUMMY-GROUP-001',
	PaymentStatus: 'UNPAID',
	VehicleRegistration: 'DUMMY-REG',
	Location: 'DUMMY-LOCATION',
	Timestamp: 1736899200,
	TotalAmount: 300,
});

describe('parsePenaltyGroup', () => {
	it('normalizes group metadata and prefers unpaid immobilisation payments', () => {
		const result = parsePenaltyGroup(makeGroup([
			makePenalty('CDN', 'DUMMY-CDN-001_CDN'),
			makePenalty('FPN', 'DUMMY-FPN-001_FPN'),
			makePenalty('IM', 'DUMMY-IM-001_IM'),
		]));

		expect(result).toEqual({
			isPenaltyGroup: true,
			penaltyGroupDetails: {
				registrationNumber: 'DUMMY-REG',
				location: 'DUMMY-LOCATION',
				date: '15/01/2025',
				amount: 300,
				splitAmounts: [
					{ type: 'CDN', amount: 100, status: 'UNPAID' },
					{ type: 'FPN', amount: 100, status: 'UNPAID' },
					{ type: 'IM', amount: 100, status: 'UNPAID' },
				],
			},
			paymentCode: 'DUMMY-GROUP-001',
			penaltyDetails: [
				{
					type: 'CDN',
					penalties: [{
						complete: true,
						reference: 'DUMMY-CDN-001',
						paymentCode: 'DUMMY-TOKEN-CDN',
						issueDate: '15/01/2025',
						vehicleReg: 'DUMMY-REG',
						formattedReference: 'DUMMY-REFERENCE-CDN',
						location: 'DUMMY-LOCATION',
						amount: 100,
						status: 'UNPAID',
						type: 'cdn',
						typeDescription: 'Court Deposit Notice',
						paymentDate: undefined,
						paymentAuthCode: 'DUMMY-AUTH',
						paymentRef: 'DUMMY-RECEIPT',
					}],
				},
				{
					type: 'FPN',
					penalties: [{
						complete: true,
						reference: 'DUMMY-FPN-001',
						paymentCode: 'DUMMY-TOKEN-FPN',
						issueDate: '15/01/2025',
						vehicleReg: 'DUMMY-REG',
						formattedReference: 'DUMMY-REFERENCE-FPN',
						location: 'DUMMY-LOCATION',
						amount: 100,
						status: 'UNPAID',
						type: 'fpn',
						typeDescription: 'Fixed Penalty Notice',
						paymentDate: undefined,
						paymentAuthCode: 'DUMMY-AUTH',
						paymentRef: 'DUMMY-RECEIPT',
					}],
				},
				{
					type: 'IM',
					penalties: [{
						complete: true,
						reference: 'DUMMY-IM-001',
						paymentCode: 'DUMMY-TOKEN-IM',
						issueDate: '15/01/2025',
						vehicleReg: 'DUMMY-REG',
						formattedReference: 'DUMMY-REFERENCE-IM',
						location: 'DUMMY-LOCATION',
						amount: 100,
						status: 'UNPAID',
						type: 'im',
						typeDescription: 'immobilisation',
						paymentDate: undefined,
						paymentAuthCode: 'DUMMY-AUTH',
						paymentRef: 'DUMMY-RECEIPT',
					}],
				},
			],
			paymentStatus: 'UNPAID',
			nextPayment: {
				PaymentCategory: 'IM',
				TotalAmount: 100,
				PaymentStatus: 'UNPAID',
				Penalties: [
					{
						ID: 'DUMMY-IM-001_IM',
						Value: {
							paymentToken: 'DUMMY-TOKEN-IM',
							dateTime: 1736899200,
							vehicleDetails: { regNo: 'DUMMY-REG' },
							referenceNo: 'DUMMY-REFERENCE-IM',
							penaltyAmount: 100,
							paymentStatus: 'UNPAID',
							paymentDate: undefined,
							paymentAuthCode: 'DUMMY-AUTH',
							paymentRef: 'DUMMY-RECEIPT',
							penaltyType: 'im',
							placeWhereIssued: 'DUMMY-LOCATION',
						},
					},
				],
			},
		});
	});

	it('uses FPN before CDN when no unpaid IM exists', () => {
		const group = parsePenaltyGroup(makeGroup([
			makePenalty('CDN', 'DUMMY-CDN-001_CDN'),
			makePenalty('FPN', 'DUMMY-FPN-001_FPN'),
			makePenalty('IM', 'DUMMY-IM-001_IM', { status: 'PAID' }),
		]));

		expect(group.nextPayment.PaymentCategory).toEqual('FPN');
	});

	it('uses CDN when it is the only unpaid payment and leaves nextPayment undefined when all are paid', () => {
		const cdnGroup = parsePenaltyGroup(makeGroup([
			makePenalty('CDN', 'DUMMY-CDN-001_CDN'),
			makePenalty('FPN', 'DUMMY-FPN-001_FPN', { status: 'PAID' }),
		]));
		const paidGroup = parsePenaltyGroup(makeGroup([
			makePenalty('CDN', 'DUMMY-CDN-001_CDN', { status: 'PAID' }),
			makePenalty('FPN', 'DUMMY-FPN-001_FPN', { status: 'PAID' }),
		]));

		expect(cdnGroup.nextPayment.PaymentCategory).toEqual('CDN');
		expect(paidGroup.nextPayment).toEqual(undefined);
	});

	it('marks incomplete and empty penalty values and labels unknown types', () => {
		const group = makeGroup([{
			PaymentCategory: 'OTHER',
			TotalAmount: 50,
			PaymentStatus: 'PAID',
			Penalties: [
				{ ID: 'DUMMY-OTHER-001_OTHER', Value: { penaltyType: 'other', penaltyAmount: 50 } },
				{ ID: 'DUMMY-OTHER-002_OTHER', Value: { penaltyType: 'other' } },
			],
		}]);
		const result = parsePenaltyGroup(group);

		expect(result.nextPayment).toEqual(undefined);
		expect(result.penaltyDetails[0].penalties[0]).toMatchObject({
			complete: false,
			reference: 'DUMMY-OTHER-001',
			typeDescription: 'Unknown',
			issueDate: false,
			vehicleReg: false,
			location: false,
			amount: 50,
		});
		expect(result.penaltyDetails[0].penalties[1]).toMatchObject({
			complete: false,
			reference: 'DUMMY-OTHER-002',
			typeDescription: 'Unknown',
			issueDate: false,
		});
	});

	it('retains the current failure when a penalty type is missing', () => {
		const group = makeGroup([{
			PaymentCategory: 'OTHER',
			TotalAmount: 50,
			PaymentStatus: 'PAID',
			Penalties: [{ ID: 'DUMMY-OTHER-003_OTHER', Value: {} }],
		}]);

		expect(() => parsePenaltyGroup(group)).toThrow(TypeError);
	});

	it('formats a payment date when the source includes one', () => {
		const result = parsePenaltyGroup(makeGroup([
			makePenalty('FPN', 'DUMMY-FPN-001_FPN', { paymentDate: 1736899200 }),
		]));

		expect(result.penaltyDetails[0].penalties[0].paymentDate).toEqual('15/01/2025');
	});
});
