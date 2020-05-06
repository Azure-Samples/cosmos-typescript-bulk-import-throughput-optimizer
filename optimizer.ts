import { CosmosClient, Container, Database } from "@azure/cosmos";
import *  as async from "async";
import *  as faker from "faker";

export class Optimizer {
    private EndpointUrl: string = process.env.ENDPOINT_URL;
    private AuthorizationKey: string = process.env.AUTHORIZATION_KEY;
    private DatabaseName: string = "bulk-tutorial";
    private ContainerName: string  = "items";
    private ItemsToInsert: number = 3000;
    private Concurrency: number = 10;
    private Throughput: number = 400;

    private client: CosmosClient;
    private database: Database;
    private container: Container;

    public constructor() {
        this.client = new CosmosClient({
            endpoint: this.EndpointUrl,
            key: this.AuthorizationKey
        });
    }

    public async createDatabase() {
        this.database = (await this.client.databases.createIfNotExists({
            id: this.DatabaseName,
            throughput: this.Throughput
        })).database;
    }

    public async createContainer() {
        this.container = (await this.database.containers.createIfNotExists({
            id: this.ContainerName
        })).container;
    }

    public async createItems() {
        return new Promise((resolve, reject) => {
            let startTime = Date.now();
            let createList = [];
            for (let i = 0; i < this.ItemsToInsert; i++) {
                const uuid = faker.random.uuid();
                const username = faker.internet.userName();
                createList.push(async (callback: () => void) => {
                    if (i % 1000 === 0 && i > 0) {
                        console.log("Creating item number " + i);
                    }
                    await this.container.items.create({
                        id: uuid,
                        username: username,
                        pk: uuid
                    });
                    callback();
                });
            }
            async.parallelLimit(createList, this.Concurrency, (error, results) => {
                if (error) {
                    reject(error);
                    return;
                }
                let endTime = Date.now()
                let durationInSeconds = (endTime - startTime) / 1000;
                console.log("Creating " + this.ItemsToInsert + " items took " + durationInSeconds + " seconds");
                console.log("Average throughput " + this.ItemsToInsert / durationInSeconds + " per second");
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
        this.createItems().then(async () => {
            await this.deleteContainer();
        });
    }
}
