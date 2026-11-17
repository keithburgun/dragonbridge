'use strict';
/* Dragon Bridge rules engine.
   The whole game state S is plain JSON. play(S) is a generator: it yields a request {p, kind, prompt, opts}
   whenever a player has to choose something and is resumed with the index of the chosen option. It also yields
   {kind:'turn'} at the start of every turn, which is the only point where S alone is enough to resume a game
   (saves, CPU look-ahead and replays all start from there).

   Bridge: 21 tiles, index 0..20. Index 0 is the "Dragon start" end, 10 is the centre. Tiles 0-4 and 16-20 are
   the orange end tiles; whichever end the Dragon is on is Threatened, the other is the Exit. */

const ACTIONS = {
  fireball:  {n: 'Fireball',    w: 2, bump: 1, t: 'Deplete a Gem to BUMP 5.', pw: '−1 Teleport.'},
  dazzle:    {n: 'Dazzle',      w: 0, move: 1, t: 'MOVE 2. You may take any card in the Nest and put it on the bottom of the Action Deck.', pw: ''},
  flamearrow:{n: 'Flame Arrow', w: 2, bump: 1, t: 'BUMP 4 away from center, or BUMP 2.', pw: 'Needs 10 Wings for Flight.'},
  dart:      {n: 'Magic Dart',  w: 2, bump: 1, t: 'BUMP 1. Opponent depletes a Gem.', pw: 'Draw Phase: Teleport 1 away from the Dragon.'},
  soda:      {n: 'Soda',        w: 0, t: 'Place a card from your hand into the Nest or on the bottom of the Action Deck. Ready a Gem.', pw: ''},
  transfer:  {n: 'Transfer',    w: 2, t: 'You ready a Gem. Opponent depletes a Gem.', pw: 'Items cost 1 fewer Gem.'},
  charge:    {n: 'Charge',      w: 1, move: 1, t: 'MOVE 2. If you moved exactly 2 tiles, ready a Gem.', pw: '+1 Bump away from center.'},
  step:      {n: 'Step',        w: 0, t: 'TELEPORT 1. You may play another Action card.', pw: ''},
  gale:      {n: 'Gale',        w: 1, bump: 1, t: 'Choose a direction. BUMP 2, then TELEPORT 1 in that direction (teleport is optional).', pw: 'Needs 10 Wings for Flight.'},
  bait:      {n: 'Bait',        w: 3, t: 'You may take a card from the Nest. Can’t take Insight.', pw: 'When placed as the new power: the current player depletes 2 Gems.'},
  insight:   {n: 'Insight',     w: 1, t: 'Reveal the opponent’s hand. Take a card from them or from the Nest. If you have exactly 1 ready Gem, ready a Gem.', pw: 'If you ready a Gem while not on a Gem tile, the opponent depletes a Gem.'},
  hop:       {n: 'Hop',         w: 0, move: 1, t: 'MOVE 3.', pw: '+1 Bump for each Item owned by the opponent.'},
  leap:      {n: 'Leap',        w: 1, move: 1, t: 'MOVE 2. You may deplete a Gem to TELEPORT 2.', pw: '+1 Move away from center.'},
  shockwave: {n: 'Shockwave',   w: 1, bump: 1, t: 'BUMP 2. Opponent shuffles a MOVE Action card into the deck, or reveals a hand with none.', pw: 'All yellow tiles are Gem tiles.'},
  checkmate: {n: 'Checkmate',   w: 2, move: 1, bump: 1, t: 'MOVE 2. Deplete a Gem to BUMP 3.', pw: 'Needs 11 Wings for Flight.'},
};
const DECK = ['fireball', 'dazzle', 'flamearrow', 'dart', 'soda', 'transfer', 'charge', 'charge', 'step', 'gale', 'gale', 'bait', 'insight', 'hop', 'leap', 'shockwave', 'checkmate'];
const ITEMS = {
  loom:       {n: 'Accursed Loom', t: 'After you MOVE, you may immediately BUMP 1.'},
  thunderbox: {n: 'Thunderbox', t: 'On your turn, during the Dragon Check, shuffle this back into the Item Deck to add 2 Wings or subtract 2 Wings.'},
  blade:      {n: 'Ruupart’s Blade', t: 'On BUMP away from center: +1, and you may also reshuffle this to gain an additional +4.'},
  skates:     {n: 'Roller Skates', t: '+2 Move away from center.'},
  cutlass:    {n: 'Techno-Cutlass', t: '+1 Bump away from the center. On BUMP: if the opponent lands on an End tile, the opponent depletes a Gem.'},
  transmog:   {n: 'Transmogrifier', t: 'Gem Action: reshuffle this to gain 5 White Gems. You may then play a Bridge Hack (paying its cost), then reshuffle it and draw a new one.'},
  blink:      {n: 'Blink Scroll', t: 'On MOVE: you may reshuffle this into the Item Deck to gain +5 Move.'},
  backpack:   {n: 'Cool Backpack', t: 'On ROOST, ready 3 Gems.'},
  vr:         {n: 'VR Helmet Attachment Cable Accoutrement', t: 'Immediately after you gain this, gain 2 White Gems and TELEPORT 3. On ROOST: gain 2 White Gems.'},
};
const HACKS = {
  law:     {n: '3rd law of bumpin', cost: 4, t: 'TELEPORT 2. BUMP 1 in the opposite direction. (Do not gain a White Gem from this.)'},
  sk8:     {n: '“sk8te-board”', cost: 3, t: 'TELEPORT 3.'},
  lullaby: {n: 'chip tune lullaby', cost: 3, t: 'Play one card from your hand into the Nest (do not perform its action).'},
  forge:   {n: 'syntho forge', cost: 3, t: 'Reveal and shuffle a Fireball to gain an Item.'},
  mondo:   {n: 'MONDO punch', cost: 5, t: 'BUMP 4 away from the center. Do not gain a White Gem.'},
  wyrm:    {n: 'wyrmhole', cost: 7, t: 'Move to the opposite tile on the other side of the bridge (distance from the center stays the same).'},
  gems:    {n: 'illicit GEMS!!!', cost: 3, t: 'Ready 2 Gems.'},
  pills:   {n: 'muscle pills', cost: 3, t: 'BUMP 2. (Do not gain a White Gem from this.)'},
  deals:   {n: 'Illicit card deals', cost: 4, t: 'Swap a card in your hand for one in the Nest. Opponent depletes a Gem.'},
};
const WIZ = {
  derby:    {n: 'Derby Pocket', s: 'Derby', title: 'Infernal Intern', t: ['On ROOST: Teleport 2.', 'After your Gem Phase: if there are exactly 3 or 5 Wings in the Nest, ready a Gem.']},
  eve:      {n: 'Eve Williams', s: 'Eve', title: 'Radical Skeleton', t: ['When you BUMP from Purple tiles: +2 Bump, and if the opponent has more ready Gems, ready a Gem.', 'Have exactly 1 Item: +1 Teleport.']},
  bunny:    {n: 'Bunny Wizard', s: 'Bunny', title: 'Magical Bunny', t: ['Gem Action, while within 3 tiles: deplete a Gem to play an Action card and then shuffle it.', 'When you gain your 2nd Item: ready 2 Gems (once per game).']},
  abragail: {n: 'Abragail', s: 'Abragail', title: 'Adventuring Professor', t: ['While you have 1 or 2 ready Gems at turn start: +1 Move and +1 Bump for the turn.', 'After you buy an Item: you may take any card from the Nest, or ready a Gem.']},
  venice:   {n: 'Venice Gorn', s: 'Venice', title: 'Farm Conjurer', t: ['Turn start: Teleport 1 toward the center.', 'When you BUMP from a Start or Center tile: if there’s a Dragon Power card, you may deplete a Gem to put it in the Nest. If there isn’t one, ready a Gem.']},
  may:      {n: 'May Danaris', s: 'May', title: 'Outcast Hacker', t: ['On Bridge Hack: cost −1 White Gem. After the Hack, flip it face down and draw a new one.', 'Gem Action: flip a face-down Hack face-up to take your Wizard card to your hand. While there, you can’t be bumped or pounced. Next turn start: return on the center tile, flipped to the reverse side.', 'Reverse side: +2 Bump away from center and +1 Move in your Action Phase; you cannot buy Items for 3 Gems.']},
  omar:     {n: 'Omar Evans', s: 'Omar', title: 'Assassin Bug', t: ['Game start: you have only 2 Gems.', 'Gem Action: if you have 0 Items, deplete a Gem and discard 2 White Gems to gain an Item.', 'Gem Action: reshuffle 1 Item to BUMP 6.']},
  lori:     {n: 'Lori Ann-Davis', s: 'Lori', title: 'Vampire Philosopher', t: ['After ROOST: search the deck for a card of your choice. Reveal it, draw it, and reshuffle the deck.', 'After you play Gale: the opponent reveals and shuffles a Step, OR they deplete a Gem and you ready a Gem.']},
  bill:     {n: 'Bill Milton', s: 'Bill', title: 'CEO Wizard', t: ['Action Phase: after you play a BUMP Action card, the opponent may give you a BUMP Action card. If they do not, ready a Gem and Teleport 1.', 'After ROOST: exchange the Dragon Power for a card in your hand to gain 2 White Gems.']},
  robot:    {n: 'Robot Boy', s: 'Robot Boy', title: 'Forgotten Entertainer', t: ['When you BUMP: you may target yourself (you gain a White Gem as with any Bump).', 'After you Bridge Hack: place it face down in front of you and draw a new one.', 'Your Action Phase: MOVE cards have a Move value of 1, or 3 if you have 2 or more face-down Hacks.']},
  andromeda:{n: 'Andromeda Robin', s: 'Andromeda', title: 'Forest Witch', t: ['Gem Action: deplete a Gem to BUMP 2.', 'After you play a BUMP Action: stack 1–3 Gems beside your Wizard. Turn start: return 1 Gem, readied.', 'On an opponent’s BUMP: return 1 Gem, depleted.']},
  peebnup:  {n: 'Peebnup Bubber', s: 'Peebnup', title: 'Reformed Vampire', t: ['At all times: +1 Teleport per Charge in the Nest.', 'Gem Action, while within 6 tiles: both players ready a Gem. Then, you ready a Gem again.']},
  december: {n: 'December Yamane', s: 'December', title: 'Pilot Commander', t: ['Start of turn: if there are 5 or fewer Wings in the Nest, gain +2 Bump. Otherwise, gain −2 Bump.', 'Action Phase: if you BUMP the opponent beyond the last bridge tile, ready 2 Gems.']},
  trevor:   {n: 'Trevor Lebebbedeh', s: 'Trevor', title: 'Elaborate Songwriter', t: ['On Roost: deplete a Gem. On Flight: ready a Gem.', 'Action Phase: as your action, deplete 2 Gems to play up to 3 Actions. Reshuffle all played cards. You can not escape on this turn.']},
  gelf:     {n: 'Gelf Lanz', s: 'Gelf', title: 'Peacekeeping Knight', t: ['On BUMP, within 6 tiles of the opponent: first, MOVE to the opponent’s position.', 'On FLIGHT: place 1 Gem on the Dragon. While there, Flight requires +1 Wing and the opponent may not Teleport. Next Roost or Flight, return the Gem and then ready a Gem.']},
};
WIZ.may2 = {n: 'May Danaris', s: 'May', title: 'Hacking Avenger', t: WIZ.may.t, hidden: true};
const WIZ_IDS = Object.keys(WIZ).filter(w => !WIZ[w].hidden);

