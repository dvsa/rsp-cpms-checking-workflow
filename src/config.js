const sqsUrl = process.env.SQS_URL;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL;
const cpmsServiceUrl = process.env.CPMS_SERVICE_URL;
const documentServiceUrl = process.env.DOCUMENT_SERVICE_URL;
const region = process.env.REGION;

const config = {
	sqsUrl,
	clientId,
	clientSecret,
	paymentServiceUrl,
	cpmsServiceUrl,
	documentServiceUrl,
	region,
};

export default config;
