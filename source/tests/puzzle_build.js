// The puzzles: each one is a hand-set position that teaches one thing about the game. This file builds them, proves
// each has a forced solution, proves the lesson's key move is really needed, and writes puzzles.json.
//   node tests/puzzle_build.js          (after python3 build.py; then build again to include them)
//   node tests/puzzle_build.js -v       also lists every winning first choice
// Bridge tiles are 0..20: the Dragon starts at the 0 end, so 0-4 are Threatened and 16-20 are the Exit.
// Gem tiles: 5, 8, 12, 15. Purple tiles: 6, 8, 11, 13, 15. You are player 0 and move first.
const E = require('./eng_all.js'), fs = require('fs'), path = require('path');
const verbose = process.argv.includes('-v');
const ALL_ITEMS = Object.keys(E.ITEMS), ALL_HACKS = Object.keys(E.HACKS);
function build(o) {
  const pool = E.DECK.slice(), take = c => { const i = pool.indexOf(c); if (i < 0) throw new Error(o.name + ': no ' + c + ' left'); pool.splice(i, 1); return c; };
  const S = E.newState({wiz: o.wiz, seed: 7, first: 0, ed: 2, names: o.wiz.map(w => E.WIZ[w].s)});
  S.hand = [o.hand.map(take), o.opp.map(take)]; S.nest = (o.nest || []).map(take); S.power = o.power ? take(o.power) : null;
  // Normal rules throughout: both hands hold 4 cards, all 17 Action cards are in the game, and everyone draws back
  // to 4. The draws are scripted, as part of the puzzle: draws lists the cards you will draw, in order, and oppDraws
  // the opponent's. Each player's order is fixed whatever either of them plays (see drawCard in engine.js).
  if (S.hand[0].length !== 4 || S.hand[1].length !== 4) throw new Error(o.name + ': both hands must hold 4 cards');
  S.script = [(o.draws || []).map(take), (o.oppDraws || []).map(take)]; pool.forEach((c, i) => S.script[i % 2].push(c));   // every card left in the deck is in one player's script
  S.deck = S.script[0].concat(S.script[1]).sort((x, y) => E.DECK.indexOf(y) - E.DECK.indexOf(x));
  S.pos = o.pos.slice(); S.dragon = o.dragon || 0; S.ready = (o.ready || [0, 0]).slice(); S.gems = (o.gems || [3, 3]).slice();
  S.white = (o.white || [0, 0]).slice(); S.supply = 8 - S.white[0] - S.white[1];
  const items = ALL_ITEMS.slice(), ti = x => { items.splice(items.indexOf(x), 1); return x; };
  S.items = [(o.items || [[], []])[0].map(ti), (o.items || [[], []])[1].map(ti)]; S.market = (o.market || ['thunderbox', 'backpack', 'transmog']).map(ti); S.itemDeck = items;
  const hacks = ALL_HACKS.slice(), th = x => { hacks.splice(hacks.indexOf(x), 1); return x; };
  S.hacks = (o.hacks || ['lullaby', 'deals', 'mondo']).map(th); S.hackDeck = hacks;
  S.turn = o.turn || 6; S.started = 1; S.cur = 0; S.first = 0; S.log = undefined; S.known = [[], []]; S.rev = 0;
  const bad = E.checkState(S); if (bad) throw new Error(o.name + ': ' + bad);
  return new E.Game(S).snap;
}
const label = o => o.label;
const T1 = 7, T2 = 9;   // S.turn during your first and second turns (puzzles start after turn 6)
const PUZZLES = [
  { name: 'One Small Step', goal: {type: 'escape', n: 1},
    // Step teleports you onto the Exit, and then lets you play the MOVE that wins.
    wiz: ['peebnup', 'gelf'], pos: [15, 7], hand: ['step', 'hop', 'gale', 'soda'], opp: ['bait', 'transfer', 'insight', 'charge'], nest: ['dart', 'leap'],
    need: [['Step', o => o.card === 'step']] },
  { name: 'The Deep End', goal: {type: 'defeat', n: 1},
    // Shoving someone onto a Threatened tile is not enough if they can teleport back out: push them deeper.
    wiz: ['abragail', 'bunny'], pos: [11, 6], ready: [0, 1], hand: ['gale', 'flamearrow', 'dart', 'hop'], opp: ['bait', 'insight', 'soda', 'fireball'], nest: ['charge', 'charge', 'leap'],
    need: [['Flame Arrow', o => o.card === 'flamearrow']] },
  { name: 'Pickpocket', goal: {type: 'survive', n: 1},
    // An opponent on an Exit tile still needs a MOVE card to leave: Insight can take it.
    wiz: ['lori', 'trevor'], pos: [9, 17], hand: ['insight', 'transfer', 'soda', 'bait'], opp: ['hop', 'fireball', 'gale', 'dart'], nest: ['step', 'charge'],
    need: [['Insight', o => o.card === 'insight' && o.zone === 'hand']] },
  { name: 'Green Means Go', goal: {type: 'escape', n: 3},
    // Two Gem teleports in two turns carry you to the Exit; the MOVE card has to be saved for the last turn.
    wiz: ['robot', 'omar'], gems: [3, 2], pos: [12, 9], ready: [2, 0], hand: ['hop', 'transfer', 'fireball', 'dart'], opp: ['leap', 'charge', 'charge', 'dazzle'], nest: ['insight'],
    draws: ['shockwave', 'flamearrow', 'gale', 'bait'], oppDraws: ['step', 'soda', 'gale', 'checkmate'],
    need: [['a Gem teleport on turn 1', (o, S) => o.act === 'tp' && S.turn === T1], ['a Gem teleport on turn 2', (o, S) => o.act === 'tp' && S.turn === T2]] },
  { name: 'Purple Patch', goal: {type: 'defeat', n: 2},
    // Eve (2nd Edition): start your turn on a purple tile for +2 Bump all turn.
    wiz: ['eve', 'lori'], pos: [10, 7], ready: [1, 0], hand: ['flamearrow', 'soda', 'checkmate', 'dazzle'], opp: ['bait', 'transfer', 'charge', 'insight'], nest: ['gale'], draws: ['charge', 'shockwave', 'fireball', 'hop'], oppDraws: ['dart', 'gale', 'leap', 'step'],
    need: [['ending turn 1 on a purple tile', (o, S, q) => q.kind === 'tile' && q.who === 0 && q.verb !== 'bump' && S.turn === T1 && [6, 8, 11, 13, 15].includes(o.tile)]] },
  { name: 'Retail Therapy', goal: {type: 'defeat', n: 2},
    // Buy Ruupart's Blade, then cash it in for a much bigger Bump.
    wiz: ['bill', 'eve'], pos: [10, 7], ready: [3, 0], hand: ['dart', 'hop', 'soda', 'step'], opp: ['fireball', 'shockwave', 'gale', 'flamearrow'], nest: ['charge', 'transfer'], market: ['blade', 'backpack', 'thunderbox'], draws: ['insight', 'leap', 'dazzle', 'charge'], oppDraws: ['gale', 'bait', 'checkmate'],
    need: [['buying an Item', o => o.act === 'buy']] },
  { name: 'Turn the Tables', goal: {type: 'escape', n: 2},
    // A Flight swaps the ends: the Threatened tiles beside you become the Exit.
    wiz: ['trevor', 'peebnup'], pos: [5, 13], hand: ['transfer', 'step', 'hop', 'soda'], opp: ['bait', 'dazzle', 'charge', 'leap'], nest: ['fireball', 'dart', 'checkmate', 'charge'], draws: ['gale', 'flamearrow', 'insight'], oppDraws: ['shockwave', 'gale'],
    need: [['Transfer going to the Nest on turn 1', (o, S) => o.card === 'transfer' && S.turn === T1]] },
  { name: 'Cheat Code', goal: {type: 'escape', n: 2},
    // A Bump earns the White Gem that pays for a Bridge Hack.
    wiz: ['omar', 'robot'], gems: [2, 3], pos: [13, 9], white: [2, 0], hand: ['dart', 'hop', 'soda', 'transfer'], opp: ['bait', 'charge', 'leap', 'dazzle'], nest: ['insight', 'step'], hacks: ['sk8', 'lullaby', 'mondo'], draws: ['fireball', 'gale', 'flamearrow'], oppDraws: ['charge', 'gale', 'shockwave', 'checkmate'],
    need: [['a Bridge Hack', o => o.act === 'hack'], ['Magic Dart', o => o.card === 'dart']] },
  { name: 'Clipped Wings', goal: {type: 'survive', n: 2},
    // Dazzle can pull a heavy card out of the Nest, so the next card brings a Roost instead of a Flight.
    wiz: ['derby', 'eve'], pos: [14, 8], hand: ['dazzle', 'shockwave', 'transfer', 'fireball'], opp: ['flamearrow', 'hop', 'charge', 'step'], nest: ['bait', 'dart', 'gale', 'gale', 'insight'], draws: ['soda', 'checkmate'], oppDraws: ['leap', 'charge'],
    need: [['Dazzle', o => o.card === 'dazzle' && o.zone === 'hand'], ['taking a card out of the Nest', (o, S, q) => /^Dazzle/.test(q.prompt) && !!o.card]] },
];
if (process.env.PZ) { const [k, o] = JSON.parse(process.env.PZ); Object.assign(PUZZLES[k - 1], o); if (process.env.ONLY) PUZZLES.splice(0, PUZZLES.length, PUZZLES[k - 1]); }
/* -t N: play puzzle N with you always taking the first choice that keeps it solvable (or the first choice), and print what happens. */
const tIdx = process.argv.indexOf('-t');
if (tIdx > 0) {
  const o = PUZZLES[+process.argv[tIdx + 1] - 1], z = {goal: o.goal, snap: build(o)}; z.turn = z.snap.turn + 1;
  const G = E.Game.resume(z.snap, [], []), memo = new Map(), force = (process.argv[tIdx + 2] || '').split(',').filter(Boolean);
  while (!G.over && E.puzzleTurnsLeft(z, G.S) > 0) {
    const q = G.req; let i;
    const banK = process.argv.indexOf('--ban'), ban = banK > 0 ? o.need[+process.argv[banK + 1]][1] : null;
    if (q.p === 0 && ban) { i = q.opts.findIndex((x, k) => !ban(x, G.S, q) && E.puzzleForced(G.snap, G.decs.concat(k), E.puzzleTurnsLeft(z, G.S), z, {n: 400000, memo: new Map(), ban})); if (i < 0) i = 0; }
    else if (q.p === 0) { const f = force.length ? q.opts.findIndex(x => new RegExp(force[0], 'i').test(x.label)) : -1; if (f >= 0) { i = f; force.shift(); } else { i = E.puzzleHint(G, z, memo); if (i < 0) { console.log('   (no winning choice at: ' + q.prompt + ' [' + q.opts.map(label).join(' | ') + '])'); i = 0; } } }
    else i = E.puzzleReply(G, z, memo);
    console.log(`${q.p ? '  OPP' : 'YOU'} ${q.prompt.slice(0, 50).padEnd(50)} → ${q.opts[i].label}`); G.answer(i);
  }
  console.log(G.S.log.map(e => e.m).join('\n')); console.log('result:', G.over ? `winner ${G.S.winner} (${G.S.reason})` : 'time up', '→', E.puzzleOk(z, G.S) ? 'SOLVED' : 'FAILED'); process.exit(0);
}
let ok = true; const out = [];
PUZZLES.forEach((o, i) => {
  const z = {id: i + 1, name: o.name, goal: o.goal, snap: build(o)}; z.turn = z.snap.turn + 1;
  const T = E.puzzleTurns(z), run = (ban, n = 6000000) => { const ctx = {n, memo: new Map(), ban}; const v = E.puzzleForced(z.snap, [], T, z, ctx); return {v, cut: !!ctx.cut, used: n - ctx.n}; };
  const base = run(null), msgs = [];
  if (!base.v || base.cut) { ok = false; msgs.push('NOT SOLVABLE' + (base.cut ? ' (search cut off)' : '')); }
  // The lesson is needed if, with its key move forbidden, you cannot succeed even against an opponent who just sits
  // still (cheap to check); if that opponent is too easy to beat, fall back to the full search.
  const passive = q => { const f = x => q.opts.findIndex(x); let i = q.kind === 'tile' ? f(x => x.label === 'Stay') : q.kind === 'gem' ? f(x => x.act === 'pass') : f(x => x.id === 'no'); return i < 0 ? 0 : i; };
  for (const [what, f] of o.need || []) {
    const c1 = {n: 3000000, memo: new Map(), ban: f, opp: passive}; let v = E.puzzleForced(z.snap, [], T, z, c1), cut = !!c1.cut;
    if (v || cut) { const r = run(f, 6000000); v = r.v; cut = r.cut; }
    if (v || cut) { ok = false; msgs.push(`solvable without ${what}` + (cut ? ' (cut off)' : '')); }
  }
  // how many first choices keep it solvable
  const fm = new Map(), G = E.Game.resume(z.snap, [], undefined), first = G.req.opts.map((op, k) => E.puzzleForced(z.snap, [k], T, z, {n: 3000000, memo: fm}) ? op.label : null).filter(Boolean);
  if (first.length === G.req.opts.length) { ok = false; msgs.push('every first choice works'); }
  console.error(`${String(i + 1).padStart(2)}. ${o.name.padEnd(18)} ${o.goal.type} ${o.goal.n}  ${base.used} nodes  first: ${first.length}/${G.req.opts.length}${verbose ? ' [' + first.join(' | ') + ']' : ''}  ${msgs.length ? '✗ ' + msgs.join('; ') : '✓'}`);
  out.push(z);
});
if (!ok) { console.error('Not written: fix the puzzles marked ✗.'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, '../puzzles.json'), JSON.stringify(out) + '\n'); console.error('wrote puzzles.json');
