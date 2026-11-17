'use strict';
/* CPU players. The CPU never looks at hidden cards: before it thinks ahead, the cards it can't see (your hand and
   the deck) are reshuffled. It plays out many random ways to finish the turn, scores where each one leaves it,
   and on the higher levels also checks the opponent's best replies. */
const LEVELS = {
  easy:   {lines: 10,  top: 0,  reps: 0,  deep: 0,  blunder: 0.3,  noise: 14},
  normal: {lines: 60,  top: 0,  reps: 0,  deep: 0,  blunder: 0.06, noise: 4},
  hard:   {lines: 120, top: 8,  reps: 14, deep: 0,  blunder: 0,    noise: 0},
  expert: {lines: 500, top: 16, reps: 36, deep: 8,  blunder: 0,    noise: 0},
};
function posVal(S, p) {
  if (S.away[p]) return 5;
  const d = S.dragon === 0 ? S.pos[p] : LAST - S.pos[p];   // 0 = the tile next to the Dragon, 20 = far end
  if (d <= 4) return -(28 + 8 * (5 - d));
  if (d >= 16) return 26 + (S.hand[p].some(c => ACTIONS[c].move) ? 40 : 0);
  return (d - 10) * 2.6 - (d <= 7 ? (8 - d) * 3 : 0);
}
function evalS(S, me) {
  if (S.winner != null) return S.winner === me ? 1e6 - S.turn : S.winner === 1 - me ? -1e6 + S.turn : 0;
  const o = 1 - me;
  return 4 * (S.ready[me] - S.ready[o]) + 1.5 * (S.gems[me] + S.aside[me] - S.gems[o] - S.aside[o]) + 9 * (S.items[me].length - S.items[o].length)
    + (S.white[me] - S.white[o]) + 0.8 * (S.hand[me].length - S.hand[o].length) + posVal(S, me) - posVal(S, o);
}
const randPolicy = q => Math.floor(Math.random() * q.opts.length);
function aiChoose(G, level) {
  const q = G.req, me = q.p, n = q.opts.length, L = LEVELS[level] || LEVELS.normal;
  if (n === 1) return 0;
  if (Math.random() < L.blunder) return randPolicy(q);
  const mine = G.S.cur === me, per = Math.max(2, Math.ceil(L.lines / n)), lines = [];
  for (let i = 0; i < n; i++) for (let k = 0; k < per; k++) {
    const rec = [], decs = G.decs.concat(i), det = {me, pts: {}};
    const S = simulate(G.snap, decs, randPolicy, 1, det, rec);
    lines.push({i, det, decs: decs.concat(rec), v: evalS(S, me) + (Math.random() - 0.5) * L.noise, done: S.winner != null});
  }
  lines.sort((a, b) => b.v - a.v);
  if (L.top && mine) {
    for (const ln of lines.slice(0, L.top)) {
      if (ln.done) continue;
      let worst = Infinity;
      for (let r = 0; r < L.reps; r++) {
        const rec = [], det = {me, pts: Object.assign({}, ln.det.pts)}, S = simulate(G.snap, ln.decs, randPolicy, 2, det, rec);
        let v = evalS(S, me);
        if (L.deep && S.winner == null && r < L.deep * 2) {   // and my best answer to that reply
          let best = -Infinity; const d2 = ln.decs.concat(rec);
          for (let k = 0; k < L.deep; k++) best = Math.max(best, evalS(simulate(G.snap, d2, randPolicy, 3, {me, pts: Object.assign({}, det.pts)}), me));
          v = 0.5 * v + 0.5 * best;
        }
        if (v < worst) worst = v;
      }
      ln.v = Math.min(ln.v, worst) * 0.7 + worst * 0.3;
    }
    const top = lines.slice(0, L.top).sort((a, b) => b.v - a.v);
    return top[0].i;
  }
  return lines[0].i;
}

/* ---------- exact search, for puzzles ---------- */
function probe(snap, decs, turns) {   // replay decs; stop at the next choice, or after `turns` turns
  const S = clone(snap), g = play(S); let r = g.next(), n = 0, i = 0;
  for (;;) {
    if (r.done) return {S, req: null};
    const q = r.value;
    if (q.kind === 'turn') { if (++n > turns) return {S, req: null}; r = g.next(); continue; }
    if (i >= decs.length) return {S, req: q, turnNo: n};
    r = g.next(decs[i++]);
  }
}
/* Can `me` force a win within `turns` turns of the snapshot (default: before the end of the opponent's next turn),
   whatever the opponent does? ctx = {n: node budget} */
function forcedWin(snap, decs, me, ctx, turns = 2) {
  if (--ctx.n < 0) { ctx.cut = true; return false; }
  const r = probe(snap, decs, turns);
  if (r.S.winner === me) return true;
  if (r.S.winner != null || !r.req) return false;
  const mine = r.req.p === me;
  for (let i = 0; i < r.req.opts.length; i++) { const w = forcedWin(snap, decs.concat(i), me, ctx, turns); if (mine && w) return true; if (!mine && !w) return false; }
  return !mine;
}
/* The puzzle opponent, on its own turn: any choice that still lets it survive the turn, if there is one. */
function puzzleReply(G, me) {
  const q = G.req, own = G.S.cur !== me;
  for (let i = 0; i < q.opts.length; i++) { const ctx = {n: 20000}; if (!forcedWin(G.snap, G.decs.concat(i), me, ctx, own ? 1 : 2) && !ctx.cut) return i; }
  return 0;
}
