'use strict';
/* CPU players.
   The CPU never looks at hidden cards: before it thinks ahead, the cards it can't see (your hand, apart from cards
   it has been shown, and the deck) are reshuffled.
   Normal and up look at every way to play out the rest of the turn (up to a budget) and score where each one
   leaves them. Hard and Expert then take the most promising of those and work through the opponent's replies to
   each, for several guesses at the opponent's hand, and pick the line whose worst case is best.
   Easy plays out a handful of random lines and sometimes just picks at random. */
const LEVELS = {
  easy:   {sample: 10, blunder: 0.3, noise: 14},
  normal: {own: 250,  top: 0,  dets: 0, opp: 0,   blunder: 0.05, noise: 5},
  hard:   {own: 900,  top: 5,  dets: 2, opp: 220, blunder: 0,    noise: 0},
  expert: {own: 2000, top: 8,  dets: 3, opp: 500, blunder: 0,    noise: 0},
};
/* How far player p could get themself in one turn: best Action card plus a Gem teleport. Used to spot a Wizard who
   cannot get out of the Threatened tiles. Generous on purpose (it ignores Hacks and Items that add more). */
function selfReach(S, p) {
  const h = S.hand[p], rdy = S.ready[p], tp = S.gelf[1 - p] ? 0 : 1;
  const mb = S.t && S.cur === p ? 0 : 0, extra = (has(S, p, 'skates') ? (e2(S) ? 1 : 2) : 0) + (S.power === 'leap' ? 1 : 0) + (has(S, p, 'blink') ? 5 : 0)
    + (isW(S, p, 'abragail') && (e2(S) ? rdy >= 2 : rdy === 1 || rdy === 2) ? 1 : 0) + (isW(S, p, 'may2') ? 1 : 0);
  const robot1 = isW(S, p, 'robot') && !e2(S), tpn = k => tp * Math.max(0, k + tpBonus(S, p));
  const one = c => c === 'hop' ? (robot1 ? 1 : 3) + extra : c === 'leap' ? (robot1 ? 1 : 2) + extra + (rdy > 0 ? tpn(2) : 0) : ACTIONS[c].move ? (robot1 ? 1 : 2) + extra : c === 'gale' ? tpn(1) : 0;
  let best = 0, gemUsed = false;
  for (const c of h) { const v = one(c); if (v > best) { best = v; gemUsed = c === 'leap' && rdy > 0; } }
  if (h.includes('step')) { let b2 = 0, g2 = false; h.forEach(c => { if (c !== 'step') { const v = one(c); if (v > b2) { b2 = v; g2 = c === 'leap' && rdy > 0; } } }); if (tpn(1) + b2 > best) { best = tpn(1) + b2; gemUsed = g2; } }
  let gem = rdy - (gemUsed ? 1 : 0) > 0 ? tpn(2) : 0;
  if (S.hacks.includes('sk8') && S.white[p] >= hackCost(S, p, 'sk8')) gem = Math.max(gem, tpn(3));
  if (S.hacks.includes('wyrm') && S.white[p] >= hackCost(S, p, 'wyrm')) gem = 99;
  if (isW(S, p, 'venice')) best += tpn(1);
  if (isW(S, p, 'bunny') && rdy > 0) gem = Math.max(gem, 3);
  return best + gem;
}
const dragDist = (S, p) => S.dragon === 0 ? S.pos[p] : LAST - S.pos[p];   // 0 = the tile next to the Dragon, 20 = far end
function canEscapeNow(S, p) {   // p is about to take a turn: is a win there for the taking?
  if (S.away[p]) return false;
  const d = dragDist(S, p), h = S.hand[p], mv = h.some(c => ACTIONS[c].move);
  if (d >= 16) return mv || isW(S, p, 'gelf') && h.some(c => ACTIONS[c].bump);
  if (isW(S, p, 'trevor')) return false;
  return mv && h.includes('step') && !S.gelf[1 - p] && d + Math.max(0, 1 + tpBonus(S, p)) >= 16;
}
function trapped(S, p) { if (S.away[p]) return false; const d = dragDist(S, p); return d <= 4 && selfReach(S, p) < 5 - d; }
/* Evaluation weights. A level can override any of them with `w: {...}` (used to A/B-test changes). */
const W0 = {gem: 4, own: 1.5, item: 9, white: 1, card: 0.8, tile: 2.6, exit: 26, exitMove: 40, threat: 28, deep: 8, near: 3, flight: 1, move: 0, bumpc: 0};
let EW = W0;
function tileVal(d, hasMove) {   // d: 0 = beside the Dragon ... 20 = the far (Exit) end
  if (d <= 4) return -(EW.threat + EW.deep * (5 - d));
  if (d >= 16) return EW.exit + (hasMove ? EW.exitMove : 0);
  return (d - 10) * EW.tile - (d <= 7 ? (8 - d) * EW.near : 0);
}
function flightSoon(S) {   // rough chance that the Dragon changes ends within a turn or so
  const gap = flightNeed(S) - wings(S); let p = gap <= 1 ? 0.6 : gap <= 3 ? 0.35 : gap <= 5 ? 0.15 : 0.05;
  if (S.nest.length >= 6 && gap > 3) p *= 0.3;   // a Roost will empty the Nest first
  return p;
}
function posVal(S, p) {
  if (S.away[p]) return 5;
  const d = dragDist(S, p), mv = S.hand[p].some(c => ACTIONS[c].move);
  let v = tileVal(d, mv);
  if (EW.flight) { const pf = EW.flight * flightSoon(S); v = (1 - pf) * v + pf * tileVal(LAST - d, mv); }
  if (EW.move || EW.bumpc) for (const c of S.hand[p]) v += (ACTIONS[c].move ? EW.move : 0) + (ACTIONS[c].bump ? EW.bumpc : 0);
  return v;
}
/* Scored at a turn boundary, from `me`'s side. S.cur is the player about to move. */
function evalS(S, me) {
  // Won or lost: sooner wins and later losses are better, and between equal ones the CPU still prefers to stand
  // further from the Dragon with more Gems, so that even a doomed Wizard doesn't walk toward it.
  if (S.winner != null) return S.winner === me ? 1e6 - 100 * S.turn : S.winner === 1 - me ? -1e6 + 100 * S.turn + (S.away[me] ? 0 : 20 * dragDist(S, me)) + 5 * S.ready[me] : 0;
  const o = 1 - me, m = S.cur;
  let v = EW.gem * (S.ready[me] - S.ready[o]) + EW.own * (S.gems[me] + S.aside[me] - S.gems[o] - S.aside[o]) + EW.item * (S.items[me].length - S.items[o].length)
    + EW.white * (S.white[me] - S.white[o]) + EW.card * (S.hand[me].length - S.hand[o].length) + posVal(S, me) - posVal(S, o);
  if (canEscapeNow(S, m)) v += m === me ? 4e5 : -4e5;
  else if (trapped(S, m)) v += m === me ? -4e5 : 4e5;
  return v;
}
const randPolicy = q => Math.floor(Math.random() * q.opts.length);
const sigOf = q => q.kind + '|' + q.p + '|' + q.opts.map(o => o.label).join('/');
const stateKey = S => JSON.stringify([S.pos, S.ready, S.gems, S.aside, S.items, S.white, S.nest, S.power, S.dragon, S.hand, S.away, S.gelf, S.winner]);
/* Every way the play can go from `decs` until `turns` turns have ended. `me` picks the best for itself, the other
   player the worst for `me`. ctx.n is a node budget: once it is spent, each choice explores one random option.
   ctx.leaves (optional) collects every end position reached. Returns {v, decs, sigs}. */
