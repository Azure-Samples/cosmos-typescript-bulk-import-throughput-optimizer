import { Optimizer } from './optimizer';

import * as Chai from 'chai';
Chai.should();
const expect = Chai.expect;
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
//Chai.use(sinonChai);

class MockClient {
    public container: any = {
        items: {
            create: () => {
                return Promise.resolve();
            }
        },
        delete: () => {
            return Promise.resolve()
        }
    }

    public database: any = {
        containers: {
            createIfNotExists: async () => {
                return Promise.resolve({
                    container: this.container
                });
            }
        }
    }

    public databases: any = {
        createIfNotExists: async () => {
            return Promise.resolve({
                database: this.database
            });
        }
    }
}

describe('Optimizer tests', () => {
    it('Optimizer can be constructed', () => {
        const optimizer = new Optimizer();
        expect(typeof optimizer).to.equal('object');
    });

    it('Running all runs sequentially', async () => {
        let mockClient = new MockClient();
        let databaseCreateSpy = sinon.spy(mockClient.databases, 'createIfNotExists');
        let containerCreateSpy = sinon.spy(mockClient.database.containers, 'createIfNotExists');
        let itemCreateSpy = sinon.spy(mockClient.container.items, 'create');
        let containerDeleteSpy = sinon.spy(mockClient.container, 'delete');
        const optimizer = new Optimizer();
        await optimizer.initialize(mockClient);
        await optimizer.runAll();
        databaseCreateSpy.should.have.been.calledBefore(containerCreateSpy);
        containerCreateSpy.should.have.been.calledBefore(itemCreateSpy);
        itemCreateSpy.should.have.been.calledBefore(containerDeleteSpy);
    });
});
