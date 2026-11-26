import expect from 'expect';
import handleError from '../../src/utils/handleError';

describe('handleError', () => {
	it('uses a message from an Axios response when available', () => {
		const error = {
			message: 'Dummy transport message',
			response: { data: { message: 'Dummy service message' } },
		};

		expect(handleError.errorMessage(error)).toEqual('Dummy service message');
		expect(handleError.errorMessageFromAxiosError(error)).toEqual('Dummy service message');
	});

	it('uses the ordinary error message when no Axios response exists', () => {
		expect(handleError.errorMessage(new Error('Dummy error'))).toEqual('Dummy error');
		expect(handleError.errorMessageFromAxiosError(new Error('Dummy error'))).toEqual('');
	});

	it('returns a fallback message when the error has no message', () => {
		expect(handleError.errorMessage({})).toEqual('An unknown error occurred');
	});
});
