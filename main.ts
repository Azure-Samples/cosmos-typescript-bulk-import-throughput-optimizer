import { Optimizer } from './optimizer';

(async () => {
    let optimizer = new Optimizer();
    await optimizer.initialize()
    await optimizer.runCreates();
})();
