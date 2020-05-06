import { Optimizer } from './optimizer';

import * as Chai from 'chai';
const expect = Chai.expect;

describe('Optimizer tests', () => {
    it('Optimizer can be constructed', () => {
        const optimizer = new Optimizer();
        expect(typeof optimizer).to.equal('object');
    });
});
