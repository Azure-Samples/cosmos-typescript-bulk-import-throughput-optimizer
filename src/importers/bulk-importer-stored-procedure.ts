import { BulkImporter, ImportResults, ImportMethod, PartitionKeyValue } from './bulk-importer';

import { Container, StoredProcedure } from "@azure/cosmos";

import * as fs from 'fs';
import { promisify } from 'util';

const COSMOSDB_RESPONSE_CODE_ERR_TOO_LARGE = 413;
const COSMOSDB_RESPONSE_CODE_ERR_TIMEOUT = 408;

export class BulkImporterStoredProcedure implements BulkImporter {
    private container: Container;
    private storedProcedure: StoredProcedure;
    private bulkInserted = 0;
    private bulkInsertRus = 0;
    private errors = [];

    public async initialize(container: Container): Promise<void> {
        this.container = container;
        this.storedProcedure = await this.ensureStoredProc('./dist/stored-procedure-src/stored-procedure.js', 'spBulkInsertV1');
    }

    public async import(data: Array<any>, importMethod: ImportMethod): Promise<ImportResults> {
        this.bulkInserted = 0;
        this.bulkInsertRus = 0;
        await this.importCore(data, importMethod === ImportMethod.Upsert, false, -1);

        return {
            requestUnits: this.bulkInsertRus,
            failedItems: data.length - this.bulkInserted,
            errors: this.errors
        };
    }

    private async importCore(items: any[], useUpsert: boolean, ignoreInsertErrors: boolean, chunkSize = -1): Promise<void> {
        if (!this.storedProcedure) {
            throw new Error('missing stored procedure');
        }

        try {
            if (chunkSize != -1 && items.length > chunkSize) {
                const tasks = Array<Promise<any>>(Math.ceil(items.length / chunkSize));
                let idx = 0;
                for (let i = 0; i < tasks.length; i++) {
                    const end = Math.min(items.length, idx + chunkSize);
                    tasks[i] = this.importCore(items.slice(idx, end), useUpsert, ignoreInsertErrors, chunkSize);
                    idx += chunkSize;
                }
                await Promise.all(tasks);
            }
            else {
                const result = await this.storedProcedure.execute(PartitionKeyValue, [items, useUpsert, ignoreInsertErrors]);
                const processedItems = result.resource.processed;
                this.bulkInsertRus += result.requestCharge;
                this.bulkInserted += processedItems;
                if (processedItems < items.length) {
                    console.log(`inserted: ${processedItems}, duration: ${result.resource.duration}`);
                    await this.importCore(items.slice(processedItems), useUpsert, ignoreInsertErrors, chunkSize);
                }
            }
        }
        catch (err) {
            if (err.code === COSMOSDB_RESPONSE_CODE_ERR_TOO_LARGE) {
                console.log('request too large');
                const mid = items.length >> 1;
                await Promise.all([
                    this.importCore(items.slice(0, mid), useUpsert, ignoreInsertErrors, chunkSize),
                    this.importCore(items.slice(mid), useUpsert, ignoreInsertErrors, chunkSize)]);
            } else if (err.code === COSMOSDB_RESPONSE_CODE_ERR_TIMEOUT) {
                // The challenge in dealing the with stored procedure timeout is
                // that the stored procedure execution doesn't seem to be transactional
                // so some items may already be imported.
                throw err;
            } else {
                this.errors.push(err);
            }
        }
    }

    private async ensureStoredProc(file: string, id: string): Promise<StoredProcedure> {

        if (!this.container) {
            throw new Error('missing container');
        }

        const readFile = promisify(fs.readFile);
        const data = await readFile(file);
        const content = data.toString();


        const storedProcDef = {
            body: content,
            id: id
        };

        const existingSp = this.container.scripts.storedProcedure(id);

        try {
            const result = await existingSp.replace(storedProcDef);
            return result.storedProcedure;
        }
        catch (e) {
            if (e.code == 404) {
                const result = await this.container.scripts.storedProcedures.create(storedProcDef);
                return result.storedProcedure;
            }
            else {
                throw e;
            }
        }
    }
}