function searchTurn(snap, decs, me, det, turns, ctx, sigs) {
  const r = probe(snap, decs, turns, det);
  if (!r.req) { const leaf = {v: evalS(r.S, me), decs, sigs, S: r.S}; if (ctx.leaves) ctx.leaves.push(leaf); return leaf; }
  const q = r.req, mine = q.p === me, n = q.opts.length, s2 = sigs.concat(sigOf(q));
  let best = null;
  const tryOpt = i => { ctx.n--; const c = searchTurn(snap, decs.concat(i), me, det, turns, ctx, s2); if (!best || (mine ? c.v > best.v : c.v < best.v)) best = c; };
  if (ctx.n <= 0) tryOpt(Math.floor(Math.random() * n));
  else for (let i = 0; i < n; i++) { if (ctx.n <= 0 && best) break; tryOpt(i); if (ctx.stop && best && (mine ? best.v >= ctx.stop : false)) break; }
  return best;
}
function sampleChoose(G, L) {   // Easy
  const q = G.req, me = q.p, n = q.opts.length, per = Math.max(2, Math.ceil(L.sample / n));
  let bi = 0, bv = -Infinity;
  for (let i = 0; i < n; i++) for (let k = 0; k < per; k++) {
    const S = simulate(G.snap, G.decs.concat(i), randPolicy, 1, {me, pts: {}});
    const v = evalS(S, me) + (Math.random() - 0.5) * L.noise; if (v > bv) { bv = v; bi = i; }
  }
  return bi;
}
function aiChoose(G, level) {
  const q = G.req, me = q.p, n = q.opts.length, L = LEVELS[level] || LEVELS.normal;
  if (n === 1) return 0;
  if (Math.random() < L.blunder) {   // a careless pick, but never a step of its own toward the Dragon's Threatened tiles
    const S = G.S, d = t => S.dragon === 0 ? t : LAST - t, here = S.away[me] ? 99 : dragDist(S, me);
    const sane = q.opts.map((o, i) => i).filter(i => { const o = q.opts[i]; return !(o.tile != null && q.who === me && d(o.tile) <= 4 && d(o.tile) < here); });
    return sane.length ? sane[Math.floor(Math.random() * sane.length)] : randPolicy(q);
  }
  EW = L.w ? Object.assign({}, W0, L.w) : W0;
  if (L.sample) return sampleChoose(G, L);
  // still following the line worked out earlier this turn?
  const at = G.decs.length, pl = G._plan;
  if (pl && pl.snap === G.snap && pl.level === level && pl.me === me && pl.steps[at] && pl.steps[at].sig === sigOf(q) && pl.pre === G.decs.slice(0, pl.at).join()) {
    let okp = true; for (let k = pl.at; k < at; k++) if (!pl.steps[k] || pl.steps[k].i !== G.decs[k]) { okp = false; break; }
    if (okp && pl.steps[at].i < n) return pl.steps[at].i;
  }
  const mine = G.S.cur === me, det = {me, pts: {}};
  if (!q.noDet) det.pts[at] = Math.floor(Math.random() * 2 ** 31);
  const ctx = {n: L.own, leaves: []};
  let best = searchTurn(G.snap, G.decs, me, det, 1, ctx, []);
  if (L.noise) { for (const lf of ctx.leaves) lf.v += (Math.random() - 0.5) * L.noise; best = ctx.leaves.reduce((a, b) => b.v > a.v ? b : a); }
  if (L.top && mine && best.S.winner == null) {
    // the most promising distinct end positions, then the opponent's best reply to each
    const seen = new Set(), cand = [];
    for (const lf of ctx.leaves.slice().sort((a, b) => b.v - a.v)) { const k = stateKey(lf.S); if (seen.has(k)) continue; seen.add(k); cand.push(lf); if (cand.length >= L.top * 3) break; }
    let done = 0, top = null;
    for (const lf of cand) {
      if (done >= L.top && !(top.v2 < -1e5 && done < L.top * 3)) break;
      done++;
      if (lf.S.winner != null) { lf.v2 = lf.v; } else {
        let sum = 0;
        for (let d = 0; d < L.dets; d++) {
          const det2 = {me, pts: Object.assign({}, det.pts)}; det2.pts[lf.decs.length] = Math.floor(Math.random() * 2 ** 31);
          sum += searchTurn(G.snap, lf.decs, me, det2, 2, {n: L.opp}, []).v;
        }
        lf.v2 = 0.85 * sum / L.dets + 0.15 * Math.max(-1e4, Math.min(1e4, lf.v));
      }
      if (!top || lf.v2 > top.v2) top = lf;
    }
    best = top;
  }
  const steps = {}; for (let k = at; k < best.decs.length; k++) steps[k] = {i: best.decs[k], sig: best.sigs[k - at]};
  G._plan = {snap: G.snap, level, me, at, pre: G.decs.join(), steps};
  return best.decs[at];
}

