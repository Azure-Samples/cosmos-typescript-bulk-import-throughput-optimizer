import { Optimizer } from './optimizer';

let optimizer = new Optimizer();
optimizer.initialize().then(() => {
    optimizer.runAll();
});
