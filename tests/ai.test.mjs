import test from 'node:test';
import assert from 'node:assert/strict';
import {LEVELS,createOpponentSearch} from '../src/common/ai.js';
import {initialBoard,legalMoves,inCheck,newGame,play,encode,decode} from '../src/common/engine.js';

function finish(search){let r,n=0;do{r=search.step();assert(n++<2000);}while(!r.done);return r;}
test('five distinct profiles increase depth and computation budgets',()=>{
  assert.equal(LEVELS.length,5);
  for(let i=1;i<5;i++){
    assert(LEVELS[i].depth>LEVELS[i-1].depth);
    assert(LEVELS[i].budget>LEVELS[i-1].budget);
    assert(LEVELS[i].nodes>LEVELS[i-1].nodes);
  }
});
test('every level returns a legal move within its node cap without changing the source',()=>{
  const g=newGame();play(g,54,45);const copy=g.board.slice(), legal=legalMoves(g.board,-1);
  for(const c of LEVELS){
    const r=finish(createOpponentSearch(g.board,-1,{level:c.id,now:()=>0,random:()=>0.5}));
    assert(legal.some(m=>m.from===r.move.from&&m.to===r.move.to));
    assert(r.nodes<=c.nodes);assert.deepEqual(g.board,copy);
    if(c.id===2)assert.equal(r.depth,2);
    if(c.id>=3)assert(r.depth>=3);
  }
});
test('strong AI finds an immediate mate and answers a changed checking position legally',()=>{
  const b=Array(90).fill(0);b[4]=-1;b[85]=1;b[75]=-5;b[77]=-5;b[58]=-5;
  const r=finish(createOpponentSearch(b,-1,{level:5,now:()=>0,random:()=>0.5}));
  const moved=b.slice();moved[r.move.to]=moved[r.move.from];moved[r.move.from]=0;
  assert.equal(legalMoves(moved,1).length,0);
  const checked=initialBoard();checked[76]=-5;assert(inCheck(checked,1));
  const escape=finish(createOpponentSearch(checked,1,{level:5,now:()=>0,random:()=>0.5}));
  checked[escape.move.to]=checked[escape.move.from];checked[escape.move.from]=0;assert(!inCheck(checked,1));
});
test('deadline and cancellation during deeper search preserve a legal fallback',()=>{
  const b=initialBoard(),before=b.slice();let clock=0;
  const s=createOpponentSearch(b,1,{level:5,now:()=>clock,budgetMs:50,random:()=>0.5});
  let r;for(let i=0;i<8;i++)r=s.step();assert(!r.done);assert(r.nodes>0);
  clock=51;r=s.step();assert(r.done);assert(r.move);assert.deepEqual(b,before);
  const c=createOpponentSearch(b,1,{level:5,now:()=>0});for(let i=0;i<8;i++)c.step();c.cancel();
  assert(c.step().done);assert.deepEqual(b,before);
});
test('v1 saves migrate to level one; level choice and cleared stages round-trip',()=>{
  const old=decode(JSON.stringify({version:1,mode:'ai',moves:[[54,45]]}));
  assert.equal(old.level,1);assert.deepEqual(old.cleared,[]);assert.equal(old.game.moves.length,1);
  const saved=decode(encode(old.game,'ai',{level:4,cleared:[1,3]}));
  assert.equal(saved.level,4);assert.deepEqual(saved.cleared,[1,3]);assert.deepEqual(saved.game,old.game);
  for(const meta of [{level:6,cleared:[]},{level:2,cleared:[1,1]},{level:2,cleared:[8]}])assert.throws(()=>decode(encode(newGame(),'ai',meta)));
});