/* ---------- exact search, for puzzles ---------- */
function probe(snap, decs, turns, det) {   // replay decs; stop at the next choice, or after `turns` turns. det: see simulate()
  const S = clone(snap), g = play(S); let r = g.next(), n = 0, i = 0;
  for (;;) {
    if (r.done) return {S, req: null};
    const q = r.value;
    if (q.kind === 'turn') { if (++n > turns) return {S, req: null}; r = g.next(); continue; }
    if (det && det.pts[i] != null && !q.noDet) determinize(S, det.me, det.pts[i]);
    if (i >= decs.length) return {S, req: q, turnNo: n};
    r = g.next(decs[i++]);
  }
}
/* Puzzles. The human is player 0. z.goal = {type, n}:
     escape  n   escape within n of your own turns                      (the puzzle runs 2n-1 turns)
     defeat  n   the opponent is pounced by the end of their nth turn   (2n turns)
     survive n   you have not lost after n of your turns and n of theirs (2n turns)
   Winning any other way inside that time also counts. */
const puzzleTurns = z => z.goal.type === 'escape' ? 2 * z.goal.n - 1 : 2 * z.goal.n;
const puzzleOk = (z, S) => z.goal.type === 'survive' ? S.winner !== 1 : S.winner === 0;
/* Can player 0 force success, whatever the opponent does? snap is a turn-start snapshot, decs the choices made so far
   this turn, turnsLeft counts this turn. ctx = {n: node budget, memo: Map, ban?: (option, S) => true to forbid one of
   player 0's options (used to check that a puzzle really needs its key move)}. */
