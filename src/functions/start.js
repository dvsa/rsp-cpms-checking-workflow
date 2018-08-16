import { SQS, config } from 'aws-sdk';

import QueueService from '../services/queueService';

config.update({ region: 'eu-west-1' });
const sqs = new SQS({ apiVersion: '2012-11-05' });

const queueService = new QueueService(sqs, process.env.SQS_URL);

export default async (event) => {
	const { PaymentCode, VehicleRegistration, ReceiptReference } = event;
	try {
		// Send a message to the CPMS checking queue
		const messageData = await queueService.sendMessage(
			ReceiptReference,
			PaymentCode,
			VehicleRegistration,
		);
		console.log('send message to queue success', messageData);
		return messageData;
	} catch (err) {
		return err;
	}
};
