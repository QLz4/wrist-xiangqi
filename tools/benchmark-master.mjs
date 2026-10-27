import fs from 'node:fs';
import vm from 'node:vm';
import * as rules from '../src/common/engine.js';
import {createOpponentSearch} from '../src/common/ai.js';
const ctx=vm.createContext({...rules,Date,Math});
vm.runInContext(fs.readFileSync(new URL('../evidence/ai-1.0.5.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')+'\nglobalThis.oldSearch=createOpponentSearch;',ctx);
function choose(g,modern){
 const options={level:5,now:()=>0,random:()=>0.5,history:g.keys,quiet:g.quiet};
 const s=(modern?createOpponentSearch:ctx.oldSearch)(g.board,g.turn,options);
 let r,slices=0,maxSlice=0;const start=performance.now();
 do {const begin=performance.now();r=s.step();maxSlice=Math.max(maxSlice,performance.now()-begin);slices++;}while(!r.done);
 return {move:r.move,nodes:r.nodes,depth:r.depth,ttHits:r.ttHits||0,computeMs:performance.now()-start,maxSliceMs:maxSlice,slices};
}
const report={environment:'Desktop Node.js; fixed node caps, no timer waits; not watch latency or an Elo rating',positions:[],matches:[]};
const sample=rules.newGame();rules.play(sample,54,45);
report.positions.push({name:'red left pawn opening',old:choose(sample,false),new:choose(sample,true)});
// Two colour-swapped comparisons under the shipping node budgets.
for(const newSide of [1,-1]){
 const g=rules.newGame();let maxSlice=0;
 for(let ply=0;ply<60&&!g.result;ply++){
  const r=choose(g,g.turn===newSide);maxSlice=Math.max(maxSlice,r.maxSliceMs);
  if(!r.move||!rules.play(g,r.move.from,r.move.to))throw new Error('Illegal benchmark move');
 }
 const result={newSide:newSide===1?'red':'black',result:g.result||'unfinished after 60 plies',plies:g.moves.length,
  materialFromNewSide:rules.evaluate(g.board,newSide),maxSliceMs:maxSlice,moves:g.moves.map(m=>[m.from,m.to])};
 report.matches.push(result);console.log(JSON.stringify({...result,moves:undefined}));
}
fs.writeFileSync(new URL('../evidence/master-benchmark-1.0.6.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report.positions));
