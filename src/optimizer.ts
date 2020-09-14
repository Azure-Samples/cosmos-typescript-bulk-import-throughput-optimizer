import { CosmosClient, Container, Database, IndexingMode } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";
import { ServiceClient, bearerTokenAuthenticationPolicy } from "@azure/core-http";
import *  as faker from "faker";

import { ImportMethod, PartitionKeyValue, ImportOption, BulkImporter } from './importers/bulk-importer';
import { BulkImporterBulkOperations } from "./importers/bulk-importer-bulk-operations";
import { BulkImporterStoredProcedure } from "./importers/bulk-importer-stored-procedure";
import { BulkImporterParallel } from "./importers/bulk-importer-parallel";

const FRACTION_DIGITS = 2;

export class Optimizer {
    private endpointUrl: string = process.env.ENDPOINT_URL;
    private authorizationKey: string = process.env.AUTHORIZATION_KEY;
    private subscriptionId: string = process.env.SUBSCRIPTION_ID;
    private resourceGroupName: string = process.env.RESOURCE_GROUP_NAME;
    private accountName: string = process.env.ACCOUNT_NAME;
    private databaseName: string = process.env.DATABASE_NAME || 'bulk-tutorial';
    private containerName: string  = process.env.CONTAINER_NAME || 'items';
    private itemsToInsert: number = parseInt(process.env.ITEMS_TO_INSERT) || 1000;
    private throughput: number = parseInt(process.env.THROUGHPUT) || 400;

    private client: CosmosClient;
    private database: Database;
    private container: Container;

    private testData: Array<any>;

    public async initialize(client?: CosmosClient): Promise<void> {
        this.createTestData();

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
            key: this.authorizationKey,
            connectionPolicy: {
                // Use a retry policy that retries long enough in case lots of
                // data is tried to be imported to a low throughput container.
                retryOptions: {
                    maxRetryAttemptCount: 120,
                    maxWaitTimeInSeconds: 600,
                    fixedRetryIntervalInMilliseconds: 0
                }
            }
        });
    }

    public async createDatabase(): Promise<void> {
        this.database = (await this.client.databases.createIfNotExists({
            id: this.databaseName,
            throughput: this.throughput
        })).database;
    }

    public async createContainer(): Promise<void> {
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

    private createTestData(wordCount = 10): void {
        this.testData = [];
        for (let i = 0; i < this.itemsToInsert; i++) {
            this.testData.push({
                id: faker.random.uuid(),
                username: faker.internet.userName(),
                data: faker.lorem.words(wordCount),
                // This must be static for stored procedure bulk import to work
                pk: PartitionKeyValue
            });
        }
    }

    public updateTestDataIds(): void {
        this.testData = this.testData.map((value) => {
            return {
                ...value,
                id: faker.random.uuid()
            }
        });
    }

    public async bulkImport(importMethod: ImportMethod = ImportMethod.Create, importOption: ImportOption = ImportOption.Parallel): Promise<void> {
        let bulkImporter: BulkImporter;
        switch (importOption) {
            case ImportOption.StoredProcedure:
                bulkImporter = new BulkImporterStoredProcedure();
                break;
            case ImportOption.BulkOperations:
                bulkImporter = new BulkImporterBulkOperations();
                break;
            default:
                bulkImporter = new BulkImporterParallel();
        }
        await bulkImporter.initialize(this.container);

        const startTime = Date.now();

        const results = await bulkImporter.import(this.testData, importMethod);

        const endTime = Date.now()
        const durationInSeconds = (endTime - startTime) / 1000;
        console.log('---------------');
        console.log(`${ImportOption[importOption]} importing ${this.itemsToInsert} items with ${ImportMethod[importMethod]} took ${durationInSeconds.toFixed(FRACTION_DIGITS)} seconds`);
        console.log(`Average throughput ${(this.itemsToInsert / durationInSeconds).toFixed(FRACTION_DIGITS)} per second`);
        console.log(`Consumed Request Units ${results.requestUnits.toFixed(FRACTION_DIGITS)}`);
        const itemCountResult = await this.container.items.query('SELECT COUNT(1) FROM c').fetchAll();
        console.log(`Item count in Cosmos DB is ${itemCountResult.resources[0]['$1']}`);
        console.log(`Failed to import ${results.failedItems} items`);
        results.errors.forEach(value => {
            console.log(value);
        });
        console.log('---------------');
    }

    public async bulkImportStoredProcedure(importMethod: ImportMethod): Promise<void> {
        await this.bulkImport(importMethod, ImportOption.StoredProcedure);
    }

    public async bulkImportParallel(importMethod: ImportMethod): Promise<void> {
        await this.bulkImport(importMethod, ImportOption.Parallel);
    }

    public async bulkImportBulkOperations(importMethod: ImportMethod): Promise<void> {
        await this.bulkImport(importMethod, ImportOption.BulkOperations);
    }

    public async deleteDatabase(): Promise<void> {
        await this.database.delete();
    }

    public async deleteContainer(): Promise<void> {
        await this.container.delete();
    }

    public async runAll(): Promise<void> {
        await this.createDatabase();
        await this.createContainer();
        await this.bulkImport();
        await this.deleteContainer();
        await this.deleteDatabase();
    }

    public async runCreates(): Promise<void> {
        await this.createDatabase();
        await this.createContainer();
    }

    public async runDeletes(): Promise<void> {
        await this.deleteContainer();
        await this.deleteDatabase();
    }
}
