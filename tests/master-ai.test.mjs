import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as rules from '../src/common/engine.js';
import {createOpponentSearch,LEVELS} from '../src/common/ai.js';
import {MASTER_LIMITS,createMasterSearch} from '../src/common/master-ai.js';
const baselineContext=vm.createContext({...rules,Date,Math});
vm.runInContext(fs.readFileSync(new URL('../evidence/ai-1.0.5.js',import.meta.url),'utf8').replace(/^import .*$/gm,'').replace(/export /g,'')+'\nglobalThis.oldSearch=createOpponentSearch;globalThis.oldLevels=LEVELS;',baselineContext);
function finish(search){let r,n=0;do{r=search.step();assert(n++<5000);}while(!r.done);return r;}
const deterministic={now:()=>0,random:()=>0.5};

test('levels one through four retain previous profiles and identical moves on evolving positions',()=>{
  assert.deepEqual(LEVELS.slice(0,4),JSON.parse(JSON.stringify(baselineContext.oldLevels.slice(0,4))));
  const g=rules.newGame();let seed=21;
  for(let ply=0;ply<20;ply++){
    if(ply%5===0)for(let level=1;level<=4;level++){
      const a=finish(createOpponentSearch(g.board,g.turn,{...deterministic,level}));
      const b=finish(baselineContext.oldSearch(g.board,g.turn,{...deterministic,level}));
      assert.equal(a.move.from,b.move.from);assert.equal(a.move.to,b.move.to);assert.equal(a.nodes,b.nodes);assert.equal(a.depth,b.depth);
    }
    const moves=rules.legalMoves(g.board,g.turn);seed=(seed*1664525+1013904223)>>>0;
    const move=moves[seed%moves.length];rules.play(g,move.from,move.to);
  }
});

test('fifth level uses cached PVS search with bounded slices and a legal fallback',()=>{
  const g=rules.newGame();rules.play(g,54,45);const before=g.board.slice();
  const search=createOpponentSearch(g.board,g.turn,{...deterministic,level:5,history:g.keys});
  let previous=0,r;
  do {r=search.step();assert(r.nodes-previous<=MASTER_LIMITS.sliceNodes);previous=r.nodes;}while(!r.done);
  assert.equal(r.engine,'pvs-master');assert(r.ttHits>0);assert(r.cutoffs>0);assert(r.depth>=3);
  assert(r.nodes<=MASTER_LIMITS.nodes);assert.deepEqual(g.board,before);
  assert(rules.legalMoves(g.board,g.turn).some(m=>m.from===r.move.from&&m.to===r.move.to));
});

test('fifth-level repetitions and 120 quiet plies draw, but immediate mate takes priority',()=>{
  const b=rules.initialBoard(),history=[];
  for(const m of rules.legalMoves(b,1)){
    const after=b.slice();after[m.to]=after[m.from];after[m.from]=0;
    const k=rules.key(after,-1);history.push(k,k);
  }
  const repeated=finish(createMasterSearch(b,1,{...deterministic,history,maxDepth:2}));
  assert.equal(repeated.score,0);
  // Kings and a blocked file: every root move is non-capturing.
  const end=Array(90).fill(0);end[4]=-1;end[85]=1;end[49]=7;
  const quiet=finish(createMasterSearch(end,1,{...deterministic,quiet:119,maxDepth:2}));
  assert.equal(quiet.score,0);
  const mate=Array(90).fill(0);mate[4]=-1;mate[85]=1;mate[75]=-5;mate[77]=-5;mate[58]=-5;
  const win=finish(createMasterSearch(mate,-1,{...deterministic,quiet:119}));
  assert(win.score>29000);mate[win.move.to]=mate[win.move.from];mate[win.move.from]=0;
  assert.equal(rules.legalMoves(mate,1).length,0);
});

test('cancel and deadline unwind an interrupted fifth-level search at multiple depths',()=>{
  const b=rules.initialBoard(),before=b.slice();
  for(const slices of [1,8,40,100]){
    let clock=0;const search=createMasterSearch(b,1,{now:()=>clock,budgetMs:100});
    for(let i=0;i<slices;i++)search.step();
    clock=101;const r=search.step();assert(r.done);assert(r.move);assert.deepEqual(b,before);
    search.cancel();assert.deepEqual(search.step(),r);
  }
  const zero=finish(createMasterSearch(b,1,{...deterministic,maxNodes:0}));
  assert(zero.move);assert.equal(zero.nodes,0);
});
