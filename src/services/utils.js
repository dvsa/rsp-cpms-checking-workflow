import parsePenaltyGroup from '../utils/parsePenaltyGroup';

export default class Utils {
	static parseMessageAttributes(messageAttributes) {
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
	}
	static buildPaymentRecord(IsGroupPayment, PenaltyType, document, paymentDetails) {
		const isImmobilisation = PenaltyType === 'IM';
		const { ID } = document;
		if (IsGroupPayment) {
			const parsedPenaltyGroupDocument = parsePenaltyGroup(document);
			return Utils.buildGroupPaymentPayload(
				ID,
				paymentDetails.ReceiptReference,
				PenaltyType,
				parsedPenaltyGroupDocument,
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
			PenaltyReference: isImmobilisation ? ID.substr(0, ID.indexOf('_')) : referenceNo,
			PaymentDetail: {
				PaymentMethod: 'CARD',
				PaymentRef: paymentDetails.receiptReference,
				AuthCode: paymentDetails.authCode,
				PaymentAmount: penaltyAmount,
				PaymentDate: Math.round((new Date()).getTime() / 1000),
			},
		};
	}
	static buildGroupPaymentPayload(paymentCode, receiptReference, type, penaltyGroup, authCode) {
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
}
