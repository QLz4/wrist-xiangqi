// Independent implementation of classical PVS/TT/history search architecture.
// No XQWLight source, piece-square tables or opening book are incorporated.
import {legalMoves, inCheck, createSearch} from './engine.js'

export const MASTER_LIMITS = {depth:8, nodes:32000, budget:3000, sliceMs:6, sliceNodes:24, tableSize:2048, quietDepth:6, maxPly:24};
const MASTER_VALUE=[0,20000,125,125,310,620,340,100], MASTER_MATE=30000;
const MASTER_EXACT=1, MASTER_LOWER=2, MASTER_UPPER=3;

// Positional values are specific to this game, computed from board geometry.
function masterPieceValue(p, at) {
  const t=Math.abs(p),r=Math.floor(at/9),c=at%9,advance=p>0?9-r:r,centre=4-Math.abs(c-4);
  let v=MASTER_VALUE[t];
  if(t===7)v+=advance*7+(advance>=5?55+centre*9:centre*2);
  if(t===4)v+=centre*8+Math.min(advance,6)*4-(c===0||c===8?12:0);
  if(t===5)v+=centre*2+Math.min(advance,7)*3;
  if(t===6)v+=centre*5+(advance>=2&&advance<=6?12:0);
  if(t===2||t===3)v+=advance<=4?8:0;
  return v*(p>0?1:-1);
}
function masterCode(m){return m.from*90+m.to+1;}

