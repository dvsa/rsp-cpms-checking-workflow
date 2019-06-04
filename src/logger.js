export const StatusCode = {
	PaymentAlreadyExists: 'PaymentAlreadyExists',
	CancelledPayment: 'CancelledPayment',
	ConfirmedPayment: 'ConfirmedPayment',
	PaymentPending: 'PaymentPending',
	PaymentServiceError: 'PaymentServiceError',
	DocumentsServiceError: 'DocumentsServiceError',
	CpmsCodeReceived: 'CpmsCodeReceived',
};

export function logInfo(logName, message) {
	console.log({
		logName,
		message,
		logLevel: 'INFO',
	});
}

export function logError(logName, message) {
	console.error({
		logName,
		message,
		logLevel: 'ERROR',
	});
}
