import { SQS, config } from 'aws-sdk';

import QueueService from '../services/queueService';

import appConfig from '../config';

config.update({ region: 'eu-west-1' });
const sqs = new SQS({ apiVersion: '2012-11-05' });

const queueService = new QueueService(sqs, appConfig.sqsUrl);

export default (event, context, callback) => {
	const {
		PenaltyId,
		VehicleRegistration,
		ReceiptReference,
		IsGroupPayment,
	} = event;
	// Send a message to the CPMS checking queue
	queueService.sendMessage(
		ReceiptReference,
		PenaltyId,
		VehicleRegistration,
		IsGroupPayment,
	)
		.then(messageData => callback(null, { messageData, paymentData: event }))
		.catch(err => callback(err));
};
