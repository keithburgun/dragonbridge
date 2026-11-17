// Random games between every pair of wizards: must never crash, and every card/gem must be conserved.
const E = require('./eng_all.js');
const n = +process.argv[2] || 3; let games = 0, turns = 0, draws = 0, esc = 0, pounce = 0; const wins = {};
for (const a of E.WIZ_IDS) for (const b of E.WIZ_IDS) for (let k = 0; k < n; k++) {
  const S = E.newState({wiz: [a, b], seed: games * 7919 + 1}); S.log = undefined; S.maxTurns = 300;
  const G = new E.Game(S); let steps = 0;
  while (!G.over) {
    if (!G.req) throw new Error('no request but not over');
    G.answer(Math.floor(Math.random() * G.req.opts.length));
    const bad = E.checkState(S); if (bad) throw new Error(`${a} vs ${b}: ${bad}`);
    if (++steps > 20000) throw new Error('runaway');
  }
  games++; turns += S.turn; if (S.winner < 0) draws++; else { wins[S.wiz[S.winner].replace('may2', 'may')] = (wins[S.wiz[S.winner].replace('may2', 'may')] || 0) + 1; S.reason === 'escape' ? esc++ : pounce++; }
}
console.log(`${games} random games ok · avg ${(turns / games).toFixed(1)} turns · escapes ${esc} · pounces ${pounce} · draws ${draws}`);
console.log(Object.entries(wins).sort((x, y) => y[1] - x[1]).map(([w, c]) => `${w} ${c}`).join('  '));
