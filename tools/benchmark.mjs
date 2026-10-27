import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import * as old from '../evidence/engine-1.0.0.js';
import * as current from '../src/common/engine.js';

const g=old.newGame();old.play(g,54,45);const board=g.board;
function run(engine,n){
  const start=performance.now();let slices=0;
  for(let i=0;i<n;i++){
    const search=engine.createSearch(board,-1);let r;
    do{r=search.step();slices++;}while(!r.done);
  }
  return {averageComputeMs:Number(((performance.now()-start)/n).toFixed(3)),averageSlices:slices/n};
}
run(old,10);run(current,10);
const report={scenario:'Initial red pawn 54 -> 45; black to move',environment:'Desktop Node.js; not a watch benchmark',iterations:200,old:run(old,200),current:run(current,200)};
report.computeSpeedup=Number((report.old.averageComputeMs/report.current.averageComputeMs).toFixed(2));
fs.writeFileSync(new URL('../evidence/benchmark-1.0.1.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
