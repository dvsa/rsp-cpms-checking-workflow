import expect from 'expect';
import isEmptyObject from '../../src/utils/isEmptyObject';

describe('isEmptyObject', () => {
	it('returns true only for an empty plain object', () => {
		expect(isEmptyObject({})).toEqual(true);
		expect(isEmptyObject({ value: 'dummy' })).toEqual(false);
		expect(isEmptyObject([])).toEqual(false);
		expect(isEmptyObject(Object.create(null))).toEqual(false);
	});
});