function puzzleForced(snap, decs, turnsLeft, z, ctx) {
  if (--ctx.n < 0) { ctx.cut = true; return false; }
  const r = probe(snap, decs, 1);
  if (r.S.winner != null) return puzzleOk(z, r.S);
  if (!r.req) {   // the turn is over; r.S is the next turn's starting position
    if (turnsLeft <= 1) return puzzleOk(z, r.S);
    const key = turnsLeft + JSON.stringify(r.S); if (ctx.memo && ctx.memo.has(key)) return ctx.memo.get(key);
    const v = puzzleForced(r.S, [], turnsLeft - 1, z, ctx); if (ctx.memo && !ctx.cut) ctx.memo.set(key, v); return v;
  }
  const mine = r.req.p === 0;
  for (let i = 0; i < r.req.opts.length; i++) {
    if (mine && ctx.ban && ctx.ban(r.req.opts[i], r.S, r.req)) continue;
    const w = puzzleForced(snap, decs.concat(i), turnsLeft, z, ctx); if (mine && w) return true; if (!mine && !w) return false;
  }
  return !mine;
}
const puzzleTurnsLeft = (z, S) => puzzleTurns(z) - (S.turn - z.turn);
/* The puzzle opponent: a choice that stops you, if there is one. */
function puzzleReply(G, z, memo) {
  const q = G.req, left = puzzleTurnsLeft(z, G.S);
  for (let i = 0; i < q.opts.length; i++) { const ctx = {n: 150000, memo}; if (!puzzleForced(G.snap, G.decs.concat(i), left, z, ctx) && !ctx.cut) return i; }
  return aiChoose(G, 'hard');   // nothing stops you: play sensibly anyway
}
/* For you: a choice that keeps the puzzle solvable (used by the tests), or -1. */
function puzzleHint(G, z, memo) {
  const q = G.req, left = puzzleTurnsLeft(z, G.S);
  for (let i = 0; i < q.opts.length; i++) if (puzzleForced(G.snap, G.decs.concat(i), left, z, {n: 150000, memo})) return i;
  return -1;
}
