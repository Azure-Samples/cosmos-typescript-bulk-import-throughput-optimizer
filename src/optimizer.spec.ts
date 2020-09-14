import { Optimizer } from './optimizer';

import * as Chai from 'chai';
Chai.should();
const expect = Chai.expect;
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
Chai.use(sinonChai);

class MockClient {
    public container: any = {
        items: {
            create: () => {
                return Promise.resolve({
                    requestCharge: 1
                });
            },
            upsert: () => {
                return Promise.resolve({
                    requestCharge: 1
                });
            },
            query: () => {
                return {
                    fetchAll: () => {
                        return Promise.resolve({
                            resources: [
                                {
                                    '$1': 0
                                }
                            ]
                        });
                    }
                }
            }
        },
        delete: () => {
            return Promise.resolve()
        }
    }

    public database: any = {
        containers: {
            createIfNotExists: () => {
                return Promise.resolve({
                    container: this.container
                });
            }
        },
        delete: () => {
            return Promise.resolve()
        }
    }

    public databases: any = {
        createIfNotExists: () => {
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
        const mockClient = new MockClient();
        const databaseCreateSpy = sinon.spy(mockClient.databases, 'createIfNotExists');
        const containerCreateSpy = sinon.spy(mockClient.database.containers, 'createIfNotExists');
        const itemCreateSpy = sinon.spy(mockClient.container.items, 'create');
        const containerDeleteSpy = sinon.spy(mockClient.container, 'delete');
        const databaseDeleteSpy = sinon.spy(mockClient.database, 'delete');
        const optimizer = new Optimizer();
        await optimizer.initialize(mockClient as any);
        await optimizer.runAll();
        databaseCreateSpy.should.have.been.calledBefore(containerCreateSpy);
        containerCreateSpy.should.have.been.calledBefore(itemCreateSpy);
        itemCreateSpy.should.have.been.calledBefore(containerDeleteSpy);
        containerDeleteSpy.should.have.been.calledBefore(databaseDeleteSpy);
    });
});
