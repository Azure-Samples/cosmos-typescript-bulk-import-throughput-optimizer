import { Optimizer } from './optimizer';
import { ImportMethod } from './bulk-importer';

const SLEEP_TIMEOUT = 10000;

(async () => {
    const optimizer = new Optimizer();
    try {
        await optimizer.initialize();
        await optimizer.runCreates();

        const sleep = (timeout: number) => {
            return new Promise((resolve) => {
                setTimeout(resolve, timeout)
            });
        };

        const reset = async () => {
            // Updating the test data ids ensures that all items are unique
            // while keeping the data between tests the same for more accurate
            // comparison.
            optimizer.updateTestDataIds()
            // It was observed that if the tests are run right after each other
            // without a sleep in between, the test results of the previous run
            // affect the next one. This is most likely because of the way the
            // throughput throttling is implemented in the Cosmos DB server.
            await sleep(SLEEP_TIMEOUT);
        }

        await optimizer.bulkImportParallel(ImportMethod.Create);
        await reset();
        await optimizer.bulkImportParallel(ImportMethod.Upsert);
        await reset();
        await optimizer.bulkImportStoredProcedure(ImportMethod.Create);
        await reset();
        await optimizer.bulkImportStoredProcedure(ImportMethod.Upsert);
    } catch (err) {
        console.error(err);
    } finally {
        await optimizer.runDeletes();
    }
})();
