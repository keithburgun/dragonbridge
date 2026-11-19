// Drives the built game in a real browser (Playwright): every mode, the sheets, saving and resuming.
//   node tests/browser_check.js [width height] [screenshot-dir]
const {chromium} = require('playwright');
const path = require('path');
const [w, h, dir] = [+process.argv[2] || 1280, +process.argv[3] || 800, process.argv[4]];
const fails = [], ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: w, height: h}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (dir) await p.screenshot({path: path.join(dir, `chk_${w}_${n}.png`)}); };
  await p.goto('file://' + path.resolve(__dirname, '../dist/dragonbridge.html')); await p.waitForTimeout(500);
  const fast = () => p.evaluate(() => { P.opt.speed = 0; window.TEST_FAST = true; P.opt.oneTap = true; });
  // plays the current match by clicking; pick(G) may return an option index to prefer
  async function playOut(pick, maxSteps = 900) {
    for (let s = 0; s < maxSteps; s++) {
      const st = await p.evaluate(() => ({over: !M || M.G.over || document.querySelector('#ov').classList.contains('show'), go: M && !M.busy && M.G.req && M.G.req.p === 0}));
      if (st.over) return true;
      if (!st.go) { await p.waitForTimeout(25); continue; }
      const want = pick ? await p.evaluate(pick) : null;
      const sel = '#bridge .tile.can, #hand [data-ci], #table [data-ci], #opts [data-a="ans"], #opts [data-ci]';
      const n = await p.locator(sel).count();
      if (!n) { fails.push('nothing to click for ' + await p.evaluate(() => M.G.req.kind + ': ' + M.G.req.prompt)); return false; }
      if (want != null) { const loc = p.locator(`[data-i="${want}"], [data-ci="${want}"]`).first(); if (await loc.count()) { await loc.click({force: true, timeout: 4000}).catch(e => fails.push('click failed on option ' + want)); continue; } fails.push('option ' + want + ' has no control'); return false; }
      await p.locator(sel).nth(Math.floor(Math.random() * n)).click({force: true, timeout: 4000}).catch(() => {});
    }
    fails.push('match did not finish'); return false;
  }
  const overflow = async n => ok(await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'sideways scroll: ' + n);
  // sheets
  for (const a of ['library', 'rulebook', 'stats', 'options']) { await p.click(`#title [data-a="${a}"]`); await p.waitForTimeout(150); ok(await p.evaluate(() => document.querySelector('#ov').classList.contains('show')), a + ' sheet'); if (a === 'library') await shot('library'); await overflow(a); await p.keyboard.press('Escape'); }
  // versus + save/resume
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="play"]'); await fast(); await overflow('setup');
  await p.click('[data-a="setmode"][data-v="versus"]'); await p.click('[data-a="launch"]'); await p.waitForTimeout(300); await shot('match'); await overflow('match');
  for (let i = 0; i < 6; i++) { const sel = '#bridge .tile.can, #hand [data-ci], #opts [data-a="ans"], #opts [data-ci], #table [data-ci]'; await p.waitForFunction(() => M && !M.busy && M.G.req && M.G.req.p === 0 || M.G.over); if (await p.evaluate(() => M.G.over)) break; await p.locator(sel).first().click({force: true}); }
  await p.waitForFunction(() => M.G.over || !M.busy && M.G.req && M.G.req.p === 0);
  const before = await p.evaluate(() => JSON.stringify([M.G.S.turn, M.G.S.pos, M.G.S.hand, M.G.S.nest]));
  if (!(await p.evaluate(() => M.G.over))) {
    await p.click('[data-a="menu"]'); await p.evaluate(() => toTitle());
    ok(await p.isVisible('#contbtn'), 'Continue button after quitting'); await p.click('#contbtn'); await p.waitForTimeout(200);
    ok(before === await p.evaluate(() => JSON.stringify([M.G.S.turn, M.G.S.pos, M.G.S.hand, M.G.S.nest])), 'resumed match differs from the saved one');
    await playOut(); await p.waitForTimeout(400); await shot('end');
    ok(await p.locator('#sheet h2').count() === 1, 'end-of-match sheet'); await p.evaluate(() => toTitle());
  }
  // no mirror matches: your Wizard is not offered as the opponent, and Random never picks it
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="play"]'); await p.click('[data-a="setmode"][data-v="versus"]'); await p.click('[data-a="setopp"][data-v="eve"]'); await p.click('[data-a="setwiz"][data-v="eve"]');
  ok(await p.evaluate(() => P.opt.opp === 'random') && await p.locator('[data-a="setopp"][data-v="eve"]').count() === 0, 'choosing the opponent\'s Wizard for yourself resets the opponent');
  ok(await p.evaluate(() => { for (let i = 0; i < 300; i++) if (randWiz('eve') === 'eve') return false; return true; }), 'Random never picks your own Wizard');
  ok(!(await p.evaluate(() => !!document.querySelector('#goal') && !document.querySelector('#goal').hidden)), 'no puzzle goal outside puzzles');
  // tournament: play until out or champion
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="play"]'); await p.click('[data-a="setmode"][data-v="tour"]'); await p.click('[data-a="setlevel"][data-v="easy"]'); await p.click('[data-a="launch"]');
  for (let r = 0; r < 3; r++) { await playOut(); await p.waitForTimeout(400); if (await p.locator('#sheet [data-a="tourgo"]').count()) await p.click('#sheet [data-a="tourgo"]'); else break; }
  await shot('tour'); await p.evaluate(() => toTitle());
  // ranked
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="play"]'); await p.click('[data-a="setmode"][data-v="ranked"]'); await p.click('[data-a="launch"]'); await playOut(); await p.waitForTimeout(400);
  ok(/Elo/.test(await p.textContent('#sheet')), 'ranked result shows Elo'); await p.evaluate(() => toTitle());
  // daily
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="play"]'); await p.click('[data-a="setmode"][data-v="daily"]'); await p.click('[data-a="launch"]'); await playOut(); await p.waitForTimeout(400);
  ok(/Today/.test(await p.textContent('#sheet')), 'daily result recorded'); await p.evaluate(() => toTitle());
  // puzzles: each opens with its name and a one-line goal, and its solution (found by search) solves it in the browser
  const np = await p.evaluate(() => PUZZLES.length); ok(np >= 8, 'puzzles present');
  const GOAL = /^(Escape this turn!|Escape in \d turns!|Defeat .+ in \d turns?!|Survive \d turns?!)/;
  for (let i = 1; i <= np; i++) {
    await p.evaluate(id => puzzleGo(id), i); await p.waitForTimeout(100); if (i === 1) await shot('puzzle');
    const intro = await p.evaluate(() => [...document.querySelectorAll('#sheet > *')].map(e => e.textContent.trim()));
    ok(intro.length === 4 && /^Puzzle \d+$/.test(intro[0]) && intro[1] === await p.evaluate(id => PUZZLES[id - 1].name, i) && GOAL.test(intro[2]) && intro[3] === 'Start', `puzzle ${i} opens with its name and a one-line goal: ` + intro.join(' / '));
    await p.click('#sheet [data-a="close"]'); ok(GOAL.test(await p.textContent('#goal')), 'goal stays on screen');
    ok(await p.evaluate(() => M.G.S.wiz[0] !== M.G.S.wiz[1]), 'puzzle is not a mirror match');
    await playOut(() => puzzleHint(M.G, M.cfg.puzzle, window.__memo = window.__memo && window.__mz === M.cfg.puzzle ? window.__memo : (window.__mz = M.cfg.puzzle, new Map())));
    await p.waitForTimeout(350); ok(/solved/i.test(await p.textContent('#sheet h2', {timeout: 3000}).catch(() => 'no result sheet')), `puzzle ${i} not solved by its winning line`);
  }
  await p.evaluate(() => { puzzleGo(1); closeOv(); }); await playOut(); await p.waitForTimeout(350); ok(await p.locator('#sheet h2').count() === 1, 'puzzle verdict after random play');
  await p.evaluate(() => { puzzleGo(4); closeOv(); }); await playOut(() => M.G.req.opts.length - 1); await p.waitForTimeout(350); ok(/Not this time/.test(await p.textContent('#sheet h2', {timeout: 3000}).catch(() => '')), 'a multi-turn puzzle played badly is failed when its turns run out');
  await p.evaluate(() => toTitle());
  // tutorial shows the coach
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="tutorial"]'); await p.waitForTimeout(300); ok(await p.isVisible('#coach') && /^Welcome to Dragon Bridge! This short tutorial will teach you the basics of how to play this wizard-bumping card game\.Got it$/.test((await p.textContent('#coach')).trim()), 'tutorial opens with the welcome: ' + await p.textContent('#coach')); await shot('tutorial');
  await p.click('[data-a="coachok"]'); ok(await p.isVisible('#coach') && /Action Phase/.test(await p.textContent('#coach')), 'then the first lesson');
  await p.click('#title [data-a="stats"]', {force: true}).catch(() => {});
  await p.evaluate(() => { toTitle(); statsSheet(); }); await shot('stats');
  console.log(`${w}x${h}: ${fails.length} fails, ${errs.length} page errors`, fails.slice(0, 8), errs.slice(0, 5));
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
