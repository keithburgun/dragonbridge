// 2nd Edition card changes, one by one (and that 1st Edition still behaves the old way).
const E = require('./eng_all.js'); const assert = require('assert');
function setup(wiz, h0, o = {}) {
  const S = E.newState({wiz, seed: o.seed || 5, first: 0, ed: o.ed || 2});
  if (h0) { const all = S.deck.concat(S.hand[0]); for (const c of h0) all.splice(all.indexOf(c), 1); S.hand[0] = h0.slice(); S.deck = all; }
  if (o.pre) o.pre(S);
  return new E.Game(S);
}
const give = (S, p, it) => { for (const z of [S.market, S.itemDeck, S.items[1 - p]]) { const i = z.indexOf(it); if (i >= 0) z.splice(i, 1); } S.items[p].push(it); };
const pick = (G, f) => { const i = G.req.opts.findIndex(f); assert(i >= 0, 'no such option at: ' + G.req.prompt + ' [' + G.req.opts.map(o => o.label).join(' | ') + ']'); G.answer(i); };
const has = (G, f) => G.req.opts.some(f);
let G, S;
// Eve: +2 Bump for the turn when she starts it on a purple tile (tile index 11 is purple, 9 is yellow)
G = setup(['eve', 'derby'], ['dart', 'hop', 'soda', 'step'], {pre: S => { S.pos[0] = 11; S.pos[1] = 9; }}); S = G.S;
pick(G, o => o.card === 'dart'); assert(/Bump Derby 3/.test(G.req.prompt), G.req.prompt);
G = setup(['eve', 'derby'], ['dart', 'hop', 'soda', 'step'], {pre: S => { S.pos[0] = 9; S.pos[1] = 11; }});
pick(G, o => o.card === 'dart'); assert(/Bump Derby 1/.test(G.req.prompt), G.req.prompt);
G = setup(['eve', 'derby'], ['dart', 'hop', 'soda', 'step'], {ed: 1, pre: S => { S.pos[0] = 11; S.pos[1] = 9; }});
pick(G, o => o.card === 'dart'); assert(/Bump Derby 1/.test(G.req.prompt)); pick(G, o => o.dir === 1); assert(/\+2 Bump bonus/.test(G.req.prompt), '1E Eve keeps her optional +2');
// Abragail: 2 or 3 ready Gems (not 1)
G = setup(['abragail', 'derby'], ['hop', 'soda', 'step', 'bait'], {pre: S => { S.ready[0] = 2; }}); pick(G, o => o.card === 'hop'); assert(/Move up to 4/.test(G.req.prompt), G.req.prompt);
G = setup(['abragail', 'derby'], ['hop', 'soda', 'step', 'bait']); pick(G, o => o.card === 'hop'); assert(/Move up to 3/.test(G.req.prompt), G.req.prompt);
G = setup(['abragail', 'derby'], ['hop', 'soda', 'step', 'bait'], {ed: 1}); pick(G, o => o.card === 'hop'); assert(/Move up to 4/.test(G.req.prompt), '1E Abragail: 1 ready Gem counts');
// Abragail after buying: a Nest card, but no "ready a Gem"
G = setup(['abragail', 'derby'], ['bait', 'soda', 'step', 'hop'], {pre: S => { S.ready[0] = 3; S.nest = [S.deck.pop()]; }}); pick(G, o => o.card === 'bait'); if (G.req.kind === 'pick') pick(G, o => o.id === 'no'); pick(G, o => o.act === 'buy');
while (G.req.kind === 'tile' || G.req.kind === 'yn') G.answer(0);
assert(/Abragail/.test(G.req.prompt) && !has(G, o => o.id === 'gem'), G.req.prompt);
// Roller Skates: +1 Move either way
G = setup(['derby', 'gelf'], ['hop', 'soda', 'step', 'bait'], {pre: S => give(S, 0, 'skates')}); pick(G, o => o.card === 'hop'); assert(/Move up to 4$/.test(G.req.prompt), G.req.prompt);
assert.equal(G.req.opts.length, 9);
// Accursed Loom: its Bump gains no White Gem
G = setup(['derby', 'gelf'], ['hop', 'soda', 'step', 'bait'], {pre: S => give(S, 0, 'loom')}); S = G.S; pick(G, o => o.card === 'hop'); pick(G, o => o.label === 'Stay'); pick(G, o => o.id === 'yes'); pick(G, o => o.dir === 1);
assert.equal(S.white[0], 0);
// Techno-Cutlass: no +1; landing on a Gem tile depletes and costs a White Gem
G = setup(['derby', 'gelf'], ['dart', 'soda', 'step', 'bait'], {pre: S => { give(S, 0, 'cutlass'); S.white[1] = 2; S.supply = 6; S.pos[1] = 11; }}); S = G.S;
pick(G, o => o.card === 'dart'); pick(G, o => o.dir === 1);   // 11 -> 12, a Gem tile
assert.equal(S.pos[1], 12); assert.equal(S.white[1], 1); assert.equal(S.ready[1], 0);
// Cool Backpack: readying on a Gem tile readies a second Gem
G = setup(['derby', 'gelf'], ['bait', 'soda', 'step', 'hop'], {pre: S => { give(S, 0, 'backpack'); S.ready[0] = 0; S.pos[0] = 8; }}); S = G.S;
pick(G, o => o.card === 'bait'); if (G.req.kind === 'pick') pick(G, o => o.id === 'no'); pick(G, o => o.act === 'ready'); assert.equal(S.ready[0] >= 2, true);
// Thunderbox: no Dragon Check choice; on Flight its owner Bumps 2
G = setup(['derby', 'gelf'], ['bait', 'soda', 'step', 'hop'], {pre: S => { give(S, 0, 'thunderbox'); S.nest = []; for (const c of ['fireball', 'dart', 'transfer']) { S.deck.splice(S.deck.indexOf(c), 1); S.nest.push(c); } }}); S = G.S;
pick(G, o => o.card === 'bait'); if (G.req.kind === 'pick') pick(G, o => o.id === 'no'); pick(G, o => o.act === 'pass');
assert(/^Bump Gelf 2/.test(G.req.prompt), G.req.prompt); assert.equal(S.dragon, 1); assert(S.items[0].includes('thunderbox'));
// Robot Boy: a random Item at game start and on Flight; loses one on Roost; none of his old powers
G = setup(['robot', 'derby'], ['bait', 'soda', 'step', 'hop']); S = G.S;
while (G.req.kind !== 'card') G.answer(0);   // the Item he was dealt may ask something (VR Helmet)
assert.equal(S.items[0].length, 1);
G = setup(['robot', 'derby'], ['bait', 'soda', 'step', 'hop'], {seed: 9, pre: S => {
  const all = S.deck.concat(S.hand[1]); S.nest = [];
  for (const c of ['dazzle', 'charge', 'charge', 'gale', 'gale', 'leap']) { all.splice(all.indexOf(c), 1); S.nest.push(c); }   // 5 Wings + Bait's 3 = 8: a Roost, not a Flight
  S.hand[1] = all.splice(0, 4); S.deck = all;
}}); S = G.S;
while (G.req.kind !== 'card') G.answer(0);
const n0 = S.items[0].length; let asked = false; pick(G, o => o.card === 'bait');
while (G.req && S.turn === 1) { if (/Robot Boy, on Roost/.test(G.req.prompt)) asked = true; const i = G.req.opts.findIndex(o => o.id === 'no' || o.act === 'pass'); G.answer(i < 0 ? 0 : i); }
assert(asked, 'Robot Boy was not asked which Item to lose'); assert.equal(S.items[0].length, n0 - 1);
// May: after a Hack, Teleport 1 or a White Gem; Gem Action on purple: Bump 1 and a random card
G = setup(['may', 'derby'], ['bait', 'soda', 'step', 'hop'], {pre: S => { S.white[0] = 7; S.supply = 1; S.pos[0] = 11; S.pos[1] = 9; S.hacks[0] = 'gems'; S.hackDeck = S.hackDeck.filter(h => h !== 'gems'); }}); S = G.S;
assert.equal(new Set(S.hacks.concat(S.hackDeck)).size >= 8, true);
pick(G, o => o.card === 'bait'); if (G.req.kind === 'pick') pick(G, o => o.id === 'no');
assert(has(G, o => o.act === 'maytake')); const hk = G.req.opts.find(o => o.act === 'hack' && o.hack === 'gems'); assert(/\(3 White\)/.test(hk.label), 'no Hack discount in 2E: ' + hk.label);
pick(G, o => o.act === 'hack' && o.hack === 'gems'); assert(/Teleport 1 or gain a White Gem/.test(G.req.prompt)); pick(G, o => o.id === 'w'); assert.equal(S.white[0], 5); assert.equal(S.hackDown[0].length, 0);
G = setup(['may', 'derby'], ['bait', 'soda', 'step', 'hop'], {pre: S => { S.pos[0] = 11; S.pos[1] = 9; }}); S = G.S;
pick(G, o => o.card === 'bait'); if (G.req.kind === 'pick') pick(G, o => o.id === 'no'); pick(G, o => o.act === 'maytake'); pick(G, o => o.dir === -1);
assert.equal(S.hand[1].length, 3); assert.equal(S.hand[0].length, 4); assert.equal(S.known[0].length, 1); assert.equal(S.white[0], 1);
// chip tune lullaby: the opponent may shuffle a 2-Wing card; otherwise a free Item
for (const keep of [true, false]) {
  G = setup(['derby', 'gelf'], ['bait', 'soda', 'step', 'hop'], {pre: S => { S.white[0] = 3; S.supply = 5; S.hacks[0] = 'lullaby'; S.hackDeck = S.hackDeck.filter(h => h !== 'lullaby'); const all = S.deck.concat(S.hand[1]); for (const c of ['fireball', 'gale', 'charge', 'leap']) all.splice(all.indexOf(c), 1); S.hand[1] = ['fireball', 'gale', 'charge', 'leap']; S.deck = all; }}); S = G.S;
  if (S.hacks.filter(h => h === 'lullaby').length !== 1) continue;
  pick(G, o => o.card === 'bait'); if (G.req.kind === 'pick') pick(G, o => o.id === 'no'); pick(G, o => o.act === 'hack' && o.hack === 'lullaby');
  assert.equal(G.req.p, 1); assert.equal(G.req.opts.length, 2);
  if (keep) { pick(G, o => o.id === 'no'); assert.equal(G.req.kind, 'item'); G.answer(0); while (S.items[0].length === 0) G.answer(0); assert.equal(S.items[0].length, 1); }
  else { pick(G, o => o.card === 'fireball'); assert.equal(S.hand[1].length, 3); assert.equal(S.items[0].length, 0); }
}
console.log('2nd Edition tests ok');
