export default (messageAttributes) => {
	const {
		PenaltyId,
		ReceiptReference,
		RegistrationNumber,
		PenaltyType,
		IsGroupPayment,
	} = messageAttributes;
	return {
		PenaltyId: PenaltyId.stringValue,
		ReceiptReference: ReceiptReference.stringValue,
		RegistrationNumber: RegistrationNumber.stringValue,
		PenaltyType: PenaltyType.stringValue,
		IsGroupPayment: IsGroupPayment.stringValue === 'true',
	};
};
