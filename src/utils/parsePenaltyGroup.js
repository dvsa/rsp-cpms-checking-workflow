import { isEmpty, has, uniq, find } from 'lodash';
import { unix } from 'moment';

export default (penaltyGroup) => {
	const {
		Payments,
		ID,
		PaymentStatus,
		VehicleRegistration,
		Location,
		Timestamp,
		TotalAmount,
	} = penaltyGroup;
	const {
		splitAmounts,
		parsedPenalties,
		nextPayment,
	} = parsePayments(Payments);
	return {
		isPenaltyGroup: true,
		penaltyGroupDetails: {
			registrationNumber: VehicleRegistration,
			location: Location,
			date: unix(Timestamp).format('DD/MM/YYYY'),
			amount: TotalAmount,
			splitAmounts,
		},
		paymentCode: ID,
		penaltyDetails: parsedPenalties,
		paymentStatus: PaymentStatus,
		nextPayment,
	};
};

function parsePayments(paymentsArr) {
	const splitAmounts = paymentsArr.map((payment) => { // eslint-disable-line arrow-body-style
		return {
			type: payment.PaymentCategory,
			amount: payment.TotalAmount,
			status: payment.PaymentStatus,
		};
	});
	const types = uniq(paymentsArr.map(payment => payment.PaymentCategory));
	const parsedPenalties = types.map((type) => {
		const penalties = paymentsArr.filter(p => p.PaymentCategory === type)[0].Penalties;
		return {
			type,
			penalties: penalties.map(p => parsePenalty(p)),
		};
	});
	const unpaidPayments = paymentsArr.filter(payment => payment.PaymentStatus === 'UNPAID');
	const nextPayment = getNextPayment(unpaidPayments);
	return { splitAmounts, parsedPenalties, nextPayment };
}

function getNextPayment(unpaidPayments) {
	const FPNPayment = find(unpaidPayments, ['PaymentCategory', 'FPN']);
	const CDNPayment = find(unpaidPayments, ['PaymentCategory', 'CDN']);
	const IMPayment = find(unpaidPayments, ['PaymentCategory', 'IM']);
	return IMPayment || FPNPayment || CDNPayment;
}

function parsePenalty(data) {
	const penaltyId = data.ID;
	const reference = penaltyId.split('_').shift();
	const rawPenalty = data.Value;
	const complete = has(rawPenalty, 'vehicleDetails') && !isEmpty(rawPenalty);
	const penaltyDetails = {
		complete,
		reference,
		paymentCode: rawPenalty.paymentToken,
		issueDate: complete && unix(rawPenalty.dateTime).format('DD/MM/YYYY'),
		vehicleReg: complete && rawPenalty.vehicleDetails.regNo,
		formattedReference: rawPenalty.referenceNo,
		location: complete && rawPenalty.placeWhereIssued,
		amount: rawPenalty.penaltyAmount,
		status: rawPenalty.paymentStatus,
		type: rawPenalty.penaltyType,
		typeDescription: getPenaltyTypeDescription(rawPenalty.penaltyType),
		paymentDate: rawPenalty.paymentDate ? unix(rawPenalty.paymentDate).format('DD/MM/YYYY') : undefined,
		paymentAuthCode: rawPenalty.paymentAuthCode,
		paymentRef: rawPenalty.paymentRef,
	};
	return penaltyDetails;
}

function getPenaltyTypeDescription(penaltyType) {
	switch (penaltyType.toUpperCase()) {
	case 'CDN':
		return 'Court Deposit Notice';
	case 'FPN':
		return 'Fixed Penalty Notice';
	case 'IM':
		return 'immobilisation';
	default:
		return 'Unknown';
	}
}

