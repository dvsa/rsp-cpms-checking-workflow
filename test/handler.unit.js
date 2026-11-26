import expect from 'expect';
import { handler } from '../src/handler';

describe('Lambda entry point', () => {
	it('exports the orphaned payment handler', () => {
		expect(typeof handler).toEqual('function');
	});
});
