import { SQS, config } from 'aws-sdk';

import QueueService from '../services/queueService';

config.update({ region: 'eu-west-1' });
const sqs = new SQS({ apiVersion: '2012-11-05' });

const queueService = new QueueService(sqs, process.env.SQS_URL);

export default (event, context, callback) => {
	const {
		PaymentCode,
		VehicleRegistration,
		ReceiptReference,
		IsGroupPayment,
	} = event;
	// Send a message to the CPMS checking queue
	queueService.sendMessage(
		ReceiptReference,
		PaymentCode,
		VehicleRegistration,
		IsGroupPayment,
	)
		.then(messageData => callback(null, { messageData, paymentData: event }))
		.catch(err => callback(err));
};
