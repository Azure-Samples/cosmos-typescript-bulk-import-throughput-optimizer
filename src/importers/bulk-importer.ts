import { Container } from "@azure/cosmos";

export interface BulkImporter {
    initialize(container: Container): Promise<void>;
    import(data: Array<any>, importMethod: ImportMethod): Promise<ImportResults>;
}

export interface ImportResults {
    requestUnits: number,
    failedItems: number,
    errors: Array<any>
}

export enum ImportMethod {
    Upsert,
    Create
}

export enum ImportOption {
    Parallel,
    StoredProcedure,
    BulkOperations
}

export const PartitionKeyValue = 'bulk';
