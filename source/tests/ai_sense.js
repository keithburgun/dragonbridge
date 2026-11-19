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

// The CPU does not wander: it never goes one way and back the other way in the same turn when a direct line is as good.
// 1. Venice Gorn on the Exit side with a MOVE card: his optional turn-start Teleport toward the center is skipped, and he escapes.
for (const lvl of ['normal', 'hard', 'expert']) for (const pos of [16, 17, 18, 19]) for (let rep = 0; rep < 4; rep++) {
  const S = E.newState({wiz: ['derby', 'venice'], seed: 100 + rep, first: 1, ed: 2});
  const all = S.deck.concat(S.hand[1]), hand = ['hop', 'soda', 'gale', 'bait']; for (const c of hand) all.splice(all.indexOf(c), 1);
  S.hand[1] = hand; S.deck = all; S.pos = [9, pos]; S.dragon = 0;
  const G = new E.Game(S); let first = null;
  while (!G.over && G.S.cur === 1 && G.req.p === 1) { const i = E.aiChoose(G, lvl); if (!first) first = G.req.opts[i].label; G.answer(i); }
  assert(G.S.winner === 1 && G.S.reason === 'escape', `${lvl}: Venice on tile ${pos} should escape`);
  assert(first === 'Stay', `${lvl}: Venice on tile ${pos} stepped toward the center (${first}) before escaping`);
}
// 2. In ordinary play, count the turns in which a CPU went both up and down the bridge by its own choice.
let turns = 0, zig = 0;
for (let seed = 1; seed <= 30; seed++) {
  const ws = E.WIZ_IDS, S = E.newState({wiz: [ws[seed % 15], ws[(seed * 7 + 3) % 15]], seed, ed: 2}), G = new E.Game(S); let up = 0, down = 0, snap = G.snap;
  while (!G.over) {
    if (G.snap !== snap) { turns++; if (up && down) zig++; up = down = 0; snap = G.snap; }
    const q = G.req, i = E.aiChoose(G, 'hard');
    if (q.kind === 'tile' && q.who === q.p && q.p === G.S.cur) { const d = q.opts[i].tile - G.S.pos[q.p]; if (d > 0) up += d; else down -= d; }
    G.answer(i);
  }
}
console.log(`no wandering: Venice escapes without stepping back; ${zig} of ${turns} CPU turns went both ways (those had a reason, e.g. picking up a Gem on the way)`);
assert(zig / turns < 0.03, 'the CPU doubles back too often');
