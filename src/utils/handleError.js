function errorMessage(error) {
	const axiosError = errorMessageFromAxiosError(error);
	if (axiosError) {
		return axiosError;
	}

	if (error.message) {
		return error.message;
	}

	return 'An unknown error occurred';
}

function errorMessageFromAxiosError(error) {
	if (error.response && error.response.data) {
		return error.response.data.message;
	}
	return '';
}

export default {
	errorMessage,
	errorMessageFromAxiosError,
};
