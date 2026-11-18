// Mobile View and Undo in a real browser.
//   node tests/browser_view.js [screenshot-dir]
const {chromium} = require('playwright'); const path = require('path');
const dir = process.argv[2], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1366, height: 800}}); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (dir) await p.screenshot({path: path.join(dir, `view_${n}.png`)}); };
  await p.goto('file://' + path.resolve(__dirname, '../dist/dragonbridge.html')); await p.waitForTimeout(400);
  // ---- Mobile View
  const box = () => p.evaluate(() => { const r = document.querySelector('#app').getBoundingClientRect(); return {w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left)}; });
  let r = await box(); ok(r.w === 1366, 'normal view fills the window');
  await p.click('#title [data-a="options"]'); await p.check('#opt-mview'); r = await box();
  ok(Math.abs(r.w / r.h - 9 / 19.5) < 0.01 && r.h === 800 && r.x > 300, 'Mobile View is a centred phone-shaped column: ' + JSON.stringify(r));
  ok(await p.evaluate(() => { const o = document.querySelector('#ov').getBoundingClientRect(), a = document.querySelector('#app').getBoundingClientRect(); return Math.abs(o.width - a.width) < 2 && Math.abs(o.left - a.left) < 2; }), 'sheets stay inside the frame');
  await p.keyboard.press('Escape'); await shot('title');
  await p.evaluate(() => { P.opt.speed = 0; startMatch({mode: 'versus', wiz: ['derby', 'gelf'], level: 'easy', seed: 21, first: 0}); });
  const mine = () => p.waitForFunction(() => M.G.over || !M.busy && M.G.req && M.G.req.p === 0);
  await mine(); await shot('match');
  ok(!(await p.isVisible('#logpane')), 'no side log in Mobile View'); ok(await p.isVisible('#mebar [data-a="log"]'), 'Log button back in Mobile View');
  ok(await p.evaluate(() => { const a = document.querySelector('#app').getBoundingClientRect(); return [...document.querySelectorAll('#main > *')].filter(e => !e.hidden).every(e => { const q = e.getBoundingClientRect(); return q.left >= a.left - 1 && q.right <= a.right + 1; }); }), 'match layout fits the frame');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('#dragon')).flexDirection === 'row'), 'phone layout rules apply inside the frame');
  ok(await p.evaluate(() => JSON.parse(localStorage.getItem('db_profile')).opt.mview === true), 'Mobile View is remembered');
  // ---- Undo
  ok(await p.isDisabled('#undobtn'), 'Undo starts disabled');
  const state = () => p.evaluate(() => JSON.stringify([M.G.S.pos, M.G.S.hand, M.G.S.nest, M.G.S.ready, M.G.S.log.length, M.G.req.prompt, M.G.decs]));
  const s0 = await state();
  const moveIdx = await p.evaluate(() => M.G.req.opts.findIndex(o => o.card && ACTIONS[o.card].move));
  if (moveIdx >= 0) {
    await p.evaluate(i => answer(i), moveIdx); const s1 = await state(); ok(await p.evaluate(() => M.G.req.kind === 'tile'), 'move asks for a tile');
    ok(!(await p.isDisabled('#undobtn')), 'Undo available after playing a card');
    await p.evaluate(() => answer(M.G.req.opts.findIndex(o => o.label !== 'Stay'))); await mine();
    if (await p.evaluate(() => M.G.S.turn === 1 && M.G.S.cur === 0)) {
      await p.click('#undobtn'); ok(await state() === s1, 'first Undo returns to the tile choice'); await p.click('#undobtn'); ok(await state() === s0, 'second Undo returns to the start of the turn');
      ok(await p.isDisabled('#undobtn'), 'nothing left to undo');
    }
  }
  // a reveal blocks Undo: give yourself Insight and play it
  await p.evaluate(() => { const snap = clone(M.G.snap); const all = snap.deck.concat(snap.hand[0]); all.splice(all.indexOf('insight'), 1); snap.hand[0] = ['insight'].concat(all.splice(0, 3)); snap.deck = all; M.G = Game.resume(snap, [], []); M.hist = []; render(); });
  await p.evaluate(() => answer(M.G.req.opts.findIndex(o => o.card === 'insight'))); ok(await p.isDisabled('#undobtn'), 'no Undo after Insight shows a hand');
  await p.evaluate(() => answer(0)); await mine();
  if (await p.evaluate(() => M.G.S.cur === 0 && M.G.req.kind === 'gem')) { await p.click('#undobtn'); ok(await p.evaluate(() => /^Insight/.test(M.G.req.prompt)), 'Undo goes back to the Insight choice'); ok(await p.isDisabled('#undobtn'), 'but not back past the reveal'); }
  // a real phone
  await p.setViewportSize({width: 390, height: 780}); await p.waitForTimeout(100); r = await box(); ok(r.w === 390, 'on a phone-sized screen Mobile View just fills it: ' + JSON.stringify(r)); await shot('phone');
  console.log(`view+undo: ${fails.length} fails, ${errs.length} page errors`, fails, errs.slice(0, 4)); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
