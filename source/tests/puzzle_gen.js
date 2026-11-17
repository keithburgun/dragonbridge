// Finds puzzle positions: plays CPU games and keeps turn-start positions where player 0 has a forced win
// (escape now, or leave the opponent no way to avoid being pounced next turn) that is not obvious.
//   node tests/puzzle_gen.js 10 > puzzles.json
const E = require('./eng_all.js');
const want = +process.argv[2] || 10, out = [], usedWiz = {};
for (let g = 0; out.length < want && g < 4000; g++) {
  const ws = E.WIZ_IDS, a = ws[g % ws.length], b = ws[(g * 7 + 3 + Math.floor(g / 15)) % ws.length];
  if (usedWiz[a]) continue;
  const S = E.newState({wiz: [a, b], seed: g * 101 + 9, names: a === b ? [E.WIZ[a].s + ' (you)', E.WIZ[b].s + ' (CPU)'] : [E.WIZ[a].s, E.WIZ[b].s]}); S.log = undefined; S.maxTurns = 60;
  const G = new E.Game(S); let lastTurn = 0;
  while (!G.over) {
    if (S.turn !== lastTurn) {
      lastTurn = S.turn;
      if (S.cur === 0 && S.turn >= 4 && G.req && G.req.p === 0 && G.decs.length === 0) {
        const snap = G.snap, me = snap.pos[0], exitNow = E.isExit(snap, me) && snap.hand[0].some(c => E.ACTIONS[c].move);
        if (!exitNow) {
          const ctx = {n: 60000};
          if (E.forcedWin(snap, [], 0, ctx) && !ctx.cut) {
            const n = G.req.opts.length; let wins = 0, cut = false;
            for (let i = 0; i < n; i++) { const c = {n: 60000}; if (E.forcedWin(snap, [i], 0, c)) wins++; if (c.cut) cut = true; }
            const used = 60000 - ctx.n;
            if (!cut && wins / n <= 0.34 && n >= 3) { out.push({snap, frac: wins / n, nodes: used, turn: snap.turn + 1}); usedWiz[a] = 1; break; }
          }
        }
      }
    }
    G.answer(E.aiChoose(G, 'normal'));
  }
}
out.sort((x, y) => y.frac - x.frac || x.nodes - y.nodes);
const lv = i => i < out.length * 0.34 ? 'Beginner' : i < out.length * 0.67 ? 'Intermediate' : 'Advanced';
console.log(JSON.stringify(out.map((z, i) => ({id: i + 1, level: lv(i), turn: z.turn, snap: z.snap}))));
console.error(out.map(z => `${z.snap.wiz.join(' v ')} frac ${z.frac.toFixed(2)} nodes ${z.nodes}`).join('\n'));
