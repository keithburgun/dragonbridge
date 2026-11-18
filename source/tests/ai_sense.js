// The CPU never does something pointless-looking when it is lost: a doomed Wizard does not teleport toward the Dragon.
// Uses puzzle 2 ("The Deep End"): after your Flame Arrow, Bunny is deep in the Threatened tiles with one Gem.
const E = require('./eng_all.js'), assert = require('assert');
const z = require('../puzzles.json').find(x => x.name === 'The Deep End');
for (const who of ['puzzle', 'easy', 'normal', 'hard', 'expert']) for (let rep = 0; rep < (who === 'easy' ? 40 : 6); rep++) {
  const G = E.Game.resume(z.snap, [], []), memo = new Map();
  while (G.S.cur === 0 && !G.over) G.answer(G.req.p === 0 ? E.puzzleHint(G, z, memo) : 0);
  const start = G.S.pos[1]; assert(start <= 4, 'Bunny should be on a Threatened tile');
  while (!G.over && G.S.cur === 1) G.answer(who === 'puzzle' ? E.puzzleReply(G, z, memo) : E.aiChoose(G, who));
  assert(G.S.winner === 0 && G.S.reason === 'pounce');
  if (who !== 'easy') assert(G.S.pos[1] >= start, `${who}: the doomed CPU moved toward the Dragon (${start} -> ${G.S.pos[1]})\n` + G.S.log.slice(-6).map(e => e.m).join('\n'));
  else if (G.S.pos[1] < start) easyBad = (typeof easyBad === 'undefined' ? 0 : easyBad) + 1;
}
var easyBad; assert(!easyBad || easyBad <= 2, 'Easy went toward the Dragon ' + easyBad + '/40 times');
console.log('doomed CPU keeps away from the Dragon' + (easyBad ? ` (Easy, which blunders on purpose, went the wrong way ${easyBad}/40 times)` : ''));
