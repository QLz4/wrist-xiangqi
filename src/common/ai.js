import {createSearch, legalMoves, inCheck, evaluate, key} from './engine.js'

export const LEVELS = [
  {id:1, name:'入门', depth:1, nodes:0, budget:350, quietDepth:0, noise:32, detail:'轻量判断吃子与危险，适合练习。'},
  {id:2, name:'初学', depth:2, nodes:700, budget:650, quietDepth:0, noise:12, detail:'计算你的回应，减少直接送子。'},
  {id:3, name:'进阶', depth:3, nodes:2200, budget:1000, quietDepth:0, noise:6, detail:'继续推演攻防，避开重复走子。'},
  {id:4, name:'挑战', depth:4, nodes:5500, budget:1500, quietDepth:1, noise:2, detail:'延伸吃子与应将，判断交换得失。'},
  {id:5, name:'决胜', depth:5, nodes:12000, budget:2200, quietDepth:2, noise:0, detail:'本作最高难度，更深推演与攻防。'}
];
const AI_VALUES = [0,20000,120,120,300,600,320,90], MATE = 100000;

// Cooperative iterative deepening. A generator yields at each search node, so
// even the strongest level can be cancelled between bounded slices on the watch.
export function createOpponentSearch(board, turn, options) {
  options = options || {};
  const level = Math.max(1, Math.min(5, options.level || 1)), config = LEVELS[level-1];
  const now = options.now || Date.now, started = now(), random = options.random || Math.random;
  const budget = options.budgetMs === undefined ? config.budget : Math.max(0, options.budgetMs);
  const nodeLimit = options.maxNodes === undefined ? config.nodes : Math.max(0, options.maxNodes);
  const b = board.slice(), history = options.history || [], quiet = options.quiet || 0;
  const fast = createSearch(b, turn, {now:now, budgetMs:Math.min(350,budget), noise:config.noise, random:random});
  let best = null, baselineDone = false, done = false, iterator = null, nodes = 0, depthDone = 0;
  let roots = [];

  function order(moves) {
    for (let i=0;i<moves.length;i++) {
      const m=moves[i]; m.order=AI_VALUES[Math.abs(b[m.to])]*16-AI_VALUES[Math.abs(b[m.from])];
    }
    moves.sort((a,c)=>c.order-a.order);
    return moves;
  }
  function* negamax(s, depth, alpha, beta, ply, qleft) {
    nodes++; yield null;
    let moves=legalMoves(b,s);
    if (!moves.length) return -MATE+ply; // Stalemate is a loss in Xiangqi.
    if (depth<=0) {
      const stand=evaluate(b,s);
      if (qleft<=0) return stand;
      if (!inCheck(b,s)) {
        if (stand>=beta) return stand;
        if (stand>alpha) alpha=stand;
        moves=moves.filter(m=>b[m.to]!==0);
        if (!moves.length) return stand;
      }
    }
    order(moves);
    let bestValue=depth<=0&&!inCheck(b,s) ? alpha : -Infinity;
    for (let i=0;i<moves.length;i++) {
      const m=moves[i], p=b[m.from], captured=b[m.to]; b[m.to]=p; b[m.from]=0;
      let score;
      try { score=-(yield* negamax(-s,depth-1,-beta,-alpha,ply+1,depth<=0?qleft-1:qleft)); }
      finally { b[m.from]=p; b[m.to]=captured; }
      if (score>bestValue) bestValue=score;
      if (score>alpha) alpha=score;
      if (alpha>=beta) break;
    }
    return bestValue;
  }
  function* deepen() {
    roots=order(legalMoves(b,turn));
    // Randomise only move ordering among equal captures; no scripted opening.
    for (let i=0;i<roots.length;i++) roots[i].order += random()*0.1;
    roots.sort((a,c)=>c.order-a.order);
    if (best) { const at=roots.findIndex(m=>m.from===best.from&&m.to===best.to); if(at>0)roots.unshift(roots.splice(at,1)[0]); }
    for (let depth=2;depth<=config.depth;depth++) {
      let iterationBest=null, iterationScore=-Infinity, alpha=-Infinity;
      for (let i=0;i<roots.length;i++) {
        const m=roots[i], p=b[m.from], captured=b[m.to]; b[m.to]=p; b[m.from]=0;
        let score;
        try {
          const position=key(b,-turn);
          let repeats=0; for(let h=0;h<history.length;h++)if(history[h]===position)repeats++;
          if (repeats>=2 || (!captured && quiet>=119)) score=legalMoves(b,-turn,undefined,true).length ? 0 : MATE-1;
          else {
            // Share the root alpha bound; accept only a fully searched iteration.
            score=-(yield* negamax(-turn,depth-1,-Infinity,-alpha,1,config.quietDepth));
            if (repeats && Math.abs(score)<MATE/2) score-=level*4;
          }
        } finally { b[m.from]=p; b[m.to]=captured; }
        m.score=score;
        if(score>iterationScore){iterationScore=score;iterationBest=m;}
        alpha=Math.max(alpha,score);
        if(score>=MATE-2){best={from:m.from,to:m.to};depthDone=depth;return;}
      }
      if (iterationBest) best={from:iterationBest.from,to:iterationBest.to};
      depthDone=depth;
      roots.sort((a,c)=>c.score-a.score);
    }
  }
  function finish() {
    done=true;
    if(iterator){iterator.return();iterator=null;}
  }
  function result(){return {done:done,move:best,nodes:nodes,depth:depthDone,level:level};}
  return {
    step() {
      if(done)return result();
      if(!baselineDone){
        const r=fast.step();best=r.move;
        if(r.done){baselineDone=true;depthDone=best?1:0;}
        if(baselineDone && (level===1 || !best || now()-started>=budget))finish();
        return result();
      }
      if(!iterator)iterator=deepen();
      const sliceStart=now(); let work=0;
      while(work<24 && !done){
        if(nodes>=nodeLimit || now()-started>=budget){finish();break;}
        const r=iterator.next();work++;
        if(r.done){finish();break;}
        if(now()-sliceStart>=8)break;
      }
      return result();
    },
    cancel(){finish();}
  };
}
