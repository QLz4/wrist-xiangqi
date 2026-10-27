import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../src/common/engine.js';
import {LEVELS,createOpponentSearch} from '../src/common/ai.js';

const ux=fs.readFileSync(new URL('../src/pages/index/index.ux',import.meta.url),'utf8');
const source=ux.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^import .*$/gm,'').replace('export default','globalThis.definition =');
function harness({deferSave=false,show=true,saved='',failAI=false,splash=false}={}) {
  let next=0; const timers=new Map(), delays=[], writes=[], messages=[], keep=[], connection={send: ({data})=>messages.push(data)};
  const storage={get:o=>o.success(saved),set:o=>{writes.push(o); if(!deferSave)o.success();}};
  const brightness={setKeepScreenOn:o=>{keep.push(o.keepScreenOn);if(o.success)o.success();}};
  const context=vm.createContext({...engine,LEVELS,brightness,storage,interconnect:{instance:()=>connection},console,
    createOpponentSearch:failAI ? ()=>{throw new Error('simulated runtime search error');} : createOpponentSearch,
    setTimeout:(fn,ms)=>{const id=next++;timers.set(id,fn);delays.push(ms);return id;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(source,context);
  const p=context.definition; Object.assign(p,p.private); p.onInit();if(show)p.onShow();
  if(!splash)p.finishSplash();
  function tick(){const [id,fn]=timers.entries().next().value||[];if(fn){timers.delete(id);fn();}}
  function drain(){let n=0;while(timers.size){tick();assert(n++<5000);}}
  return {p,timers,writes,messages,connection,tick,drain,keep,context,delays};
}
function human(p){p.select(54);p.select(45);p.confirmMove();}
test('selection does not move until confirmed; AI is cancelled by menu and resumes',()=>{
  const h=harness(),p=h.p;p.select(54);p.select(45);assert.equal(p.moveCount,0);assert.equal(p.confirmText,'落子');
  p.confirmMove();assert.equal(p.moveCount,1);assert(h.timers.size>0);
  p.openMenu();assert.equal(h.timers.size,0);assert.equal(p.moveCount,1);
  p.resume();h.drain();assert.equal(p.moveCount,2);assert.match(p.heading,/红方走/);
  p.takeBack();assert.equal(p.moveCount,0);assert.equal(h.timers.size,0);
});
test('hide/destroy stop AI timers and showing resumes black turn',()=>{
  const h=harness();human(h.p);h.p.onHide();assert.equal(h.timers.size,0);
  h.p.onShow();assert(h.timers.size>0);h.p.onDestroy();assert.equal(h.timers.size,0);
});
test('undo during thinking cancels response; local mode permits both sides',()=>{
  const h=harness();human(h.p);h.p.takeBack();assert.equal(h.p.moveCount,0);assert.equal(h.timers.size,0);
  h.p.askNew('local');h.p.startNew();human(h.p);h.p.select(27);h.p.select(36);h.p.confirmMove();
  assert.equal(h.p.moveCount,2);h.p.takeBack();assert.equal(h.p.moveCount,1);assert.match(h.p.heading,/黑方走/);
});
test('storage writes serialize so a slow old write cannot overwrite newer position',()=>{
  const h=harness({deferSave:true});human(h.p);assert.equal(h.writes.length,1);
  h.drain();assert.equal(h.writes.length,1);h.writes[0].success();assert.equal(h.writes.length,2);
  assert.equal(JSON.parse(h.writes[1].value).moves.length,2);h.writes[1].success();
  assert.equal(h.p.saveText,'棋局已自动保存');
});
test('debug off by default, ping/state read only, disabled handlers removed',()=>{
  const h=harness();assert.equal(h.messages.length,0);h.p.toggleDebug();
  h.connection.onmessage({data:'{"cmd":"ping"}'});assert.equal(h.messages.at(-1).event,'ping');
  const before=h.messages.length;h.connection.onmessage({data:'{"cmd":"move","from":54,"to":45}'});
  assert.equal(h.p.moveCount,0);assert.equal(h.messages.length,before);
  h.connection.onmessage({data:'not json'});assert.equal(h.messages.length,before);
  h.p.toggleDebug();assert.equal(h.connection.onmessage,null);
});
test('foreground keeps screen on, hide and destroy release it, return reacquires',()=>{
  const h=harness();assert.equal(h.keep.at(-1),true);assert.equal(h.p.keepText,'常亮');
  h.p.onHide();assert.equal(h.keep.at(-1),false);h.p.onShow();assert.equal(h.keep.at(-1),true);
  h.p.onDestroy();assert.equal(h.keep.at(-1),false);
});
test('onReady alone resumes a saved black turn if first onShow is not delivered',()=>{
  const g=engine.newGame();engine.play(g,54,45);
  const h=harness({show:false,saved:engine.encode(g,'ai')});assert.equal(h.timers.size,0);
  h.p.onReady();h.drain();assert.equal(h.p.moveCount,2);assert.equal(h.keep.at(-1),true);
});
test('a real touch recovers missing visibility events and AI search errors use a legal fallback',()=>{
  const h=harness({show:false,failAI:true});human(h.p);h.drain();
  assert.equal(h.p.moveCount,2);assert.match(h.p.heading,/红方走/);assert.equal(h.keep.at(-1),true);
});
test('selection and moves retain all row and cell objects instead of replacing the board',()=>{
  const h=harness(),rows=h.p.rows,cells=rows.flatMap(r=>r.cells),ranks=rows.slice();
  human(h.p);h.drain();assert.equal(h.p.rows,rows);
  for(let r=0;r<10;r++)assert.equal(h.p.rows[r],ranks[r]);
  for(let id=0;id<90;id++)assert.equal(h.p.rows[Math.floor(id/9)].cells[id%9],cells[id]);
  assert.equal(h.p.rows[5].cells[0].text,'兵');assert.equal(h.p.rows[6].cells[0].text,'');
});
test('a stale timer cannot move after undo/new game even if a queued callback fires',()=>{
  const h=harness();human(h.p);const stale=[...h.timers.values()][0];h.p.takeBack();
  stale();assert.equal(h.p.moveCount,0);assert.equal(h.timers.size,0);
});
test('all five levels are freely selectable and selection requires new-game confirmation',()=>{
  const h=harness();human(h.p);h.p.showLevels();assert.equal(h.p.levelItems.length,5);
  assert.equal(h.p.screen,'levels');assert.equal(h.timers.size,0);
  h.p.chooseLevel(5);assert.equal(h.p.screen,'new');assert.equal(h.p.moveCount,1);
  h.p.startNew();assert.equal(h.p.moveCount,0);assert.match(h.p.modeText,/第5关/);
  const saved=JSON.parse(h.writes.at(-1).value);assert.equal(saved.level,5);
});
test('winning records the stage and next-stage button advances; fifth win stays within five',()=>{
  const h=harness();
  vm.runInContext("game.board=Array(90).fill(0); game.board[4]=-1; game.board[85]=1; game.board[12]=5; game.board[14]=5; game.board[22]=5; game.keys=[key(game.board,1)];",h.context);
  h.p.paint(true);h.p.select(22);h.p.select(13);h.p.confirmMove();
  assert.equal(h.p.screen,'result');assert.match(h.p.resultTitle,/第1关通关/);
  assert.deepEqual(JSON.parse(h.writes.at(-1).value).cleared,[1]);
  h.p.continueResult();assert.match(h.p.modeText,/第2关/);assert.equal(h.p.moveCount,0);
  vm.runInContext("level=5;game.result='red';cleared=[1,2,3,4];",h.context);
  h.p.afterMove();assert.match(h.p.resultBody,/五关全部完成/);assert.equal(h.p.resultAction,'再战第五关');
  h.p.continueResult();assert.match(h.p.modeText,/第5关/);
  assert.deepEqual(JSON.parse(h.writes.at(-1).value).cleared,[1,2,3,4,5]);
});
test('level and progress survive restart and switching to local mode',()=>{
  const h=harness({saved:engine.encode(engine.newGame(),'ai',{level:4,cleared:[1,2]})});
  assert.match(h.p.modeText,/第4关/);h.p.showLevels();assert.equal(h.p.progressText,'已通关 2 / 5');
  h.p.askNew('local');h.p.startNew();assert.deepEqual(JSON.parse(h.writes.at(-1).value).cleared,[1,2]);
});
test('only black pieces in local games are rotated; AI games remain upright',()=>{
  const h=harness();assert(h.p.rows.flatMap(r=>r.cells).every(c=>!c.image));
  h.p.askNew('local');h.p.startNew();
  assert.equal(h.p.rows.flatMap(r=>r.cells).filter(c=>c.image).length,16);
  assert(h.p.rows[0].cells.every(c=>c.image));
  assert(h.p.rows[9].cells.every(c=>!c.image));
  assert(!ux.includes('transform:'));
  for(let kind=1;kind<=7;kind++) assert(fs.existsSync(new URL('../src/common/black-'+kind+'.png',import.meta.url)));
  human(h.p);h.p.select(27);h.p.select(36);h.p.confirmMove();
  assert.equal(h.p.rows[3].cells[0].image,'');
  assert.equal(h.p.rows[4].cells[0].image,'/common/black-7.png');
  h.p.takeBack();assert.equal(h.p.rows[3].cells[0].image,'/common/black-7.png');
  h.p.chooseLevel(3);h.p.startNew();assert(h.p.rows.flatMap(r=>r.cells).every(c=>!c.image));
});

test('local saved games restore all black images and image failures fall back to visible text',()=>{
  const h=harness({saved:engine.encode(engine.newGame(),'local')});
  assert.equal(h.p.rows.flatMap(r=>r.cells).filter(c=>c.image).length,16);
  h.p.glyphError();
  assert(h.p.rows.flatMap(r=>r.cells).every(c=>!c.image));
  assert(h.p.rows[0].cells.every(c=>c.text&&c.cls.includes('black')));
  human(h.p);h.p.select(27);h.p.select(36);h.p.confirmMove();
  assert.equal(h.p.rows[4].cells[0].text,'卒');assert.equal(h.p.moveCount,2);
  assert(h.p.rows.flatMap(r=>r.cells).every(c=>!c.image));
});
test('full-screen panels use removal, not hidden occupied board space',()=>{
  assert(!ux.includes('show="{{screen'));
  assert(ux.includes('class="board-view" if="{{screen === \'board\'}}"'));
});

test('author and support navigation pauses AI without changing saves or the game',()=>{
  const h=harness();human(h.p);const saved=h.writes.at(-1).value,count=h.writes.length;
  h.p.openMenu();h.p.showAuthor();assert.equal(h.p.screen,'author');assert.equal(h.timers.size,0);
  for(const channel of ['wechat','alipay']) {
    h.p.showSupport(channel);assert.equal(h.p.screen,'support');
    assert.equal(h.p.supportImage,'/common/support-'+channel+'.png');
    assert.equal(h.p.onBackPress(),true);assert.equal(h.p.screen,'author');
  }
  h.p.showSupport('invalid');assert.equal(h.p.screen,'author');
  assert.equal(h.writes.length,count);assert.equal(h.writes.at(-1).value,saved);assert.equal(h.p.moveCount,1);
  h.p.onBackPress();assert.equal(h.p.screen,'menu');h.p.resume();h.drain();assert.equal(h.p.moveCount,2);
});

test('startup lasts 2000ms once and delays a saved AI turn until it finishes',()=>{
  const game=engine.newGame();engine.play(game,54,45);
  const h=harness({splash:true,saved:engine.encode(game,'ai')});
  assert.equal(h.p.screen,'splash');assert.equal(h.p.moveCount,1);
  assert.equal(h.timers.size,1);assert.equal(h.delays.at(-1),2000);
  h.p.onReady();h.p.onShow();assert.equal(h.timers.size,1);
  h.tick();assert.equal(h.p.screen,'board');h.drain();assert.equal(h.p.moveCount,2);
  h.p.onHide();h.p.onShow();assert.equal(h.p.screen,'board');assert.equal(h.timers.size,0);
});

test('leaving or destroying during startup clears its timer and stale callbacks are harmless',()=>{
  const h=harness({splash:true});const stale=[...h.timers.values()][0];
  h.p.onHide();assert.equal(h.timers.size,0);assert.equal(h.p.screen,'board');
  h.p.onShow();stale();assert.equal(h.p.screen,'board');assert.equal(h.p.moveCount,0);
  const other=harness({splash:true});const late=[...other.timers.values()][0];
  other.p.onDestroy();late();assert.equal(other.timers.size,0);assert.equal(other.p.moveCount,0);
});

test('fifth-level deep thinking can be paused and resumed without a late or duplicate move',()=>{
  const h=harness();h.p.chooseLevel(5);h.p.startNew();human(h.p);
  for(let i=0;i<20;i++)h.tick();assert.equal(h.p.moveCount,1);
  const stale=[...h.timers.values()][0];h.p.openMenu();assert.equal(h.timers.size,0);
  stale();assert.equal(h.p.moveCount,1);h.p.resume();h.drain();
  assert.equal(h.p.moveCount,2);assert.match(h.p.heading,/红方走/);
});