/* ---------- bridge ---------- */
const CENTER = 10, LAST = 20;
const isEnd = i => i <= 4 || i >= 16;
const isThreat = (S, i) => S.dragon === 0 ? i <= 4 : i >= 16;
const isExit = (S, i) => isEnd(i) && !isThreat(S, i);
const tileColor = i => i < 5 || i > 15 || i === CENTER ? '' : ((i < CENTER ? i : i + 1) % 2 ? 'Y' : 'P');   // 5 Y, 6 P ... 9 Y | 11 P, 12 Y ... 15 P
const isGemTile = (S, i) => i === 5 || i === 8 || i === 12 || i === 15 || (S.power === 'shockwave' && tileColor(i) === 'Y');
const isAway = (pos, dir) => pos === CENTER || (pos < CENTER ? dir < 0 : dir > 0);
const tileName = i => i === CENTER ? 'the center' : 'tile ' + (i < CENTER ? i : LAST - i) + (i < CENTER ? ' (left)' : ' (right)');
const clampT = i => Math.max(0, Math.min(LAST, i));

/* ---------- small helpers ---------- */
function rnd(S) { let t = S.seed = (S.seed + 0x6D2B79F5) | 0; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(S, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(S) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clone = o => JSON.parse(JSON.stringify(o));
const END = {end: true};
function log(S, m, x) { if (S.log) S.log.push(Object.assign({t: S.turn, p: S.cur, m}, x)); }
const nm = (S, p) => S.names ? S.names[p] : WIZ[S.wiz[p]].s;
const has = (S, p, it) => S.items[p].includes(it);
const isW = (S, p, w) => S.wiz[p] === w;
const dep = (S, p) => S.gems[p] - S.ready[p];
const wings = S => S.nest.reduce((a, c) => a + ACTIONS[c].w, 0);
const flightNeed = S => (S.power === 'checkmate' ? 11 : S.power === 'flamearrow' || S.power === 'gale' ? 10 : 9) + S.gelf[0] + S.gelf[1];
const itemCost = S => S.power === 'transfer' ? 2 : 3;
function win(S, p, why) { S.winner = p; S.reason = why; log(S, why === 'escape' ? `${nm(S, p)} ESCAPES the bridge and wins!` : `${nm(S, 1 - p)} is POUNCED by the Dragon. ${nm(S, p)} wins!`); throw END; }
function* ask(S, p, kind, prompt, opts, extra) {
  if (!opts.length) return null;
  if (opts.length === 1 && !(extra && extra.show)) return opts[0];
  const i = yield Object.assign({p, kind, prompt, opts}, extra);
  return opts[i];
}
function* yn(S, p, prompt, yes, extra) { const c = yield* ask(S, p, 'yn', prompt, [{id: 'yes', label: yes || 'Yes'}, {id: 'no', label: 'No'}], extra); return c.id === 'yes'; }

function ready(S, p, n = 1) {
  const k = Math.min(n, dep(S, p)); if (k <= 0) return 0;
  S.ready[p] += k; log(S, `${nm(S, p)} readies ${k} Gem${k > 1 ? 's' : ''}.`);
  if (S.power === 'insight' && !S.away[p] && !isGemTile(S, S.pos[p]) && S.ready[1 - p] > 0) { log(S, 'Dragon Power (Insight):'); deplete(S, 1 - p, 1); }
  return k;
}
function deplete(S, p, n = 1) { const k = Math.min(n, S.ready[p]); if (k <= 0) return 0; S.ready[p] -= k; log(S, `${nm(S, p)} depletes ${k} Gem${k > 1 ? 's' : ''}.`); return k; }
function gainWhite(S, p, n, steal) {
  let g = 0;
  for (let i = 0; i < n; i++) { if (S.supply > 0) { S.supply--; S.white[p]++; g++; } else if (steal && S.white[1 - p] > 0) { S.white[1 - p]--; S.white[p]++; g++; } }
  if (g) log(S, `${nm(S, p)} gains ${g} White Gem${g > 1 ? 's' : ''}.`);
}
function dropItem(S, p, it) { S.items[p].splice(S.items[p].indexOf(it), 1); S.itemDeck.push(it); shuffle(S, S.itemDeck); log(S, `${nm(S, p)} reshuffles ${ITEMS[it].n} into the Item Deck.`); }
function* gainItem(S, p, it, from) {
  if (from) from.splice(from.indexOf(it), 1);
  S.items[p].push(it); log(S, `${nm(S, p)} gains ${ITEMS[it].n}.`);
  if (it === 'vr') { gainWhite(S, p, 2); yield* teleport(S, p, 3); }
  if (isW(S, p, 'bunny') && S.items[p].length === 2 && !S.once[p]) { S.once[p] = 1; ready(S, p, 2); }
}
function* pickItem(S, p, prompt) {   // take an Item from the Market (or the top of the Item Deck if the Market is empty)
  if (!S.market.length && S.itemDeck.length) S.market.push(S.itemDeck.pop());
  if (!S.market.length) return;
  const c = yield* ask(S, p, 'item', prompt || 'Choose an Item', S.market.map(it => ({item: it, label: ITEMS[it].n})));
  yield* gainItem(S, p, c.item, S.market);
}

/* ---------- movement ---------- */
const tpBonus = (S, p) => (isW(S, p, 'eve') && S.items[p].length === 1 ? 1 : 0) + (isW(S, p, 'peebnup') ? S.nest.filter(c => c === 'charge').length : 0) - (S.power === 'fireball' ? 1 : 0);
function* teleport(S, p, n, o = {}) {
  if (S.away[p]) return 0;
  if (S.gelf[1 - p]) { log(S, `${nm(S, p)} may not Teleport while Gelf’s Gem is on the Dragon.`); return 0; }
  n = Math.max(0, n + tpBonus(S, p));
  const from = S.pos[p], opts = [];
  for (let t = Math.max(0, from - n); t <= Math.min(LAST, from + n); t++) { if (o.dir && t !== from && Math.sign(t - from) !== o.dir) continue; opts.push({tile: t, label: t === from ? 'Stay' : tileName(t)}); }
  const c = yield* ask(S, p, 'tile', (o.why ? o.why + ': ' : '') + `Teleport up to ${n}`, opts, {verb: 'teleport', who: p});
  S.pos[p] = c.tile; if (c.tile !== from) log(S, `${nm(S, p)} teleports ${Math.abs(c.tile - from)} to ${tileName(c.tile)}.`);
  return c.tile - from;
}
function* move(S, p, n, o = {}) {
  if (S.away[p]) return 0;
  if (isExit(S, S.pos[p]) && !S.t.noEscape) win(S, p, 'escape');
  if (o.card && isW(S, p, 'robot') && S.t.phase === 'action') n = S.hackDown[p].length >= 2 ? 3 : 1;
  let blink = 0;
  if (has(S, p, 'blink') && (yield* yn(S, p, 'Reshuffle Blink Scroll for +5 Move?', 'Use Blink Scroll'))) { dropItem(S, p, 'blink'); blink = 5; }
  const from = S.pos[p], gen = Math.max(0, n + S.t.moveB + blink + (isW(S, p, 'may2') && S.t.phase === 'action' ? 1 : 0));
  const away = (S.power === 'leap' ? 1 : 0) + (has(S, p, 'skates') ? 2 : 0), opts = [];
  for (let t = 0; t <= LAST; t++) { const d = t - from; if (!d || Math.abs(d) <= gen + (isAway(from, Math.sign(d)) ? away : 0)) opts.push({tile: t, label: d ? tileName(t) : 'Stay'}); }
  const c = yield* ask(S, p, 'tile', `Move up to ${gen}${away ? ' (+' + away + ' away from center)' : ''}`, opts, {verb: 'move', who: p});
  S.pos[p] = c.tile; const moved = Math.abs(c.tile - from);
  if (moved) log(S, `${nm(S, p)} moves ${moved} to ${tileName(c.tile)}.`);
  if (has(S, p, 'loom') && !o.noLoom && (yield* yn(S, p, 'Accursed Loom: Bump 1 now?', 'Bump 1'))) yield* bump(S, p, 1);
  return moved;
}
function* bump(S, p, n, o = {}) {
  let t = 1 - p;
  if (isW(S, p, 'robot') && !S.away[p]) { const c = yield* ask(S, p, 'yn', 'Robot Boy: who gets Bumped?', [{id: 'opp', label: nm(S, t)}, {id: 'self', label: 'Yourself'}]); if (c.id === 'self') t = p; }
  if (isW(S, p, 'gelf') && t !== p && !S.away[p] && !S.away[t] && S.pos[p] !== S.pos[t] && Math.abs(S.pos[p] - S.pos[t]) <= 6 && (isExit(S, S.pos[p]) && !S.t.noEscape || (yield* yn(S, p, `Gelf: first MOVE to ${nm(S, t)}’s position?`, 'Move there')))) {
    if (isExit(S, S.pos[p]) && !S.t.noEscape) win(S, p, 'escape');
    S.pos[p] = S.pos[t]; log(S, `${nm(S, p)} moves to ${nm(S, t)}’s position.`);
  }
  if (!o.noWhite) gainWhite(S, p, 1, true);
  if (S.away[t]) { log(S, `${nm(S, t)} is off the bridge and can’t be Bumped.`); return {moved: 0}; }
  const from = S.pos[t], base = Math.max(0, n + S.t.bumpB);
  const dirs = [-1, 1].filter(d => (!o.dir || d === o.dir) && (!o.away || isAway(from, d)));
  if (!dirs.length) return {moved: 0};
  const toDragon = d => (d < 0) === (S.dragon === 0);
  const dc = yield* ask(S, p, 'dir', `Bump ${t === p ? 'yourself' : nm(S, t)} ${base}: which way?`, dirs.map(d => ({dir: d, tile: clampT(from + d * base), label: toDragon(d) ? 'Toward the Dragon' : 'Toward the Exit'})), {who: t, verb: 'bump'});
  const dir = dc.dir, aw = isAway(from, dir);
  const eve = isW(S, p, 'eve') && !S.away[p] && tileColor(S.pos[p]) === 'P';
  if (eve && S.ready[1 - p] > S.ready[p]) ready(S, p, 1);
  let bonus = (eve ? 2 : 0) + (isW(S, p, 'may2') && S.t.phase === 'action' && aw ? 2 : 0) + (S.power === 'charge' && aw ? 1 : 0) + (S.power === 'hop' ? S.items[1 - p].length : 0)
    + (has(S, p, 'blade') && aw ? 1 : 0) + (has(S, p, 'cutlass') && aw ? 1 : 0);
  let total = base;
  if (bonus > 0 && (yield* yn(S, p, `Add your +${bonus} Bump bonus? (Bump ${base + bonus} instead of ${base})`, `Bump ${base + bonus}`))) total += bonus;
  if (has(S, p, 'blade') && aw && (yield* yn(S, p, 'Reshuffle Ruupart’s Blade for +4 more Bump?', `Bump ${total + 4}`))) { dropItem(S, p, 'blade'); total += 4; }
  const dest = from + dir * total, over = dest < 0 || dest > LAST;
  S.pos[t] = clampT(dest);
  log(S, `${nm(S, p)} bumps ${t === p ? 'themself' : nm(S, t)} ${total} to ${tileName(S.pos[t])}${over ? ', past the end of the bridge' : ''}.`);
  if (over) { deplete(S, t, 1); if (isW(S, p, 'december') && S.t.phase === 'action' && t !== p) ready(S, p, 2); }
  if (has(S, p, 'cutlass') && t !== p && isEnd(S.pos[t])) { log(S, 'Techno-Cutlass:'); deplete(S, t, 1); }
  if (isW(S, p, 'venice') && !S.away[p] && Math.abs(S.pos[p] - CENTER) <= 1) {
    if (!S.power) ready(S, p, 1);
    else if (S.ready[p] > 0 && (yield* yn(S, p, `Venice: deplete a Gem to put the Dragon Power (${ACTIONS[S.power].n}) in the Nest?`, 'Deplete a Gem'))) { deplete(S, p, 1); S.nest.push(S.power); log(S, `${ACTIONS[S.power].n} leaves the Dragon and goes to the Nest.`); S.power = null; }
  }
  if (t !== p && isW(S, t, 'andromeda') && S.aside[t] > 0) { S.aside[t]--; S.gems[t]++; log(S, `${nm(S, t)} gets a stacked Gem back, depleted.`); }
  return {moved: Math.abs(S.pos[t] - from), over};
}

/* ---------- action cards ---------- */
const cardOpts = (cards, extra) => cards.map(c => Object.assign({card: c, label: ACTIONS[c].n}, extra));
const ACT = {
  *fireball(S, p) { if (S.ready[p] > 0 && (yield* yn(S, p, 'Fireball: deplete a Gem to Bump 5?', 'Deplete a Gem'))) { deplete(S, p, 1); yield* bump(S, p, 5); } },
  *dazzle(S, p) {
    yield* move(S, p, 2, {card: 1});
    if (S.nest.length) { const c = yield* ask(S, p, 'pick', 'Dazzle: put a Nest card on the bottom of the Action Deck?', cardOpts(S.nest, {zone: 'nest'}).concat({id: 'no', label: 'No thanks'})); if (c.card) { S.nest.splice(S.nest.indexOf(c.card), 1); S.deck.unshift(c.card); log(S, `${nm(S, p)} puts ${ACTIONS[c.card].n} from the Nest on the bottom of the deck.`); } }
  },
  *flamearrow(S, p) {
    const t = 1 - p, opts = [{id: 'two', label: 'Bump 2 (either way)'}];
    if (!S.away[t]) opts.unshift({id: 'four', label: 'Bump 4 away from center'});
    const c = yield* ask(S, p, 'yn', 'Flame Arrow', opts);
    if (c.id === 'four') yield* bump(S, p, 4, {away: 1}); else yield* bump(S, p, 2);
  },
  *dart(S, p) { yield* bump(S, p, 1); deplete(S, 1 - p, 1); },
  *soda(S, p) {
    if (S.hand[p].length) {
      const c = yield* ask(S, p, 'card', 'Soda: choose a card from your hand to put away', cardOpts(S.hand[p], {zone: 'hand'}), {show: 1});
      const w = yield* ask(S, p, 'yn', `Put ${ACTIONS[c.card].n} where?`, [{id: 'nest', label: 'Into the Nest'}, {id: 'deck', label: 'Bottom of the Action Deck'}]);
      S.hand[p].splice(S.hand[p].indexOf(c.card), 1);
      if (w.id === 'nest') { S.nest.push(c.card); log(S, `${nm(S, p)} puts ${ACTIONS[c.card].n} into the Nest.`); } else { S.deck.unshift(c.card); log(S, `${nm(S, p)} puts a card on the bottom of the deck.`); }
    }
    ready(S, p, 1);
  },
  *transfer(S, p) { ready(S, p, 1); deplete(S, 1 - p, 1); },
  *charge(S, p) { if ((yield* move(S, p, 2, {card: 1})) === 2) ready(S, p, 1); },
  *gale(S, p) {
    const t = 1 - p;
    const before = S.away[t] ? null : S.pos[t]; const r = yield* bump(S, p, 2, {gale: 1});
    const dir = before == null || !r.moved ? 0 : Math.sign(S.pos[t] - before);
    yield* teleport(S, p, 1, dir ? {dir, why: 'Gale'} : {why: 'Gale'});
  },
  *bait(S, p) {
    const c = S.nest.filter(x => x !== 'insight');
    if (c.length) { const k = yield* ask(S, p, 'pick', 'Bait: take a card from the Nest?', cardOpts(c, {zone: 'nest'}).concat({id: 'no', label: 'No thanks'})); if (k.card) { S.nest.splice(S.nest.indexOf(k.card), 1); S.hand[p].push(k.card); log(S, `${nm(S, p)} takes ${ACTIONS[k.card].n} from the Nest.`); } }
  },
  *insight(S, p) {
    const o = cardOpts(S.hand[1 - p], {zone: 'opp'}).concat(cardOpts(S.nest, {zone: 'nest'}));
    log(S, `${nm(S, 1 - p)}’s hand is revealed: ${S.hand[1 - p].map(c => ACTIONS[c].n).join(', ') || 'no cards'}.`);
    if (o.length) {
      const k = yield* ask(S, p, 'pick', `Insight: take a card from ${nm(S, 1 - p)}’s hand or from the Nest`, o, {show: 1, noDet: 1, reveal: 1});
      const from = k.zone === 'opp' ? S.hand[1 - p] : S.nest; from.splice(from.indexOf(k.card), 1); S.hand[p].push(k.card);
      log(S, `${nm(S, p)} takes ${ACTIONS[k.card].n} from ${k.zone === 'opp' ? nm(S, 1 - p) + '’s hand' : 'the Nest'}.`);
    }
    if (S.ready[p] === 1) ready(S, p, 1);
  },
  *hop(S, p) { yield* move(S, p, 3, {card: 1}); },
  *leap(S, p) { yield* move(S, p, 2, {card: 1}); if (S.ready[p] > 0 && !S.away[p] && (yield* yn(S, p, 'Leap: deplete a Gem to Teleport 2?', 'Deplete a Gem'))) { deplete(S, p, 1); yield* teleport(S, p, 2); } },
  *shockwave(S, p) {
    yield* bump(S, p, 2);
    const t = 1 - p, mv = [...new Set(S.hand[t].filter(c => ACTIONS[c].move))];
    if (mv.length) { const c = yield* ask(S, t, 'card', 'Shockwave: choose a MOVE card to shuffle into the deck', cardOpts(mv, {zone: 'hand'})); S.hand[t].splice(S.hand[t].indexOf(c.card), 1); S.deck.push(c.card); shuffle(S, S.deck); log(S, `${nm(S, t)} shuffles ${ACTIONS[c.card].n} into the deck.`); }
    else log(S, `${nm(S, t)} reveals a hand with no MOVE cards: ${S.hand[t].map(c => ACTIONS[c].n).join(', ') || 'no cards'}.`);
  },
  *checkmate(S, p) { yield* move(S, p, 2, {card: 1}); if (S.ready[p] > 0 && (yield* yn(S, p, 'Checkmate: deplete a Gem to Bump 3?', 'Deplete a Gem'))) { deplete(S, p, 1); yield* bump(S, p, 3); } },
};
function* playCard(S, p, c, dest) {
  S.hand[p].splice(S.hand[p].indexOf(c), 1); S.last = c; S.inPlay.push(c);
  log(S, `${nm(S, p)} plays ${ACTIONS[c].n}.`, {card: c, by: p});
  const place = () => { S.inPlay.splice(S.inPlay.lastIndexOf(c), 1); if (dest === 'shuffle') { S.deck.push(c); shuffle(S, S.deck); } else S.nest.push(c); };
  if (c === 'step') {
    yield* teleport(S, p, 1); place();
    if (S.hand[p].length) { const k = yield* ask(S, p, 'card', 'Step: play another Action card?', cardOpts(S.hand[p], {zone: 'hand'}).concat({id: 'no', label: 'No, stop here'})); if (k.card) yield* playCard(S, p, k.card, dest); }
    return;
  }
  yield* ACT[c](S, p); place();
  const t = 1 - p;
  if (ACTIONS[c].bump && isW(S, p, 'bill') && S.t.phase === 'action') {
    const give = [...new Set(S.hand[t].filter(x => ACTIONS[x].bump))];
    const k = give.length ? yield* ask(S, t, 'card', `Bill Milton: give ${nm(S, p)} a BUMP card? If you don’t, Bill readies a Gem and Teleports 1.`, cardOpts(give, {zone: 'hand'}).concat({id: 'no', label: 'Give nothing'})) : {};
    if (k.card) { S.hand[t].splice(S.hand[t].indexOf(k.card), 1); S.hand[p].push(k.card); log(S, `${nm(S, t)} gives ${nm(S, p)} ${ACTIONS[k.card].n}.`); }
    else { ready(S, p, 1); yield* teleport(S, p, 1, {why: 'Bill Milton'}); }
  }
  if (c === 'gale' && isW(S, p, 'lori')) {
    const o = [{id: 'gem', label: `Deplete a Gem (${nm(S, p)} readies one)`}]; if (S.hand[t].includes('step')) o.unshift({id: 'step', label: 'Reveal and shuffle your Step'});
    const k = yield* ask(S, t, 'yn', 'Lori Ann-Davis played Gale. Choose:', o);
    if (k.id === 'step') { S.hand[t].splice(S.hand[t].indexOf('step'), 1); S.deck.push('step'); shuffle(S, S.deck); log(S, `${nm(S, t)} shuffles Step into the deck.`); } else { deplete(S, t, 1); ready(S, p, 1); }
  }
  if (ACTIONS[c].bump && isW(S, p, 'andromeda') && S.gems[p] > 0) {
    const o = [{id: 0, label: 'None'}]; for (let i = 1; i <= Math.min(3, S.gems[p]); i++) o.push({id: i, label: `Stack ${i}`});
    const k = yield* ask(S, p, 'yn', 'Andromeda: stack Gems beside your Wizard? (They come back readied, one per turn.)', o);
    if (k.id) { const d = Math.min(k.id, dep(S, p)); S.gems[p] -= k.id; S.ready[p] -= k.id - d; S.aside[p] += k.id; log(S, `${nm(S, p)} stacks ${k.id} Gem${k.id > 1 ? 's' : ''} beside her Wizard.`); }
  }
}

/* ---------- bridge hacks ---------- */
const HACKFX = {
  *law(S, p) { const d = yield* teleport(S, p, 2); yield* bump(S, p, 1, d ? {dir: -Math.sign(d), noWhite: 1} : {noWhite: 1}); },
  *sk8(S, p) { yield* teleport(S, p, 3); },
  *lullaby(S, p) { const c = yield* ask(S, p, 'card', 'chip tune lullaby: put a card from your hand into the Nest', cardOpts(S.hand[p], {zone: 'hand'}), {show: 1}); if (c) { S.hand[p].splice(S.hand[p].indexOf(c.card), 1); S.nest.push(c.card); log(S, `${nm(S, p)} puts ${ACTIONS[c.card].n} into the Nest.`); } },
  *forge(S, p) { S.hand[p].splice(S.hand[p].indexOf('fireball'), 1); S.deck.push('fireball'); shuffle(S, S.deck); log(S, `${nm(S, p)} reveals and shuffles Fireball.`); yield* pickItem(S, p, 'syntho forge: gain an Item'); },
  *mondo(S, p) { yield* bump(S, p, 4, {away: 1, noWhite: 1}); },
  *wyrm(S, p) { if (!S.away[p]) { S.pos[p] = LAST - S.pos[p]; log(S, `${nm(S, p)} wyrmholes to ${tileName(S.pos[p])}.`); } },
  *gems(S, p) { ready(S, p, 2); },
  *pills(S, p) { yield* bump(S, p, 2, {noWhite: 1}); },
  *deals(S, p) {
    const a = yield* ask(S, p, 'card', 'Illicit card deals: give up which card from your hand?', cardOpts(S.hand[p], {zone: 'hand'}), {show: 1});
    const b = yield* ask(S, p, 'pick', 'Take which card from the Nest?', cardOpts(S.nest, {zone: 'nest'}), {show: 1});
    S.hand[p].splice(S.hand[p].indexOf(a.card), 1); S.nest.splice(S.nest.indexOf(b.card), 1); S.hand[p].push(b.card); S.nest.push(a.card);
    log(S, `${nm(S, p)} swaps ${ACTIONS[a.card].n} for ${ACTIONS[b.card].n} from the Nest.`); deplete(S, 1 - p, 1);
  },
};
const hackCost = (S, p, h) => Math.max(0, HACKS[h].cost - (isW(S, p, 'may') ? 1 : 0));
const hackOk = (S, p, h) => h === 'forge' ? S.hand[p].includes('fireball') && (S.market.length || S.itemDeck.length) : h === 'lullaby' ? S.hand[p].length > 0 : h === 'deals' ? S.hand[p].length > 0 && S.nest.length > 0 : true;
function* doHack(S, p, h, o = {}) {
  const cost = hackCost(S, p, h); S.white[p] -= cost; S.supply += cost;
  log(S, `${nm(S, p)} plays the Bridge Hack ${HACKS[h].n} for ${cost} White Gem${cost === 1 ? '' : 's'}.`);
  yield* HACKFX[h](S, p);
  const i = S.hacks.indexOf(h); if (i < 0) return;
  const refill = () => { if (S.hackDeck.length) S.hacks.splice(i, 0, S.hackDeck.pop()); };
  if (o.reshuffle) { S.hacks.splice(i, 1); S.hackDeck.push(h); shuffle(S, S.hackDeck); refill(); }
  else if (isW(S, p, 'may') || isW(S, p, 'robot')) { S.hacks.splice(i, 1); S.hackDown[p].push(h); refill(); log(S, `${HACKS[h].n} is flipped face down.`); }
}
function* chooseHack(S, p, prompt, o) {
  const av = S.hacks.filter(h => S.white[p] >= hackCost(S, p, h) && hackOk(S, p, h));
  if (!av.length) return;
  const c = yield* ask(S, p, 'hack', prompt, av.map(h => ({hack: h, label: `${HACKS[h].n} (${hackCost(S, p, h)})`})).concat({id: 'no', label: 'No Hack'}));
  if (c.hack) yield* doHack(S, p, c.hack, o);
}

/* ---------- turn ---------- */
function* gemPhase(S, p) {
  S.t.phase = 'gem';
  const o = [], opp = 1 - p, near = k => !S.away[p] && !S.away[opp] && Math.abs(S.pos[p] - S.pos[opp]) <= k;
  if (S.ready[p] > 0 && !S.away[p] && !S.gelf[opp]) o.push({act: 'tp', label: 'Green Gem: Teleport 2'});
  if (dep(S, p) > 0 && !S.away[p] && isGemTile(S, S.pos[p])) o.push({act: 'ready', label: 'Ready a Gem (you’re on a Gem tile)'});
  const cost = itemCost(S);
  if (S.ready[p] >= cost && !(isW(S, p, 'may2') && cost === 3)) for (const it of S.market) o.push({act: 'buy', item: it, label: `Buy ${ITEMS[it].n} (${cost} Gems)`});
  for (const h of S.hacks) if (S.white[p] >= hackCost(S, p, h) && hackOk(S, p, h)) o.push({act: 'hack', hack: h, label: `Hack: ${HACKS[h].n} (${hackCost(S, p, h)} White)`});
  if (isW(S, p, 'bunny') && near(3) && S.ready[p] > 0 && S.hand[p].length) o.push({act: 'bunny', label: 'Bunny: deplete a Gem to play an Action card, then shuffle it'});
  if (isW(S, p, 'may') && S.hackDown[p].length) o.push({act: 'mayhide', label: 'May: flip a Hack face-up and take your Wizard off the bridge'});
  if (isW(S, p, 'omar')) {
    if (!S.items[p].length && S.ready[p] > 0 && S.white[p] >= 2 && (S.market.length || S.itemDeck.length)) o.push({act: 'omarbuy', label: 'Omar: deplete a Gem and discard 2 White Gems to gain an Item'});
    for (const it of S.items[p]) o.push({act: 'omarbump', item: it, label: `Omar: reshuffle ${ITEMS[it].n} to Bump 6`});
  }
  if (isW(S, p, 'andromeda') && S.ready[p] > 0) o.push({act: 'andbump', label: 'Andromeda: deplete a Gem to Bump 2'});
  if (isW(S, p, 'peebnup') && near(6)) o.push({act: 'peeb', label: 'Peebnup: both players ready a Gem, then you ready another'});
  if (has(S, p, 'transmog')) o.push({act: 'transmog', item: 'transmog', label: 'Transmogrifier: reshuffle it for 5 White Gems, then you may Hack'});
  o.push({act: 'pass', label: 'End Gem Phase'});
  const c = yield* ask(S, p, 'gem', 'Gem Phase: choose one Gem Action', o, {show: 1});
  switch (c.act) {
    case 'tp': deplete(S, p, 1); yield* teleport(S, p, 2); break;
    case 'ready': ready(S, p, 1); break;
    case 'buy': deplete(S, p, cost); yield* gainItem(S, p, c.item, S.market);
      if (isW(S, p, 'abragail')) {
        const k = yield* ask(S, p, 'pick', 'Abragail: take a card from the Nest, or ready a Gem', cardOpts(S.nest, {zone: 'nest'}).concat({id: 'gem', label: 'Ready a Gem'}, {id: 'no', label: 'Neither'}));
        if (k.card) { S.nest.splice(S.nest.indexOf(k.card), 1); S.hand[p].push(k.card); log(S, `${nm(S, p)} takes ${ACTIONS[k.card].n} from the Nest.`); } else if (k.id === 'gem') ready(S, p, 1);
      } break;
    case 'hack': yield* doHack(S, p, c.hack); break;
    case 'bunny': { deplete(S, p, 1); const k = yield* ask(S, p, 'card', 'Bunny: play which Action card?', cardOpts(S.hand[p], {zone: 'hand'}), {show: 1}); yield* playCard(S, p, k.card, 'shuffle'); break; }
    case 'mayhide': { const h = S.hackDown[p].pop(); S.hackDeck.unshift(h); S.away[p] = true; log(S, `${nm(S, p)} takes her Wizard card off the bridge. She can’t be bumped or pounced.`); break; }
    case 'omarbuy': deplete(S, p, 1); S.white[p] -= 2; S.supply += 2; yield* pickItem(S, p, 'Omar: gain an Item'); break;
    case 'omarbump': dropItem(S, p, c.item); yield* bump(S, p, 6); break;
    case 'andbump': deplete(S, p, 1); yield* bump(S, p, 2); break;
    case 'peeb': ready(S, p, 1); ready(S, opp, 1); ready(S, p, 1); break;
    case 'transmog': dropItem(S, p, 'transmog'); gainWhite(S, p, 5); yield* chooseHack(S, p, 'Transmogrifier: play a Bridge Hack?', {reshuffle: 1}); break;
  }
}
function* dragonCheck(S, p) {
  S.t.phase = 'dragon';
  let w = wings(S); const need = flightNeed(S);
  if (has(S, p, 'thunderbox')) {
    const c = yield* ask(S, p, 'yn', `Dragon Check: ${w} Wings in the Nest (Flight at ${need}, Roost at 7 cards; there are ${S.nest.length}). Use Thunderbox?`, [{id: 0, label: 'Keep it'}, {id: 2, label: 'Add 2 Wings'}, {id: -2, label: 'Subtract 2 Wings'}]);
    if (c.id) { dropItem(S, p, 'thunderbox'); w += c.id; log(S, `Thunderbox: the Nest counts as ${w} Wings.`); }
  }
  const order = [p, 1 - p];
  let ev = null;
  if (w >= need && S.nest.length) {
    ev = 'flight'; const last = S.nest.pop();
    if (S.power) S.deck.push(S.power);
    S.power = last; S.deck.push(...S.nest); S.nest = []; shuffle(S, S.deck); S.dragon = 1 - S.dragon; S.flights++;
    log(S, `FLIGHT! ${w} Wings. The Dragon flies to the ${S.dragon ? 'right' : 'left'} end. New Dragon Power: ${ACTIONS[last].n}${ACTIONS[last].pw ? ' — ' + ACTIONS[last].pw : ' (no power)'}`);
    if (last === 'bait') deplete(S, p, 2);
  } else if (S.nest.length >= 7) {
    ev = 'roost'; S.deck.push(...S.nest); S.nest = []; shuffle(S, S.deck); if (S.deck.length) S.nest.push(S.deck.pop());
    log(S, `ROOST. The Nest is shuffled into the deck; ${S.nest.length ? ACTIONS[S.nest[0]].n : 'nothing'} starts the new Nest.`);
  }
  if (!ev) return;
  S.lastEv = ev;
  for (const q of order) {
    const hadGelf = S.gelf[q];
    if (hadGelf) { S.gelf[q] = 0; S.gems[q]++; if (S.gelfR[q]) S.ready[q]++; log(S, `${nm(S, q)}’s Gem returns from the Dragon.`); ready(S, q, 1); }
    if (ev === 'flight') {
      if (isW(S, q, 'trevor')) ready(S, q, 1);
      if (isW(S, q, 'gelf') && !hadGelf && S.gems[q] > 0) {
        const o = [{id: 'no', label: 'No'}]; if (dep(S, q) > 0) o.push({id: 'd', label: 'Place a depleted Gem'}); if (S.ready[q] > 0) o.push({id: 'r', label: 'Place a ready Gem'});
        const c = yield* ask(S, q, 'yn', 'Gelf: place a Gem on the Dragon? (Flight needs +1 Wing and the opponent may not Teleport.)', o);
        if (c.id !== 'no') { S.gelf[q] = 1; S.gelfR[q] = c.id === 'r' ? 1 : 0; S.gems[q]--; if (c.id === 'r') S.ready[q]--; log(S, `${nm(S, q)} places a Gem on the Dragon.`); }
      }
    } else {
      if (isW(S, q, 'trevor')) deplete(S, q, 1);
      if (isW(S, q, 'derby')) yield* teleport(S, q, 2, {why: 'Derby, on Roost'});
      if (has(S, q, 'backpack')) ready(S, q, 3);
      if (has(S, q, 'vr')) gainWhite(S, q, 2);
      if (isW(S, q, 'lori') && S.deck.length) {
        const u = [...new Set(S.deck)].sort();
        const c = yield* ask(S, q, 'pick', 'Lori: search the deck for a card', cardOpts(u, {zone: 'deck'}), {show: 1, noDet: 1});
        S.deck.splice(S.deck.indexOf(c.card), 1); S.hand[q].push(c.card); shuffle(S, S.deck); log(S, `${nm(S, q)} searches the deck and draws ${ACTIONS[c.card].n}.`);
      }
      if (isW(S, q, 'bill') && S.power && S.hand[q].length) {
        const c = yield* ask(S, q, 'card', `Bill: exchange the Dragon Power (${ACTIONS[S.power].n}) for a card in your hand to gain 2 White Gems?`, cardOpts([...new Set(S.hand[q])], {zone: 'hand'}).concat({id: 'no', label: 'No'}));
        if (c.card) { S.hand[q].splice(S.hand[q].indexOf(c.card), 1); S.hand[q].push(S.power); log(S, `${nm(S, q)} swaps ${ACTIONS[c.card].n} in as the Dragon Power and takes ${ACTIONS[S.power].n}.`); S.power = c.card; gainWhite(S, q, 2); }
      }
    }
  }
  while (S.market.length < 3 && S.itemDeck.length) S.market.push(S.itemDeck.pop());
}
function* turn(S, p) {
  S.turn++; S.t = {moveB: 0, bumpB: 0, noEscape: false, phase: 'start'}; S.lastEv = null;
  log(S, `— Turn ${S.turn}: ${nm(S, p)} —`);
  if (S.away[p]) { S.away[p] = false; S.pos[p] = CENTER; if (isW(S, p, 'may')) S.wiz[p] = 'may2'; log(S, `${nm(S, p)} returns to the center tile as the Hacking Avenger.`); }
  if (isW(S, p, 'andromeda') && S.aside[p] > 0) { S.aside[p]--; S.gems[p]++; S.ready[p]++; log(S, `${nm(S, p)} gets a stacked Gem back, readied.`); }
  if (isW(S, p, 'venice') && S.pos[p] !== CENTER) yield* teleport(S, p, 1, {dir: Math.sign(CENTER - S.pos[p]), why: 'Venice, turn start'});
  if (isW(S, p, 'abragail') && (S.ready[p] === 1 || S.ready[p] === 2)) { S.t.moveB++; S.t.bumpB++; log(S, `${nm(S, p)} has +1 Move and +1 Bump this turn.`); }
  if (isW(S, p, 'december')) { const b = wings(S) <= 5 ? 2 : -2; S.t.bumpB += b; log(S, `${nm(S, p)} has ${b > 0 ? '+2' : '−2'} Bump this turn.`); }
  // Action Phase
  S.t.phase = 'action';
  if (S.hand[p].length) {
    const o = cardOpts(S.hand[p], {zone: 'hand'});
    if (isW(S, p, 'trevor') && S.ready[p] >= 2) o.push({id: 'trevor', label: 'Trevor: deplete 2 Gems to play up to 3 Actions'});
    const c = yield* ask(S, p, 'card', 'Action Phase: play an Action card', o, {show: 1, main: 1});
    if (c.id === 'trevor') {
      deplete(S, p, 2); S.t.noEscape = true; log(S, `${nm(S, p)} plays a medley of up to 3 Actions (no escaping this turn).`);
      for (let i = 0; i < 3 && S.hand[p].length; i++) { const k = yield* ask(S, p, 'card', `Trevor: play Action ${i + 1} of 3`, cardOpts(S.hand[p], {zone: 'hand'}).concat(i ? [{id: 'no', label: 'Stop here'}] : []), {show: 1}); if (!k.card) break; yield* playCard(S, p, k.card, 'shuffle'); }
    } else yield* playCard(S, p, c.card);
  }
  yield* gemPhase(S, p);
  if (!S.away[p] && isThreat(S, S.pos[p])) win(S, 1 - p, 'pounce');
  if (isW(S, p, 'derby')) { const w = wings(S); if (w === 3 || w === 5) ready(S, p, 1); }
  yield* dragonCheck(S, p);
  S.t.phase = 'draw';
  if (S.power === 'dart' && !S.away[p]) yield* teleport(S, p, 1, {dir: S.dragon === 0 ? 1 : -1, why: 'Dragon Power (Magic Dart)'});
  let n = 0; while (S.hand[p].length < 4 && S.deck.length) { S.hand[p].push(S.deck.pop()); n++; }
  if (n) log(S, `${nm(S, p)} draws ${n} card${n > 1 ? 's' : ''}.`);
}
function* play(S) {
  try {
    while (S.winner == null) {
      yield {kind: 'turn'};
      yield* turn(S, S.cur);
      S.cur = 1 - S.cur;
      if (S.turn >= (S.maxTurns || 400)) { S.winner = -1; S.reason = 'draw'; }
    }
  } catch (e) { if (e !== END) throw e; }
}

/* ---------- setup ---------- */
function newState(o = {}) {
  const S = {seed: (o.seed != null ? o.seed : Math.floor(Math.random() * 2 ** 31)) | 0, turn: 0, cur: 0, dragon: 0, power: null, flights: 0,
    deck: DECK.slice(), nest: [], hand: [[], []], pos: [9, 11], wiz: (o.wiz || ['derby', 'eve']).slice(), ready: [1, 1], gems: [3, 3], aside: [0, 0],
    items: [[], []], market: [], itemDeck: Object.keys(ITEMS), hacks: [], hackDeck: Object.keys(HACKS), hackDown: [[], []], white: [0, 0], supply: 8,
    away: [false, false], gelf: [0, 0], gelfR: [0, 0], once: [0, 0], t: {moveB: 0, bumpB: 0, noEscape: false, phase: 'start'}, inPlay: [], winner: null, reason: null, last: null, lastEv: null, log: []};
  if (o.names) S.names = o.names;
  const first = o.first != null ? o.first : (rnd(S) < 0.5 ? 0 : 1);
  S.cur = first; S.first = first; S.pos[first] = 9; S.pos[1 - first] = 11;
  shuffle(S, S.deck); shuffle(S, S.itemDeck); shuffle(S, S.hackDeck);
  for (let i = 0; i < 3; i++) { S.market.push(S.itemDeck.pop()); S.hacks.push(S.hackDeck.pop()); }
  for (let p = 0; p < 2; p++) { if (S.wiz[p] === 'omar') S.gems[p] = 2; for (let i = 0; i < 4; i++) S.hand[p].push(S.deck.pop()); }
  log(S, `${nm(S, first)} goes first and starts on the Dragon’s side of the center.`);
  return S;
}

/* ---------- running a game ---------- */
class Game {
  constructor(S) { this.S = S; this.gen = play(S); this.req = null; this.snap = null; this.decs = []; this.step(); }
  step(v) {
    let r = this.gen.next(v);
    while (!r.done && r.value.kind === 'turn') { this.snap = snapshot(this.S); this.decs = []; r = this.gen.next(); }
    this.req = r.done ? null : r.value;
  }
  answer(i) { this.decs.push(i); this.step(i); }
  get over() { return this.S.winner != null; }
  static resume(snap, decs, logArr) {   // rebuild a game from a turn-start snapshot plus the choices made since
    const S = clone(snap); S.log = logArr || []; const G = new Game(S);
    for (const d of decs || []) { if (!G.req) break; G.answer(d); }
    return G;
  }
}
function snapshot(S) { const l = S.log; S.log = undefined; const c = clone(S); S.log = l; return c; }
/* Play on from a snapshot: replay `decs`, then let policy(req, S) choose, for `turns` turns (1 = to the end of the
   current turn). det = {me, pts}: the cards player `me` cannot see are reshuffled when the replay ends (and at the
   same points, with the same seeds, whenever the line is replayed, so a line always plays out the same way). */
function simulate(snap, decs, policy, turns, det, rec) {
  const S = clone(snap), g = play(S); let r = g.next(), n = 0, i = 0;
  for (;;) {
    if (r.done) break;
    const q = r.value;
    if (q.kind === 'turn') { if (++n > turns) break; r = g.next(); continue; }
    if (det && !q.noDet && (det.pts[i] != null || i === decs.length)) { if (det.pts[i] == null) det.pts[i] = Math.floor(Math.random() * 2 ** 31); determinize(S, det.me, det.pts[i]); }
    let a;
    if (i < decs.length) a = decs[i] < q.opts.length ? decs[i] : 0;
    else { a = policy(q, S); if (rec) rec.push(a); }
    i++; r = g.next(a);
  }
  return S;
}
function determinize(S, me, seed) {
  const o = 1 - me, pool = S.deck.concat(S.hand[o]).sort(), n = S.hand[o].length, R = {seed};
  shuffle(R, pool); S.hand[o] = pool.slice(0, n); S.deck = pool.slice(n); S.seed = R.seed;
}
function checkState(S) {   // every card, gem and item is somewhere exactly once
  const cards = S.deck.concat(S.nest, S.hand[0], S.hand[1], S.inPlay, S.power ? [S.power] : []).sort().join();
  if (cards !== DECK.slice().sort().join()) return 'action cards: ' + cards;
  if (S.itemDeck.concat(S.market, S.items[0], S.items[1]).sort().join() !== Object.keys(ITEMS).sort().join()) return 'items';
  if (S.hackDeck.concat(S.hacks, S.hackDown[0], S.hackDown[1]).sort().join() !== Object.keys(HACKS).sort().join()) return 'hacks';
  if (S.white[0] + S.white[1] + S.supply !== 8) return 'white gems';
  for (let p = 0; p < 2; p++) {
    if (S.gems[p] + S.aside[p] + S.gelf[p] !== (S.wiz[p] === 'omar' ? 2 : 3)) return 'gems of ' + p;
    if (S.ready[p] < 0 || S.ready[p] > S.gems[p]) return 'ready of ' + p;
    if (S.pos[p] < 0 || S.pos[p] > LAST) return 'pos';
  }
  return null;
}
