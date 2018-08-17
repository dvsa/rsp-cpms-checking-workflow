import { take } from 'lodash';

import parseMessageAttributes from '../utils/parseMessageAttributes';
import PaymentsService from '../services/payments';
import CpmsService from '../services/cpms';

const paymentsService = new PaymentsService();
const cpmsService = new CpmsService();

export default async (event, context, callback) => {
	const message = take(event.Records);
	const {
		PenaltyType,
		ReceiptReference,
		PenaltyId,
		IsGroupPayment,
	} = parseMessageAttributes(message.messageAttributes);
	try {
		const item = await paymentsService.getPaymentRecord(IsGroupPayment, PenaltyId);
		console.log('item found');
		callback(null, item);
	} catch (err) {
		console.log(err);
		if (err.response.status === 404) {
			console.log('item not found');
		}
	}
};
