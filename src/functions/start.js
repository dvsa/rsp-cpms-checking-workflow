import { StepFunctions } from 'aws-sdk';

const stepfunctions = new StepFunctions();

export default (event, context, callback) => {
	const stateMachineArn = process.env.statemachine_arn;
	const params = {
		stateMachineArn,
	};

	return stepfunctions.startExecution(params).promise().then(() => {
		callback(null, {
			message: `Your statemachine ${stateMachineArn} executed successfully`,
			data: event,
		});
	}).catch((error) => {
		callback(error.message);
	});
};
