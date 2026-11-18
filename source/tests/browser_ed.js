// The 2nd Edition setting in a real browser: on by default, switches card faces and text, and sets the match's rules.
const {chromium} = require('playwright'); const path = require('path');
const dir = process.argv[2], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1280, height: 800}}); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '../dist/dragonbridge.html')); await p.waitForTimeout(400);
  await p.click('#title [data-a="play"]'); await p.click('[data-a="setmode"][data-v="versus"]'); await p.click('[data-a="setwiz"][data-v="eve"]');
  ok(await p.isChecked('#opt-ed2'), '2nd Edition is on by default'); ok(/purple tile, you have \+2 Bump this turn/.test(await p.textContent('#setupbody')), '2E Eve text on setup');
  await p.uncheck('#opt-ed2'); ok(/Have exactly 1 Item/.test(await p.textContent('#setupbody')), '1E Eve text after unticking');
  await p.click('[data-a="launch"]'); await p.waitForTimeout(200); ok(await p.evaluate(() => M.G.S.ed === 1 && im('wz_eve') === IMG.wz_eve), '1E match uses 1E rules and faces');
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="play"]'); await p.check('#opt-ed2'); await p.click('[data-a="launch"]'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => M.G.S.ed === 2 && im('wz_eve') === IMG.wz_eve_2e && im('it_loom') === IMG.it_loom_2e), '2E match uses 2E rules and faces');
  await p.evaluate(() => toTitle()); await p.click('#title [data-a="library"]'); await p.click('[data-a="libtab"][data-v="wiz"]');
  ok(await p.locator('#sheet figure').count() === 15, '2E library has 15 Wizards (no May reverse)'); if (dir) await p.screenshot({path: path.join(dir, 'ed_lib2.png')});
  await p.click('[data-a="libed"][data-v="1"]'); ok(await p.locator('#sheet figure').count() === 16, '1E library shows May’s reverse side');
  await p.click('[data-a="libtab"][data-v="item"]'); await p.click('[data-a="libed"][data-v="2"]'); if (dir) await p.screenshot({path: path.join(dir, 'ed_items2.png')});
  console.log(`edition: ${fails.length} fails, ${errs.length} page errors`, fails, errs.slice(0, 3)); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
