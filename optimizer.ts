import { CosmosClient, Container, Database, IndexingMode } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceClient, bearerTokenAuthenticationPolicy } from "@azure/core-http";
import *  as async from "async";
import *  as faker from "faker";

export class Optimizer {
    private endpointUrl: string = process.env.ENDPOINT_URL;
    private authorizationKey: string = process.env.AUTHORIZATION_KEY;
    private subscriptionId: string = process.env.SUBSCRIPTION_ID;
    private resourceGroupName: string = process.env.RESOURCE_GROUP_NAME;
    private accountName: string = process.env.ACCOUNT_NAME;
    private databaseName: string = "bulk-tutorial";
    private containerName: string  = "items";
    private itemsToInsert: number = 3000;
    private concurrency: number = 10;
    private throughput: number = 400;

    private client: CosmosClient;
    private database: Database;
    private container: Container;

    public async initialize(client?: any) {
        if (client) {
            this.client = client;
            return;
        }

        if (!this.endpointUrl || !this.authorizationKey) {
            const credential = new DefaultAzureCredential();
            const serviceClient = new ServiceClient(credential, {
                requestPolicyFactories: [
                    bearerTokenAuthenticationPolicy(credential, "https://management.azure.com/")
                ]
            });
            const response = await serviceClient.sendRequest({
                url: `https://management.azure.com/subscriptions/${this.subscriptionId}/resourceGroups/${this.resourceGroupName}/providers/Microsoft.DocumentDB/databaseAccounts/${this.accountName}/listKeys?api-version=2019-12-12`,
                method: "POST"
            });
            this.endpointUrl = `https://${this.accountName}.documents.azure.com:443/`;
            this.authorizationKey = JSON.parse(response.bodyAsText).primaryMasterKey;
        }

        this.client = new CosmosClient({
            endpoint: this.endpointUrl,
            key: this.authorizationKey
        });
    }

    public async createDatabase() {
        this.database = (await this.client.databases.createIfNotExists({
            id: this.databaseName,
            throughput: this.throughput
        })).database;
    }

    public async createContainer() {
        this.container = (await this.database.containers.createIfNotExists({
            id: this.containerName,
            partitionKey: {
                paths: ["/pk"]
            },
            indexingPolicy: {
                indexingMode: IndexingMode.consistent,
                includedPaths: [],
                excludedPaths: [
                    { path: "/*" }
                ]
            }
        })).container;
    }

    public async createItems() {
        return new Promise((resolve, reject) => {
            let startTime = Date.now();
            let createList = [];
            let failedItems = 0;
            let consumedRequestUnits = 0;
            for (let i = 0; i < this.itemsToInsert; i++) {
                const uuid = faker.random.uuid();
                const username = faker.internet.userName();
                createList.push(async (callback: () => void) => {
                    if (i % 1000 === 0 && i > 0) {
                        console.log(`Creating item number ${i}`);
                    }
                    try {
                        let result = await this.container.items.create({
                            id: uuid,
                            username: username,
                            pk: uuid
                        });
                        consumedRequestUnits += result.requestCharge;
                    } catch (error) {
                        failedItems += 1;
                    } finally {
                        callback();
                    }
                });
            }
            async.parallelLimit(createList, this.concurrency, (error, results) => {
                if (error) {
                    reject(error);
                    return;
                }
                let endTime = Date.now()
                let durationInSeconds = (endTime - startTime) / 1000;
                console.log(`Creating ${this.itemsToInsert} items took ${durationInSeconds} seconds`);
                console.log(`Average throughput ${this.itemsToInsert / durationInSeconds} per second`);
                console.log(`Failed to create ${failedItems} items`);
                console.log(`Consumed Request Units ${consumedRequestUnits}`);
                resolve(results);
            });
        });
    }

    public async deleteDatabase() {
        await this.database.delete();
    }

    public async deleteContainer() {
        await this.container.delete();
    }

    public async runAll() {
        await this.createDatabase();
        await this.createContainer();
        await this.createItems();
        await this.deleteContainer();
        await this.deleteDatabase();
    }

    public async runCreates() {
        await this.createDatabase();
        await this.createContainer();
        await this.createItems();
    }
}
