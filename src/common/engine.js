// Pure Xiangqi rules. Positive pieces are red, rank zero is black's back rank.
export const KING = 1, ADVISOR = 2, ELEPHANT = 3, HORSE = 4, ROOK = 5, CANNON = 6, PAWN = 7;
const VALUES = [0, 20000, 120, 120, 300, 600, 320, 90];
const RED = ['', '帅', '仕', '相', '马', '车', '炮', '兵'];
const BLACK = ['', '将', '士', '象', '马', '车', '炮', '卒'];
export function side(piece) { return piece > 0 ? 1 : piece < 0 ? -1 : 0; }
export function label(piece) { return (piece > 0 ? RED : BLACK)[Math.abs(piece)] || ''; }
export function squareName(index) { return String.fromCharCode(65 + index % 9) + (10 - Math.floor(index / 9)); }
export function initialBoard() {
  const b = Array(90).fill(0), back = [5, 4, 3, 2, 1, 2, 3, 4, 5];
  for (let c = 0; c < 9; c++) { b[c] = -back[c]; b[81 + c] = back[c]; }
  b[19] = b[25] = -6; b[64] = b[70] = 6;
  for (let c = 0; c < 9; c += 2) { b[27 + c] = -7; b[54 + c] = 7; }
  return b;
}
function inside(r, c) { return r >= 0 && r < 10 && c >= 0 && c < 9; }
function palace(r, c, s) { return c >= 3 && c <= 5 && (s === 1 ? r >= 7 && r <= 9 : r >= 0 && r <= 2); }
export function pseudoMoves(b, from) {
  const p = b[from], s = side(p), t = Math.abs(p), r = Math.floor(from / 9), c = from % 9, out = [];
  if (!s) return out;
  function add(rr, cc) { if (inside(rr, cc) && side(b[rr * 9 + cc]) !== s) out.push(rr * 9 + cc); }
  if (t === ROOK || t === CANNON) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let d = 0; d < 4; d++) {
      let rr = r + dirs[d][0], cc = c + dirs[d][1], screen = false;
      while (inside(rr, cc)) {
        const q = b[rr * 9 + cc];
        if (!screen) {
          if (!q) add(rr, cc);
          else if (t === ROOK) { add(rr, cc); break; }
          else screen = true;
        } else if (q) { add(rr, cc); break; }
        rr += dirs[d][0]; cc += dirs[d][1];
      }
    }
  } else if (t === HORSE) {
    const jumps = [[-2,-1,-1,0],[-2,1,-1,0],[2,-1,1,0],[2,1,1,0],[-1,-2,0,-1],[1,-2,0,-1],[-1,2,0,1],[1,2,0,1]];
    for (let i = 0; i < jumps.length; i++) {
      const j = jumps[i], lr = r + j[2], lc = c + j[3];
      if (inside(lr, lc) && !b[lr * 9 + lc]) add(r + j[0], c + j[1]);
    }
  } else if (t === ELEPHANT || t === ADVISOR) {
    const distance = t === ELEPHANT ? 2 : 1;
    for (let dr = -1; dr <= 1; dr += 2) for (let dc = -1; dc <= 1; dc += 2) {
      const rr = r + dr * distance, cc = c + dc * distance;
      if (t === ADVISOR && palace(rr, cc, s)) add(rr, cc);
      if (t === ELEPHANT && inside(rr, cc) && (s === 1 ? rr >= 5 : rr <= 4) && !b[(r + dr) * 9 + c + dc]) add(rr, cc);
    }
  } else if (t === KING) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    for (let i = 0; i < 4; i++) { const rr = r + dirs[i][0], cc = c + dirs[i][1]; if (palace(rr,cc,s)) add(rr,cc); }
    for (let rr = r - s; inside(rr, c); rr -= s) {
      if (b[rr * 9 + c]) { if (b[rr * 9 + c] === -s * KING) out.push(rr * 9 + c); break; }
    }
  } else if (t === PAWN) {
    add(r - s, c);
    if (s === 1 ? r <= 4 : r >= 5) { add(r, c - 1); add(r, c + 1); }
  }
  return out;
}
// Attack test without generating move arrays for every opposing piece.
export function isAttacked(b, to, attacker) {
  const tr = Math.floor(to / 9), tc = to % 9;
  for (let from = 0; from < 90; from++) {
    const p = b[from];
    if (side(p) !== attacker || from === to) continue;
    const type = Math.abs(p), r = Math.floor(from / 9), c = from % 9;
    const dr = tr - r, dc = tc - c, ar = Math.abs(dr), ac = Math.abs(dc);
    if (type === PAWN) {
      if ((dc === 0 && dr === -attacker) || (dr === 0 && ac === 1 && (attacker === 1 ? r <= 4 : r >= 5))) return true;
    } else if (type === HORSE) {
      if (ar === 2 && ac === 1 && !b[from + (dr > 0 ? 9 : -9)]) return true;
      if (ar === 1 && ac === 2 && !b[from + (dc > 0 ? 1 : -1)]) return true;
    } else if (type === ADVISOR) {
      if (ar === 1 && ac === 1 && palace(tr, tc, attacker)) return true;
    } else if (type === ELEPHANT) {
      if (ar === 2 && ac === 2 && (attacker === 1 ? tr >= 5 : tr <= 4) && !b[from + dr / 2 * 9 + dc / 2]) return true;
    } else {
      if (type === KING && ar + ac === 1 && palace(tr, tc, attacker)) return true;
      const flyingKing = type === KING && dc === 0 && b[to] === -attacker * KING && dr * attacker < 0;
      if ((type !== ROOK && type !== CANNON && !flyingKing) || (dr !== 0 && dc !== 0)) continue;
      const step = dr === 0 ? (dc > 0 ? 1 : -1) : (dr > 0 ? 9 : -9);
      let blockers = 0;
      for (let at = from + step; at !== to; at += step) if (b[at]) blockers++;
      if (blockers === (type === CANNON ? 1 : 0)) return true;
    }
  }
  return false;
}
export function inCheck(b, s) {
  const king = b.indexOf(s * KING);
  return king < 0 || isAttacked(b, king, -s);
}
export function legalMoves(b, s, onlyFrom, firstOnly) {
  const moves = [], start = onlyFrom === undefined ? 0 : onlyFrom, end = onlyFrom === undefined ? 90 : onlyFrom + 1;
  for (let from = start; from < end; from++) {
    if (side(b[from]) !== s) continue;
    const candidates = pseudoMoves(b, from);
    for (let j = 0; j < candidates.length; j++) {
      const to = candidates[j], captured = b[to], piece = b[from];
      if (Math.abs(captured) === KING) continue;
      b[to] = piece; b[from] = 0;
      const safe = !inCheck(b, s);
      b[from] = piece; b[to] = captured;
      if (safe) {
        moves.push({ from: from, to: to });
        if (firstOnly) return moves;
      }
    }
  }
  return moves;
}
export function key(b, turn) { return b.join(',') + '/' + turn; }
export function newGame() {
  const board = initialBoard();
  return { board: board, turn: 1, quiet: 0, moves: [], keys: [key(board, 1)], result: '' };
}
export function outcome(g) {
  if (!legalMoves(g.board, g.turn, undefined, true).length) return g.turn === 1 ? 'black' : 'red';
  const current = key(g.board, g.turn);
  if (g.quiet >= 120 || g.keys.filter(k => k === current).length >= 3) return 'draw';
  return '';
}
export function play(g, from, to) {
  if (g.result || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= 90 || to < 0 || to >= 90) return false;
  if (!legalMoves(g.board, g.turn, from).some(m => m.to === to)) return false;
  const piece = g.board[from], captured = g.board[to];
  g.moves.push({ from: from, to: to, piece: piece, captured: captured, quiet: g.quiet });
  g.board[to] = piece; g.board[from] = 0; g.turn = -g.turn;
  g.quiet = captured ? 0 : g.quiet + 1;
  g.keys.push(key(g.board, g.turn)); g.result = outcome(g);
  return true;
}
export function undo(g) {
  if (!g.moves.length) return false;
  const m = g.moves.pop();
  g.board[m.from] = m.piece; g.board[m.to] = m.captured; g.turn = side(m.piece);
  g.quiet = m.quiet; g.keys.pop(); g.result = ''; return true;
}
export function encode(g, mode, progress) {
  progress = progress || {level: 1, cleared: []};
  return JSON.stringify({ version: 2, mode: mode, level: progress.level, cleared: progress.cleared,
    moves: g.moves.map(m => [m.from, m.to]) });
}
export function decode(text) {
  const saved = JSON.parse(text);
  if (!saved || ![1,2].includes(saved.version) || !['ai','local'].includes(saved.mode) || !Array.isArray(saved.moves) || saved.moves.length > 2000) throw new Error('不支持的存档');
  const level = saved.version === 1 ? 1 : saved.level, cleared = saved.version === 1 ? [] : saved.cleared;
  if (!Number.isInteger(level) || level < 1 || level > 5 || !Array.isArray(cleared) || cleared.length > 5 ||
    cleared.some((n,i) => !Number.isInteger(n) || n < 1 || n > 5 || cleared.indexOf(n) !== i)) throw new Error('关卡存档无效');
  const game = newGame();
  for (let i = 0; i < saved.moves.length; i++) {
    const m = saved.moves[i];
    if (!Array.isArray(m) || m.length !== 2 || !play(game, m[0], m[1])) throw new Error('存档走法无效');
  }
  return { game: game, mode: saved.mode, level: level, cleared: cleared.slice() };
}
export function evaluate(b, s) {
  let score = 0;
  for (let i = 0; i < 90; i++) {
    const p = b[i]; if (!p) continue;
    const t = Math.abs(p), owner = side(p), row = Math.floor(i / 9), advance = owner === 1 ? 9-row : row;
    let v = VALUES[t];
    if (t === PAWN) v += advance * 6 + (advance >= 5 ? 45 : 0);
    if (t === HORSE || t === CANNON) v += (4 - Math.abs(4 - i % 9)) * 4;
    score += v * owner * s;
  }
  return score;
}
// Fast entry-level AI: evaluate legal moves, captures, development and hanging pieces.
// No opponent move-tree expansion. Each slice has both a time and a move limit.
// A legal fallback is available even when the total scoring budget expires.
export function createSearch(board, turn, options) {
  options = options || {};
  const now = options.now || Date.now, started = now();
  const budget = options.budgetMs === undefined ? 350 : Math.max(0, options.budgetMs);
  const b = board.slice(), roots = legalMoves(b, turn);
  roots.sort((a,c) => VALUES[Math.abs(b[c.to])] - VALUES[Math.abs(b[a.to])]);
  let cursor = 0, best = roots[0] || null, bestScore = -Infinity;
  let complete = roots.length === 0;
  return {
    step() {
      if (complete) return { done: true, move: best, evaluated: cursor };
      const sliceStart = now();
      let count = 0;
      while (cursor < roots.length && count < 8) {
        if (now() - started >= budget) { complete = true; break; }
        const m = roots[cursor++], p = b[m.from], cap = b[m.to];
        b[m.to] = p; b[m.from] = 0;
        let score;
        try {
          score = evaluate(b, turn);
          if (Math.abs(p) !== KING && isAttacked(b, m.to, -turn)) score -= VALUES[Math.abs(p)] * 0.85;
          if (inCheck(b, -turn)) score += 18;
          // Develop early and break otherwise identical choices predictably.
          score += (4 - Math.abs(4 - m.to % 9)) * 0.1;
          if (options.noise) score += ((options.random || Math.random)() - 0.5) * options.noise;
        } finally { b[m.from] = p; b[m.to] = cap; }
        if (score > bestScore) { bestScore = score; best = m; }
        count++;
        if (now() - sliceStart >= 8) break;
      }
      complete = complete || cursor >= roots.length || now() - started >= budget;
      return { done: complete, move: best, evaluated: cursor };
    }
  };
}
