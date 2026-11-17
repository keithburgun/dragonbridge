// Checks the table-side interactions in a real browser: drag a card up to play it, hover preview, the Buy / Hack
// sub-menus, clicking Market cards in the Gem Phase, the always-on log, and the skipped Gem Phase.
//   node tests/browser_ui.js [screenshot-dir]
const {chromium} = require('playwright'); const path = require('path');
const dir = process.argv[2], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1366, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (dir) await p.screenshot({path: path.join(dir, `ui_${n}.png`)}); };
  await p.goto('file://' + path.resolve(__dirname, '../dist/dragonbridge.html')); await p.waitForTimeout(400);
  await p.evaluate(() => { P.opt.speed = 0; startMatch({mode: 'versus', wiz: ['derby', 'eve'], level: 'easy', seed: 11, first: 0}); });
  const mine = () => p.waitForFunction(() => M.G.over || !M.busy && M.G.req && M.G.req.p === 0);
  await mine();
  ok(await p.isVisible('#logpane'), 'log pane visible on desktop'); ok(!(await p.isVisible('#mebar [data-a="log"]')), 'Log button hidden on desktop');
  // hover preview
  const card = p.locator('#hand .cardb.can').first(), box = await card.boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(80);
  ok(await p.isVisible('#peek'), 'hover preview shows'); await shot('hover');
  // drag up to play (no zoom step)
  const n0 = await p.evaluate(() => M.G.decs.length), hand0 = await p.evaluate(() => M.G.S.hand[0].length);
  await p.mouse.down(); await p.mouse.move(box.x + box.width / 2, box.y - 60, {steps: 6}); await shot('drag'); await p.mouse.move(box.x + box.width / 2, box.y - 220, {steps: 6}); await p.mouse.up(); await p.waitForTimeout(80);
  ok(await p.evaluate(n => M.G.decs.length > n || M.G.S.turn > 1, n0), 'dragging a card up plays it');
  ok(!(await p.evaluate(() => document.querySelector('#ov').classList.contains('show'))), 'no zoom after drag');
  // a short drag that stays in the hand does not play
  await mine();
  // get to a Gem Phase with 3 ready gems so Buy and Hack are on offer
  for (let i = 0; i < 40; i++) { await mine(); const k = await p.evaluate(() => M.G.req.kind); if (k === 'gem') break; await p.locator('#bridge .tile.can, #opts [data-a="ans"], #hand .cardb.can').first().click({force: true}); await p.evaluate(() => { if (document.querySelector('#ov').classList.contains('show')) { const f = zoomCb; closeOv(); f && f(); } }); }
  ok(await p.evaluate(() => M.G.req.kind === 'gem'), 'reached a Gem Phase');
  // rebuild the same position with 3 ready Gems and 7 White Gems
  await p.evaluate(() => { const snap = clone(M.G.snap), decs = M.G.decs.slice(); snap.ready[0] = 3; snap.white[0] = 7; snap.supply = 1; snap.white[1] = 0; const G = Game.resume(snap, decs, []); M.G = G; render(); });
  ok(await p.evaluate(() => M.G.req && M.G.req.kind === 'gem'), 'gem phase after rebuild');
  ok(await p.locator('#opts [data-a="sub"][data-v="buy"]').count() === 1 && await p.locator('#opts [data-a="sub"][data-v="hack"]').count() === 1, 'Buy and Hack group buttons'); await shot('gem');
  await p.click('#opts [data-a="sub"][data-v="buy"]'); ok(await p.locator('#opts .cardb[data-ci]').count() === 3, 'Buy sub-menu lists 3 Items'); await shot('buy');
  await p.click('#opts [data-a="sub"][data-v=""]'); await p.click('#opts [data-a="sub"][data-v="hack"]'); ok(await p.locator('#opts .cardb[data-ci]').count() >= 1, 'Hack sub-menu lists Hacks');
  await p.click('#opts [data-a="sub"][data-v=""]');
  await p.locator('#table .cardb[data-ci]').first().click(); ok(await p.locator('#sheet [data-a="zoomok"]').count() === 1, 'clicking a Market card in the Gem Phase offers to buy it');
  await p.click('#sheet [data-a="zoomok"]'); await p.waitForTimeout(80); ok(await p.evaluate(() => M.G.S.items[0].length === 1), 'Item bought from the table');
  // movement tiles are blue
  await p.evaluate(() => startMatch({mode: 'versus', wiz: ['derby', 'eve'], level: 'easy', seed: 11, first: 0})); await mine();
  await p.evaluate(() => { const i = M.G.req.opts.findIndex(o => o.card && ACTIONS[o.card].move); if (i >= 0) answer(i); });
  if (await p.evaluate(() => M.G.req && M.G.req.kind === 'tile')) { ok(await p.locator('#bridge .tile.can.mv').count() > 1, 'move tiles use the blue highlight'); await shot('move'); }
  // Gem Phase is skipped when nothing can be done
  const skipped = await p.evaluate(() => { const S = newState({wiz: ['derby', 'eve'], seed: 3, first: 0}); S.ready = [0, 0]; S.hand[0] = ['transfer', 'soda', 'bait', 'insight']; S.log = []; const G = new Game(S); G.answer(G.req.opts.findIndex(o => o.card === 'bait')); let sawGem = false; while (G.req && G.S.turn === 1) { if (G.req.kind === 'gem') sawGem = true; G.answer(0); } return !sawGem; });
  ok(skipped, 'Gem Phase skipped with no Gem Action available');
  // phone
  await p.setViewportSize({width: 390, height: 780}); await p.evaluate(() => render()); await p.waitForTimeout(100);
  ok(!(await p.isVisible('#logpane')), 'log pane hidden on phone'); ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), 'no sideways scroll on phone'); await shot('phone');
  console.log(`ui: ${fails.length} fails, ${errs.length} page errors`, fails, errs.slice(0, 4)); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
