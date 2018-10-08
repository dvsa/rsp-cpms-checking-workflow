const sqsUrl = process.env.SQS_URL;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const doSignedRequests = process.env.DO_SIGNED_REQUESTS === 'true';
const paymentServiceUrl = process.env.PAYMENT_SERVICE_URL;
const cpmsServiceUrl = process.env.CPMS_SERVICE_URL;
const documentServiceUrl = process.env.DOCUMENT_SERVICE_URL;

const config = {
	sqsUrl,
	clientId,
	clientSecret,
	doSignedRequests,
	paymentServiceUrl,
	cpmsServiceUrl,
	documentServiceUrl,
};

export default config;
