export default function errorMessageFromAxiosError(error) {
	if (error.response && error.response.data) {
		return error.response.data.message;
	}

	if (error.message) {
		return error.message;
	}

	return 'An unknown error occurred';

}
