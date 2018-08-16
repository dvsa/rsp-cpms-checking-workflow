import dotenv from 'dotenv';

dotenv.config();

const sqsUrl = process.env.SQS_URL;

const config = {
	sqsUrl,
};

export default config;
