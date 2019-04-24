export const StatusCode = {
	PaymentAlreadyExists: 'PaymentAlreadyExists',
	CancelledPayment: 'CancelledPayment',
	ConfirmedPayment: 'ConfirmedPayment',
	PaymentPending: 'PaymentPending',
	PaymentServiceError: 'PaymentServiceError',
	DocumentsServiceError: 'DocumentsServiceError',
	CpmsCodeReceived: 'CpmsCodeReceived',
};

export function logInfo(statusCode, message) {
	console.log({
		logLevel: 'INFO',
		statusCode,
		message,
	});
}

export function logError(statusCode, message) {
	console.error({
		logLevel: 'ERROR',
		statusCode,
		message,
	});
}
