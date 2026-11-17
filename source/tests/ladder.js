// CPU difficulty ladder: node tests/ladder.js hard normal 20   (the first level should win more)
const E = require('./eng_all.js');
const [A, B, N] = [process.argv[2] || 'normal', process.argv[3] || 'easy', +process.argv[4] || 20];
let w = [0, 0], turns = 0, t0 = Date.now(), decs = 0, why = {};
for (let g = 0; g < N; g++) {
  const ws = E.WIZ_IDS, a = ws[g % ws.length], b = ws[(g * 7 + 3) % ws.length];
  const S = E.newState({wiz: [a, b], seed: g * 31 + 5}); S.log = undefined; S.maxTurns = 200;
  const lv = g % 2 ? [A, B] : [B, A];   // swap seats every game
  const G = new E.Game(S);
  while (!G.over) { G.answer(E.aiChoose(G, lv[G.req.p])); decs++; }
  if (S.winner >= 0) { w[lv[S.winner] === A && !(A === B && S.winner) ? 0 : 1]++; why[S.reason] = (why[S.reason] || 0) + 1; }
  turns += S.turn;
}
console.log(`${A} ${w[0]} – ${w[1]} ${B} · avg ${(turns / N).toFixed(1)} turns · ${((Date.now() - t0) / decs).toFixed(1)} ms per decision`, why);
