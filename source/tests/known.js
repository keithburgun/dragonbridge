// Known cards: Insight and a Shockwave reveal show a hand; those cards stay known until they leave it.
const E = require('./eng_all.js'); const assert = require('assert');
function setup(h0, h1) { const S = E.newState({wiz: ['derby', 'eve'], seed: 5, first: 0}); const all = S.deck.concat(S.hand[0], S.hand[1]); for (const c of h0.concat(h1)) all.splice(all.indexOf(c), 1); S.hand = [h0.slice(), h1.slice()]; S.deck = all; return new E.Game(S); }
const pick = (G, f) => G.answer(G.req.opts.findIndex(f));
// Insight: the whole hand is seen; the taken card is known in the taker's hand
let G = setup(['insight', 'soda', 'bait', 'transfer'], ['hop', 'charge', 'charge', 'gale']);
pick(G, o => o.card === 'insight'); assert.equal(G.req.kind, 'pick'); pick(G, o => o.card === 'hop' && o.zone === 'opp');
while (G.S.turn === 1 && G.req) pick(G, o => o.act === 'pass' || true);
assert.deepEqual(G.S.known[1].slice().sort(), ['charge', 'charge', 'gale']); assert.deepEqual(G.S.known[0], ['hop']);
// the opponent plays one Charge: one Charge and Gale are still known; a newly drawn card is not
pick(G, o => o.card === 'charge'); while (G.S.turn === 2 && G.req) G.answer(0);
assert.deepEqual(E.clone(G.S.known[1]).sort(), ['charge', 'gale']); assert.equal(G.S.hand[1].length, 4);
// Shockwave against a hand with no MOVE card reveals it; with a MOVE card nothing else is shown
G = setup(['shockwave', 'soda', 'bait', 'transfer'], ['gale', 'step', 'dart', 'fireball']);
pick(G, o => o.card === 'shockwave'); while (G.req && G.req.kind !== 'gem' && G.S.turn === 1) G.answer(0);
assert.deepEqual(G.S.known[1].slice().sort(), ['dart', 'fireball', 'gale', 'step']);
G = setup(['shockwave', 'soda', 'bait', 'transfer'], ['hop', 'step', 'dart', 'fireball']);
pick(G, o => o.card === 'shockwave'); while (G.req && G.req.kind !== 'gem' && G.S.turn === 1) G.answer(0);
assert.deepEqual(G.S.known[1], []);
console.log('known-card tests ok');
