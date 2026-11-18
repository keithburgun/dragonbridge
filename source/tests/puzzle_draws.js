// Puzzles script each player's draws: whatever either player does, you draw the same cards in the same order.
//   node tests/puzzle_draws.js     (after python3 build.py)
const E = require('./eng_all.js'), Z = require('../puzzles.json');
let bad = 0, seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (const z of Z) {
  if (!z.snap.script) { console.error(`puzzle ${z.id}: no scripted draws`); bad++; continue; }
  const want = z.snap.script[0], seen = new Set();
  for (let g = 0; g < 300; g++) {
    const G = E.Game.resume(z.snap, [], []), me = G.S.names ? G.S.names[0] : E.WIZ[G.S.wiz[0]].s, got = []; let at = 0, steps = 0;
    while (!G.over && E.puzzleTurnsLeft(z, G.S) > 0 && steps++ < 400) {
      G.answer(Math.floor(rnd() * G.req.opts.length));
      for (; at < G.S.log.length; at++) { const m = new RegExp('^' + me + ' draws (\\d+) card').exec(G.S.log[at].m); if (m) got.push(...G.S.hand[0].slice(-m[1])); }
    }
    seen.add(got.join(','));
    // what you drew must be the script, in order (a scripted card is skipped only if it had already left the deck)
    // (once the script has run out, you draw whatever a Flight or Roost has put back into the deck)
    let i = 0; for (const c of got) { if (i >= want.length) break; while (i < want.length && want[i] !== c) i++; if (i++ >= want.length) { bad++; console.error(`puzzle ${z.id}: drew ${got.join(',')} but the script is ${want.join(',')}`); break; } }
  }
  const first = new Set([...seen].filter(Boolean).map(s => s.split(',')[0]));
  if (first.size > 1) { bad++; console.error(`puzzle ${z.id}: the first draw varies: ${[...first].join(' / ')}`); }
}
console.log(bad ? `${bad} problems` : 'puzzle draws are fixed in every line of play'); process.exit(bad ? 1 : 0);
