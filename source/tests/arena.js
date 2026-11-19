// CPU vs CPU, optionally with a different CPU file on one side:
//   node tests/arena.js expert hard 40            current ai.js on both sides
//   node tests/arena.js expert v2:expert 40       current ai.js vs tests/ai_v2.js (the CPU of v1.0.10; ai_v1.js is the first release)
//   AIX='{"base":"hard","dets":4}' node tests/arena.js x v2:hard 40    an experimental level "x" (see ai.js)
// Seats and who moves first swap every game; both editions' Wizards rotate. Prints wins and time per decision.
const fs = require('fs'), path = require('path'), Module = require('module');
function load(aiFile) {
  const src = fs.readFileSync(path.join(__dirname, '../engine.js'), 'utf8') + '\n' + fs.readFileSync(aiFile, 'utf8') + '\nmodule.exports={WIZ_IDS,newState,Game,aiChoose};';
  const m = new Module(aiFile); m._compile(src, aiFile + '.arena.js'); return m.exports;
}
const cur = load(path.join(__dirname, '../ai.js')), old = {};
const side = s => { const [a, b] = s.includes(':') ? s.split(':') : ['cur', s]; if (a === 'cur') return {E: cur, lv: b, name: b}; old[a] = old[a] || load(path.join(__dirname, 'ai_' + a + '.js')); return {E: old[a], lv: b, name: s}; };
const A = side(process.argv[2] || 'expert'), B = side(process.argv[3] || 'hard'), N = +process.argv[4] || 20, ed = +process.argv[5] || 2, off = +process.argv[6] || 0;   // off: skip ahead to other pairings and shuffles
let slow = [0, 0], w = [0, 0], draws = 0, turns = 0, time = [0, 0], decs = [0, 0], why = {};
for (let g = 0; g < N; g++) {
  const h = (g >> 1) + off, ws = cur.WIZ_IDS, a = ws[h % ws.length], b = ws[(h * 7 + 3 + Math.floor(h / 15)) % ws.length];
  const S = cur.newState({wiz: [a, b], seed: h * 31 + 5, ed}); S.log = undefined; S.maxTurns = 120;
  const seat = g % 2 ? [A, B] : [B, A], G = new cur.Game(S);   // each pairing is played twice, sides swapped
  while (!G.over) { const p = G.req.p, k = seat[p] === A ? 0 : 1, t = Date.now(); const i = seat[p].E.aiChoose(G, seat[p].lv); const dt = Date.now() - t; time[k] += dt; if (dt > slow[k]) slow[k] = dt; decs[k]++; G.answer(i); }
  if (S.winner >= 0) { w[seat[S.winner] === A ? 0 : 1]++; why[S.reason] = (why[S.reason] || 0) + 1; } else draws++;
  turns += S.turn;
}
const n = w[0] + w[1], p = w[0] / Math.max(1, n), se = Math.sqrt(p * (1 - p) / Math.max(1, n));
if (process.env.RAW) console.log(JSON.stringify({w, draws})); else console.log(`${A.name} ${w[0]} – ${w[1]} ${B.name}${draws ? ' (' + draws + ' drawn)' : ''} · ${(100 * p).toFixed(0)}% ± ${(196 * se).toFixed(0)} · avg ${(turns / N).toFixed(1)} turns · ms/decision ${(time[0] / decs[0]).toFixed(0)} vs ${(time[1] / decs[1]).toFixed(0)} · slowest ${slow[0]} vs ${slow[1]}`, why);
