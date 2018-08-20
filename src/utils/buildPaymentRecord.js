export default (IsGroupPayment, PenaltyType, document, paymentDetails) => {
	if (IsGroupPayment) {
		const { ID } = document;
		return buildGroupPaymentPayload(
			ID,
			paymentDetails.ReceiptReference,
			PenaltyType,
			document,
			paymentDetails.authCode,
		);
	}
	const {
		paymentToken,
		referenceNo,
		penaltyAmount,
	} = document.Value;
	return {
		PaymentCode: paymentToken,
		PenaltyStatus: 'PAID',
		PenaltyType,
		PenaltyReference: referenceNo,
		PaymentDetail: {
			PaymentMethod: 'CARD',
			PaymentRef: paymentDetails.receiptReference,
			AuthCode: paymentDetails.authCode,
			PaymentAmount: penaltyAmount,
			PaymentDate: Math.round((new Date()).getTime() / 1000),
		},
	};
};

function buildGroupPaymentPayload(paymentCode, receiptReference, type, penaltyGroup, authCode) {
	const amountForType = penaltyGroup.penaltyGroupDetails.splitAmounts
		.find(a => a.type === type).amount;
	return {
		PaymentCode: paymentCode,
		PenaltyType: type,
		PaymentDetail: {
			PaymentMethod: 'CARD',
			PaymentRef: receiptReference,
			AuthCode: authCode,
			PaymentAmount: amountForType,
			PaymentDate: Math.floor(Date.now() / 1000),
		},
		PenaltyIds: penaltyGroup.penaltyDetails
			.find(penaltiesOfType => penaltiesOfType.type === type).penalties
			.map(penalties => `${penalties.reference}_${type}`),
	};
}
