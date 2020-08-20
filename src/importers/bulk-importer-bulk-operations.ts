import { BulkImporter, ImportResults, ImportMethod } from './bulk-importer';

import { Container, OperationInput, BulkOperationType } from '@azure/cosmos';

const BATCH_MAXIMUM_SIZE = 100;

export class BulkImporterBulkOperations implements BulkImporter {
    private container: Container;

    public async initialize(container: Container): Promise<void> {
        this.container = container;
    }

    public async import(data: Array<any>, importMethod: ImportMethod): Promise<ImportResults> {
        let failedItems = 0;
        let consumedRequestUnits = 0;
        const errors = [];

        const batchCount = Math.ceil(data.length / BATCH_MAXIMUM_SIZE);
        for (let i = 0; i < batchCount; i++) {
            const dataBatch = data.slice(i * BATCH_MAXIMUM_SIZE, (i + 1) * BATCH_MAXIMUM_SIZE);
            const operations: OperationInput[] = []
            dataBatch.forEach((value) => {
                operations.push({
                    operationType:
                        importMethod === ImportMethod.Create ?
                            BulkOperationType.Create :
                            BulkOperationType.Upsert,
                    resourceBody: value
                });
            });
            const response = await this.container.items.bulk(operations);
            response.forEach((value) => {
                consumedRequestUnits += value.requestCharge;
                if (value.statusCode !== 201) {
                    failedItems += 1;
                    errors.push(value);
                }
            });
        }
        return ({
            requestUnits: consumedRequestUnits,
            failedItems: failedItems,
            errors: errors
        });
    }
}