export function createMasterSearch(board, turn, options) {
  options=options||{};
  const cfg=MASTER_LIMITS, now=options.now||Date.now, started=now();
  const budget=options.budgetMs===undefined?cfg.budget:Math.max(0,options.budgetMs);
  const nodeLimit=options.maxNodes===undefined?cfg.nodes:Math.max(0,options.maxNodes);
  const maxDepth=options.maxDepth===undefined?cfg.depth:Math.max(1,Math.min(cfg.depth,options.maxDepth));
  const b=board.slice(), size=cfg.tableSize;
  // Fixed-size caches, allocated only when the fifth level is used.
  const ttKey=new Uint32Array(size),ttLock=new Uint32Array(size),ttDepth=new Uint8Array(size);
  const ttFlag=new Uint8Array(size),ttScore=new Int32Array(size),ttMove=new Uint16Array(size),ttQuiet=new Uint8Array(size);
  const killers=new Uint16Array(cfg.maxPly*2),historyScore=new Uint16Array(8101);
  const z1=new Uint32Array(1261),z2=new Uint32Array(1261);
  let seed=0x51a9c37d;
  function random32(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed>>>0;}
  for(let i=0;i<1261;i++){z1[i]=random32();z2[i]=random32();}
  function zi(p,at){return ((p>0?p-1:7-p-1)*90)+at;}
  function hashes(position,s){let a=s===1?z1[1260]:0,c=s===1?z2[1260]:0;for(let i=0;i<90;i++)if(position[i]){const j=zi(position[i],i);a^=z1[j];c^=z2[j];}return [a>>>0,c>>>0];}
  const initial=hashes(b,turn);let hash=initial[0],lock=initial[1],staticScore=0;
  for(let i=0;i<90;i++)if(b[i])staticScore+=masterPieceValue(b[i],i);
  const repetitions=new Map();
  function positionId(){return hash+':'+lock;}
  // A captured piece cannot reappear: earlier positions cannot repeat. The game
  // draws after 120 quiet plies, so at most 120 prior positions need parsing.
  const prior=(options.history||[]).slice(-Math.min(120,options.quiet===undefined?120:options.quiet+1));
  for(let i=0;i<prior.length;i++){
    const parts=prior[i].split('/'),position=parts[0].split(',').map(Number);
    if(position.length!==90)continue;
    const h=hashes(position,Number(parts[1])),id=h[0]+':'+h[1];
    repetitions.set(id,(repetitions.get(id)||0)+1);
  }
  if(!repetitions.has(positionId()))repetitions.set(positionId(),1);
  const fast=createSearch(b,turn,{now:now,budgetMs:Math.min(250,budget)});
  let best=null,done=false,baselineDone=false,iterator=null,nodes=0,depthDone=0,scoreDone=0,ttHits=0,cutoffs=0;

  function make(m){
    const p=b[m.from],cap=b[m.to],saved={p:p,cap:cap,hash:hash,lock:lock,score:staticScore};
    const from=zi(p,m.from),to=zi(p,m.to);
    hash^=z1[from]^z1[to]^z1[1260];lock^=z2[from]^z2[to]^z2[1260];
    if(cap){const c=zi(cap,m.to);hash^=z1[c];lock^=z2[c];}
    hash>>>=0;lock>>>=0;
    staticScore+=masterPieceValue(p,m.to)-masterPieceValue(p,m.from)-(cap?masterPieceValue(cap,m.to):0);
    b[m.from]=0;b[m.to]=p;
    const id=positionId();repetitions.set(id,(repetitions.get(id)||0)+1);
    return saved;
  }
  function unmake(m,saved){
    const id=positionId(),count=repetitions.get(id)-1;
    if(count)repetitions.set(id,count);else repetitions.delete(id);
    b[m.from]=saved.p;b[m.to]=saved.cap;hash=saved.hash;lock=saved.lock;staticScore=saved.score;
  }
  function evaluateMaster(s){
    let dynamic=0;
    for(let i=0;i<90;i++){
      const p=b[i],t=Math.abs(p);if(!p)continue;
      const owner=p>0?1:-1,r=Math.floor(i/9),c=i%9;
      if(t===4){
        let free=0;
        if(r>1&&!b[i-9])free++;if(r<8&&!b[i+9])free++;
        if(c>1&&!b[i-1])free++;if(c<7&&!b[i+1])free++;
        dynamic+=owner*(free*9-18);
      } else if(t===5){
        let mobility=0;
        for(const step of [-9,9,-1,1])for(let j=i+step;j>=0&&j<90;j+=step){
          if(Math.abs(step)===1&&Math.floor(j/9)!==r)break;
          if(b[j])break;mobility++;
        }
        dynamic+=owner*mobility*2;
      } else if(t===1){
        // Keep defensive cover valuable, particularly after central files open.
        const front=i-owner*9;
        if(front>=0&&front<90&&b[front]*owner>0)dynamic+=owner*12;
      }
    }
    return (staticScore+dynamic)*s+8;
  }
  function ordered(moves,hashMove,ply){
    const k1=killers[ply*2],k2=killers[ply*2+1];
    for(let i=0;i<moves.length;i++){
      const m=moves[i],code=masterCode(m),cap=Math.abs(b[m.to]);
      m.order=code===hashMove?2000000:cap?1000000+MASTER_VALUE[cap]*16-MASTER_VALUE[Math.abs(b[m.from])]:
        code===k1?900000:code===k2?800000:historyScore[code];
    }
    moves.sort((a,c)=>c.order-a.order);return moves;
  }
  function remember(m,depth,ply){
    if(b[m.to])return;
    const code=masterCode(m),at=ply*2;
    if(killers[at]!==code){killers[at+1]=killers[at];killers[at]=code;}
    historyScore[code]=Math.min(60000,historyScore[code]+depth*depth*8);
  }
  function mateToTable(value,ply){return value>29000?value+ply:value< -29000?value-ply:value;}
  function mateFromTable(value,ply){return value>29000?value-ply:value< -29000?value+ply:value;}

  function* search(s,depth,alpha,beta,ply,quiet,qleft,extensions){
    nodes++;yield null;
    const count=repetitions.get(positionId())||0;
    // Match the game's draw rule, including mate taking precedence over a draw.
    if(count>=3||quiet>=120)return legalMoves(b,s,undefined,true).length?0:-MASTER_MATE+ply;
    const checked=inCheck(b,s);
    if(ply>=cfg.maxPly)return legalMoves(b,s,undefined,true).length?evaluateMaster(s)-(checked?70:0):-MASTER_MATE+ply;
    if(depth>0&&checked&&extensions<2){depth++;extensions++;}
    const originalAlpha=alpha,index=hash&(size-1);
    const match=ttFlag[index]&&ttKey[index]===hash&&ttLock[index]===lock;
    const hashMove=match?ttMove[index]:0;
    // Repeated positions are path-dependent; do not reuse their cached bounds.
    if(depth>0&&count===1&&match&&ttDepth[index]>=depth&&ttQuiet[index]===quiet){
      const value=mateFromTable(ttScore[index],ply);ttHits++;
      if(ttFlag[index]===MASTER_EXACT||(ttFlag[index]===MASTER_LOWER&&value>=beta)||(ttFlag[index]===MASTER_UPPER&&value<=alpha))return value;
    }
    let moves=legalMoves(b,s);
    if(!moves.length)return -MASTER_MATE+ply;
    let value=-Infinity;
    if(depth<=0&&!checked){
      value=evaluateMaster(s);
      if(value>=beta)return value;
      if(value>alpha)alpha=value;
      if(qleft<=0)return value;
      moves=moves.filter(m=>b[m.to]!==0);
      if(!moves.length)return value;
    }
    // All evasions are searched while in check; no stand-pat in a checking line.
    ordered(moves,hashMove,ply);
    let bestCode=0;
    for(let i=0;i<moves.length;i++){
      const m=moves[i],saved=make(m),nextQuiet=saved.cap?0:quiet+1;
      let score;
      try {
        if(i===0||depth<=0)score=-(yield* search(-s,depth-1,-beta,-alpha,ply+1,nextQuiet,depth<=0?qleft-1:qleft,extensions));
        else {
          score=-(yield* search(-s,depth-1,-alpha-1,-alpha,ply+1,nextQuiet,qleft,extensions));
          if(score>alpha&&score<beta)score=-(yield* search(-s,depth-1,-beta,-alpha,ply+1,nextQuiet,qleft,extensions));
        }
      } finally {unmake(m,saved);}
      if(score>value){value=score;bestCode=masterCode(m);}
      if(score>alpha)alpha=score;
      if(alpha>=beta){cutoffs++;if(depth>0)remember(m,depth,ply);break;}
    }
    if(depth>0&&count===1){
      ttKey[index]=hash;ttLock[index]=lock;ttDepth[index]=depth;ttQuiet[index]=quiet;
      ttScore[index]=mateToTable(value,ply);ttMove[index]=bestCode;
      ttFlag[index]=value<=originalAlpha?MASTER_UPPER:value>=beta?MASTER_LOWER:MASTER_EXACT;
    }
    return value;
  }
  function* deepen(){
    let roots=legalMoves(b,turn);
    for(let depth=1;depth<=maxDepth;depth++){
      ordered(roots,best?masterCode(best):0,0);
      let value=-Infinity,iterationBest=null,alpha=-MASTER_MATE;
      for(let i=0;i<roots.length;i++){
        const m=roots[i],saved=make(m),quiet=saved.cap?0:(options.quiet||0)+1;
        let score;
        try {
          if(i===0)score=-(yield* search(-turn,depth-1,-MASTER_MATE,-alpha,1,quiet,cfg.quietDepth,0));
          else {
            score=-(yield* search(-turn,depth-1,-alpha-1,-alpha,1,quiet,cfg.quietDepth,0));
            if(score>alpha)score=-(yield* search(-turn,depth-1,-MASTER_MATE,-alpha,1,quiet,cfg.quietDepth,0));
          }
        } finally {unmake(m,saved);}
        if(score>value){value=score;iterationBest={from:m.from,to:m.to};}
        alpha=Math.max(alpha,score);
        if(score>=MASTER_MATE-2){best=iterationBest;depthDone=depth;scoreDone=score;return;}
      }
      // An interrupted iteration must never replace a fully completed one.
      if(iterationBest){best=iterationBest;depthDone=depth;scoreDone=value;}
    }
  }
  function finish(){done=true;if(iterator){iterator.return();iterator=null;}}
  function result(){return {done:done,move:best,nodes:nodes,depth:depthDone,score:scoreDone||0,level:5,engine:'pvs-master',ttHits:ttHits,cutoffs:cutoffs};}
  return {
    step(){
      if(done)return result();
      if(!baselineDone){const r=fast.step();best=r.move;baselineDone=r.done;if(r.done&&(!best||now()-started>=budget||nodeLimit===0))finish();return result();}
      if(!iterator)iterator=deepen();
      const begin=now();let work=0;
      while(!done&&work<cfg.sliceNodes){
        if(nodes>=nodeLimit||now()-started>=budget){finish();break;}
        const r=iterator.next();work++;
        if(r.done){finish();break;}
        if(now()-begin>=cfg.sliceMs)break;
      }
      return result();
    },
    cancel(){finish();}
  };
}
