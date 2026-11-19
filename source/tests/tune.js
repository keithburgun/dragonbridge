// Hill-climbs the evaluation weights by self-play at one-ply (fast: ~2,000 games a minute on 2 cores).
//   node tests/tune.js [games per core=1500] [sweeps=2]
// Each step plays a changed weight set (level x, ai.js) against the best so far (level y, tests/ai_v2.js with those weights).
const {execSync} = require('child_process'), N = +process.argv[2] || 1500, SW = +process.argv[3] || 2;
const BASE = {base: 'normal', blunder: 0, noise: 0, own: 400};
let best = JSON.parse(process.env.W || '{}'), round = 0;
const W0 = {gem: 4, own: 1.5, item: 9, white: 1, card: 0.8, tile: 2.6, exit: 26, exitMove: 40, threat: 28, deep: 8, near: 3, flight: 1, move: 0, bumpc: 0};
const STEP0 = {move: 2, bumpc: 2};   // first step for weights that start at 0
const play = w => { const out = execSync(`./arena_par.sh x v2:y ${N} 2 ${round++ * 2 * N}`, {cwd: __dirname, env: Object.assign({}, process.env, {AIX: JSON.stringify(Object.assign({}, BASE, {w})), AIY: JSON.stringify(Object.assign({}, BASE, {w: best}))})}).toString(); return +/· ([\d.]+)%/.exec(out)[1]; };
const cur = k => best[k] != null ? best[k] : W0[k];
for (let s = 0; s < SW; s++) for (const k of (process.env.KEYS ? process.env.KEYS.split(',') : Object.keys(W0))) {
  const v = cur(k), tries = v === 0 ? [STEP0[k] || 1] : k === 'flight' ? [Math.min(1, v + 0.3), Math.max(0, v - 0.3)] : [v * 1.4, v / 1.4];
  for (const t of tries) {
    if (t === v) continue; const w = Object.assign({}, best, {[k]: +t.toFixed(2)}), p = play(w);
    console.log(`${k} ${v} → ${t.toFixed(2)}: ${p}%${p >= 52.2 ? '  KEEP' : ''}`);
    if (p >= 52.2) { best = w; console.log('best', JSON.stringify(best)); break; }
  }
}
console.log('FINAL', JSON.stringify(best));
