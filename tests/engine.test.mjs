import test from 'node:test';
import assert from 'node:assert/strict';
import {initialBoard, pseudoMoves, legalMoves, inCheck, newGame, play, undo, key, outcome, encode, decode, createSearch} from '../src/common/engine.js';

function bare() { const b = Array(90).fill(0); b[4] = -1; b[85] = 1; b[49] = 7; return b; }
function fixture(b, turn = 1) { return {board:b,turn,quiet:0,moves:[],keys:[key(b,turn)],result:''}; }
function perft(b, turn, depth) {
  if (!depth) return 1;
  let n = 0;
  for (const m of legalMoves(b, turn)) {
    const p=b[m.from], q=b[m.to]; b[m.to]=p; b[m.from]=0;
    n += perft(b, -turn, depth-1); b[m.from]=p; b[m.to]=q;
  }
  return n;
}
test('standard opening: 32 pieces, 44 legal moves, 1,920 depth-two positions', () => {
  const b = initialBoard(), copy = b.slice();
  assert.equal(b.filter(Boolean).length,32);
  assert.equal(perft(b,1,1),44); assert.equal(perft(b,1,2),1920); assert.deepEqual(b,copy);
});
test('horse leg blocks the corresponding two jumps', () => {
  const b=bare(); b[40]=4; b[31]=7;
  const m=pseudoMoves(b,40); assert(!m.includes(21)); assert(!m.includes(23)); assert(m.includes(51));
});
test('elephant eye and river, advisor and general palace bounds', () => {
  const b=bare(); b[49]=3; b[57]=7;
  assert(!pseudoMoves(b,49).includes(65)); assert(!pseudoMoves(b,49).includes(29));
  assert(pseudoMoves(b,49).includes(69));
  b[66]=2; assert.deepEqual(pseudoMoves(b,66),[76]);
  b[85]=0; b[66]=1; assert.deepEqual(pseudoMoves(b,66).sort((a,b)=>a-b),[67,75]);
});
test('cannon needs exactly one screen and cannot jump to empty squares', () => {
  const b=bare(); b[40]=6; b[37]=7; b[36]=-5; b[43]=-7;
  const m=pseudoMoves(b,40);
  assert(m.includes(36)); assert(!m.includes(37)); assert(!m.includes(43)); assert(m.includes(42));
  b[38]=-7; assert(!pseudoMoves(b,40).includes(36));
});
test('rook cannot jump or capture own piece', () => {
  const b=bare(); b[40]=5; b[38]=7; b[43]=-7;
  const m=pseudoMoves(b,40); assert(m.includes(39)); assert(!m.includes(38)); assert(!m.includes(37)); assert(m.includes(43)); assert(!m.includes(44));
});
test('pawns move forward, gain sideways after river, never backward', () => {
  const b=bare(); b[54]=7; assert.deepEqual(pseudoMoves(b,54),[45]);
  b[36]=7; assert.deepEqual(pseudoMoves(b,36),[27,37]);
  b[35]=-7; assert.deepEqual(pseudoMoves(b,35),[44]);
  b[53]=-7; assert.deepEqual(pseudoMoves(b,53),[62,52]);
});
test('facing generals and a pinned blocker cannot expose own general', () => {
  const b=bare(); b[49]=5;
  assert(!inCheck(b,1)); assert(!legalMoves(b,1,49).some(m=>m.to===48));
  b[49]=0; assert(inCheck(b,1)); assert(inCheck(b,-1));
  assert(!legalMoves(b,1).some(m=>m.to===4));
});
test('check must be answered; flying general prevents illegal escape', () => {
  const b=bare(); b[49]=0; b[76]=-5;
  assert(inCheck(b,1)); assert(legalMoves(b,1).every(m=>m.from===85));
  assert(!legalMoves(b,1).some(m=>m.to===76));
});
test('checkmate and stalemate both lose', () => {
  const b=Array(90).fill(0); b[3]=-1; b[85]=1; b[75]=-5; b[77]=-5;
  assert(!inCheck(b,1)); assert.equal(outcome(fixture(b)),'black');
  b[76]=-5; assert(inCheck(b,1)); assert.equal(outcome(fixture(b)),'black');
});
test('threefold repetition draws, undo restores state, replay preserves it', () => {
  const g=newGame(); const cycle=[[82,63],[1,18],[63,82],[18,1]];
  for(let n=0;n<2;n++) for(const m of cycle) assert(play(g,...m));
  assert.equal(g.result,'draw'); assert(!play(g,54,45));
  assert.deepEqual(decode(encode(g,'local')).game,g);
  assert(undo(g)); assert.equal(g.result,''); assert.equal(g.turn,-1);
  for(let i=0;i<7;i++) undo(g); assert.deepEqual(g,newGame());
});
test('120 non-captures draw; a capture resets the counter', () => {
  const g=newGame(); g.quiet=119; assert(play(g,54,45)); assert.equal(g.result,'draw');
  const h=fixture(bare()); h.board[54]=5; h.board[45]=-7; h.quiet=119;
  assert(play(h,54,45)); assert.equal(h.quiet,0); assert.equal(h.result,'');
});
test('corrupt saves and invalid coordinates are rejected', () => {
  for(const s of ['{','null','{"version":2}',JSON.stringify({version:1,mode:'ai',moves:[[85,4]]})]) assert.throws(()=>decode(s));
  const g=newGame(); for(const m of [[-1,1],[90,1],[54,100],[54,45.5],['54',45]]) assert(!play(g,...m));
});
test('AI produces a legal move without modifying source board', () => {
  const g=newGame(); play(g,54,45); const copy=g.board.slice(), search=createSearch(g.board,-1);
  let result, steps=0; do { result=search.step(); steps++; assert(steps<100); } while(!result.done);
  assert(legalMoves(g.board,-1).some(m=>m.from===result.move.from&&m.to===result.move.to));
  assert.deepEqual(g.board,copy);
});
test('optimized check detection matches move generation through 160 legal positions',()=>{
  let b=initialBoard(), turn=1, seed=17;
  function reference(s){const k=b.indexOf(s);return k<0||b.some((p,i)=>p*s<0&&pseudoMoves(b,i).includes(k));}
  for(let n=0;n<160;n++){
    assert.equal(inCheck(b,1),reference(1));assert.equal(inCheck(b,-1),reference(-1));
    const moves=legalMoves(b,turn);if(!moves.length){b=initialBoard();turn=1;continue;}
    seed=(seed*1664525+1013904223)>>>0;const m=moves[seed%moves.length];
    b[m.to]=b[m.from];b[m.from]=0;turn=-turn;
  }
});
test('optimized legality retains the depth-three standard opening count',()=>{
  assert.equal(perft(initialBoard(),1,3),79666);
});
test('AI returns a legal fallback when scoring budget is exhausted before scoring',()=>{
  const b=initialBoard(),copy=b.slice();const search=createSearch(b,1,{budgetMs:0,now:()=>0});
  const r=search.step();assert.equal(r.done,true);assert.equal(r.evaluated,0);
  assert(legalMoves(b,1).some(m=>m.from===r.move.from&&m.to===r.move.to));assert.deepEqual(b,copy);
});
test('AI limits each slice to 8 candidates and stops when the clock reaches its budget',()=>{
  let clock=0;const b=initialBoard(),s=createSearch(b,1,{now:()=>clock,budgetMs:100});
  const a=s.step();assert.equal(a.done,false);assert.equal(a.evaluated,8);
  clock=101;const z=s.step();assert.equal(z.done,true);assert.equal(z.evaluated,8);assert.deepEqual(z.move,a.move);
  assert.deepEqual(s.step().move,z.move);
});
