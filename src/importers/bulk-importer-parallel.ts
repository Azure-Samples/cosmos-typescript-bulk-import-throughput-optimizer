import { BulkImporter, ImportResults, ImportMethod } from './bulk-importer';

import { Container } from "@azure/cosmos";
import *  as async from "async";

const PARALLELISM = parseInt(process.env.PARALLELISM) || 20;

export class BulkImporterParallel implements BulkImporter {
    private container: Container;

    public async initialize(container: Container): Promise<void> {
        this.container = container;
    }

    public async import(data: Array<any>, importMethod: ImportMethod): Promise<ImportResults> {
        return new Promise((resolve, reject) => {
            let failedItems = 0;
            let consumedRequestUnits = 0;
            const errors = [];

            async.eachOfLimit(data, PARALLELISM, async (value, index: number, callback) => {
                try {
                    const result =
                        importMethod === ImportMethod.Create ?
                        await this.container.items.create(value) :
                        await this.container.items.upsert(value);
                    consumedRequestUnits += result.requestCharge;
                } catch (error) {
                    errors.push(error);
                    failedItems += 1;
                } finally {
                    callback();
                }
            }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({
                    requestUnits: consumedRequestUnits,
                    failedItems: failedItems,
                    errors
                });
            });
        });
    }
}