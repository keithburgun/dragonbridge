// Controller and keyboard play, in a real browser: the highlight, playing whole turns with the buttons alone, menus,
// Undo, Look, tabs, the volume slider, the on-screen keyboard and the button prompts.
//   node tests/browser_pad.js [screenshot-dir]
const {chromium} = require('playwright'); const path = require('path');
const dir = process.argv[2], fails = [], errs = [], ok = (c, m) => { if (!c) fails.push(m); };
const PAGE = 'file://' + path.resolve(__dirname, '../dist/dragonbridge.html');
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({viewport: {width: 1280, height: 800}}); await ctx.addInitScript(() => { window.DB_ONL_LOCAL = true; });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(PAGE); await p.waitForTimeout(300);
  await p.evaluate(() => { P.opt.speed = 0; P.opt.sound = false; window.TEST_FAST = true; });
  const shot = async n => { if (dir) await p.screenshot({path: path.join(dir, `pad_${n}.png`)}); };
  const press = async (...ks) => { for (const k of ks) { await p.evaluate(k => DBPAD.press(k), k); await p.waitForTimeout(30); } };
  const st = () => p.evaluate(() => DBPAD.state()), hl = () => p.evaluate(() => { const e = document.querySelector('.padf'); return e ? {a: e.dataset.a || '', v: e.dataset.v || '', id: e.id, cls: e.className, text: (e.textContent || '').trim().slice(0, 30)} : null; });
  // ---- the keyboard: the first press only shows the highlight
  ok(await p.evaluate(() => !document.body.classList.contains('pad') && !document.querySelector('.padf')), 'no highlight until a key or button is used');
  await p.keyboard.press('ArrowDown'); let h = await hl(); ok(h && h.id === 'playbtn' && await p.evaluate(() => document.body.classList.contains('pad')), 'first key shows the highlight on Play: ' + JSON.stringify(h));
  ok(/Enter/.test((await st()).hint) && (await st()).glyph === 'kb', 'keyboard prompts are shown: ' + (await st()).hint); await shot('title');
  await p.keyboard.press('ArrowDown'); h = await hl(); ok(h.id === 'onlbtn', 'Down moves to Play Online: ' + JSON.stringify(h));
  await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowRight'); h = await hl(); ok(h.a === 'library', 'the two-column rows are reached left and right: ' + JSON.stringify(h));
  await p.mouse.move(300, 300); await p.mouse.move(340, 320); ok(await p.evaluate(() => !document.body.classList.contains('pad')), 'moving the mouse hides the highlight');
  // ---- Options with a controller: the volume slider
  await press('U'); await p.evaluate(() => optionsSheet()); await p.waitForTimeout(250); h = await hl(); ok(h && h.a === 'setspeed', 'Options starts at its first setting: ' + JSON.stringify(h));
  for (let i = 0; i < 12 && !(await p.evaluate(() => document.querySelector('.padf') && document.querySelector('.padf').id === 'opt-vol')); i++) await press('D');
  ok(await p.evaluate(() => document.querySelector('.padf') && document.querySelector('.padf').id === 'opt-vol'), 'the volume slider can be reached'); const v0 = await p.evaluate(() => P.opt.vol);
  await press('R', 'R'); ok(Math.abs(await p.evaluate(() => P.opt.vol) - (v0 + 0.1)) < 1e-6 && /Adjust/.test((await st()).hint), 'Right turns the volume up: ' + await p.evaluate(() => P.opt.vol)); await press('L', 'L'); await shot('options');
  await press('B'); ok(!(await p.isVisible('#ov.show')), 'B closes the sheet');
  // ---- title -> setup -> match, by controller
  await p.evaluate(() => { P.opt.mode = 'versus'; P.opt.wiz = 'derby'; P.opt.opp = 'eve'; P.opt.level = 'easy'; toTitle(); }); for (let i = 0; i < 8; i++) { h = await hl(); if (h && h.id === 'playbtn') break; await press(h && h.id === 'tmute' ? 'D' : 'U'); } h = await hl(); ok(h && h.id === 'playbtn', 'Up returns to Play: ' + JSON.stringify(h)); await press('A');
  ok(!(await p.evaluate(() => document.querySelector('#setup').hidden)), 'A on Play opens the setup screen'); h = await hl(); ok(h && h.a === 'launch', 'the highlight starts on Start match: ' + JSON.stringify(h)); await shot('setup');
  await press('RB'); ok(await p.evaluate(() => P.opt.mode === 'tour'), 'RB moves to the next mode tab'); await press('LB'); ok(await p.evaluate(() => P.opt.mode === 'versus'), 'LB moves back');
  await press('B'); ok(!(await p.evaluate(() => document.querySelector('#title').hidden)), 'B goes back to the title'); h = await hl(); ok(h && h.id === 'playbtn', 'with the highlight where it was: ' + JSON.stringify(h)); await press('A'); await press('START');
  await p.waitForFunction(() => M && !M.busy && M.G.req && M.G.req.p === 0); ok(await p.evaluate(() => M.cfg.mode === 'versus' && M.cfg.wiz[0] === 'derby'), 'Start launches the match');
  // ---- play with the buttons only
  const mine = () => p.waitForFunction(() => M && !M.busy && (M.G.over || M.G.req && M.G.req.p === 0), null, {timeout: 20000});
  await mine(); await p.waitForTimeout(250); h = await hl(); ok(h && /cardb/.test(h.cls) && /can/.test(h.cls), 'on your turn the highlight is on a playable card: ' + JSON.stringify(h)); ok(/Play/.test((await st()).hint) && /Menu/.test((await st()).hint), 'the prompts say Play and Menu: ' + (await st()).hint); await shot('hand');
  await press('Y'); ok(await p.isVisible('#sheet.zoom') && !(await p.isVisible('#sheet [data-a="zoomok"]')), 'Y looks at the card'); await press('B');
  await press('A'); ok(await p.isVisible('#sheet [data-a="zoomok"]'), 'A opens the card with its Play button'); h = await hl(); ok(h && h.a === 'zoomok', 'the highlight is on Play: ' + JSON.stringify(h));
  let turns = 0, stuck = 0, sawTile = false, sawTile2 = false, sawGem = false, undone = false;
  for (let i = 0; i < 700 && turns < 6; i++) {
    await mine(); if (await p.evaluate(() => M.G.over)) break;
    const before = await p.evaluate(() => M.G.decs.length + ':' + M.G.S.turn + ':' + document.querySelector('#ov').classList.contains('show') + ':' + (M.sub || ''));
    const q = await p.evaluate(() => ({kind: M.G.req.kind, verb: M.G.req.verb, turn: M.G.S.turn}));
    h = await hl();
    if (q.kind === 'tile' && !(await p.isVisible('#ov.show'))) { sawTile = true; ok(h && /tile/.test(h.cls) && /can/.test(h.cls), 'a tile choice puts the highlight on a tile: ' + JSON.stringify(h)); ok(new RegExp(q.verb === 'bump' ? 'Bump here' : 'Go here').test((await st()).hint), 'and the prompt names it: ' + (await st()).hint); if (!sawTile2) { sawTile2 = true; await shot('tile'); } }
    if (q.kind === 'gem' && !(await p.isVisible('#ov.show'))) { sawGem = true; ok(h && h.cls && /btn|cardb/.test(h.cls), 'the Gem Phase puts the highlight on a choice: ' + JSON.stringify(h)); }
    if (!undone && !(await p.isVisible('#ov.show')) && await p.evaluate(() => { const u = document.querySelector('#undobtn'); return u && !u.disabled; })) { const n = await p.evaluate(() => M.G.decs.length); ok(/Undo/.test((await st()).hint), 'X is offered as Undo'); await press('X'); ok(await p.evaluate(n => M.G.decs.length < n, n), 'X takes back the last choice'); undone = true; continue; }
    await press('A'); await p.waitForTimeout(40);
    const after = await p.evaluate(() => !M ? 'x' : M.G.decs.length + ':' + M.G.S.turn + ':' + document.querySelector('#ov').classList.contains('show') + ':' + (M.sub || ''));
    if (after === before) { stuck++; if (stuck > 6) { ok(false, 'A did nothing at: ' + JSON.stringify([q, h, before])); break; } await press('D'); } else stuck = 0;
    turns = await p.evaluate(() => M ? Math.floor(M.G.S.turn / 2) : 9);
  }
  ok(turns >= 3 || await p.evaluate(() => M && M.G.over), 'several turns were played with the controller alone: ' + turns); ok(sawTile && undone, 'tile choices and an Undo came up (and a Gem Phase, if there was one): ' + [sawTile, sawGem, undone]);
  // ---- the menu, the log
  if (!(await p.evaluate(() => M.G.over))) {
    await p.evaluate(() => closeOv()); await mine(); await press('B'); ok(/Menu/.test(await p.textContent('#sheet h2')), 'B opens the menu'); h = await hl(); ok(h && h.a === 'close', 'on Back to the match: ' + JSON.stringify(h)); await shot('menu'); await press('B'); ok(!(await p.isVisible('#ov.show')), 'B closes it');
    await press('SEL'); ok(/Match log/.test(await p.textContent('#sheet h2')), 'View opens the match log'); await press('B');
    await p.keyboard.press('Escape'); ok(/Menu/.test(await p.textContent('#sheet h2')), 'Esc opens the menu'); await p.keyboard.press('Escape'); ok(!(await p.isVisible('#ov.show')), 'Esc closes it');
  }
  // ---- PlayStation glyphs follow the controller in use
  await p.evaluate(() => { DBPAD.natName('DualSense Wireless Controller'); DBPAD.nat('A', 0); }); await press('Y'); await p.evaluate(() => closeOv()); await p.waitForTimeout(100); ok((await st()).glyph === 'ps' && /✕/.test((await st()).hint), 'a PlayStation controller gets PlayStation prompts: ' + (await st()).hint);
  // ---- the on-screen keyboard: join a game by code without a keyboard
  await p.evaluate(() => { toTitle(); onlMenu(); }); await p.waitForTimeout(250);
  for (let i = 0; i < 8 && !(await p.evaluate(() => document.querySelector('.padf') && document.querySelector('.padf').id === 'olcode')); i++) await press(i % 2 ? 'R' : 'D');
  ok(await p.evaluate(() => document.querySelector('.padf') && document.querySelector('.padf').id === 'olcode'), 'the code box can be reached: ' + JSON.stringify(await hl())); ok(/Type/.test((await st()).hint), 'A is Type');
  await press('A'); ok(await p.isVisible('#osk .oskbox'), 'A opens the on-screen keyboard'); await shot('osk');
  const type = async s => { for (const ch of s) { for (let i = 0; i < 40 && (await p.evaluate(() => document.querySelector('.padf') && document.querySelector('.padf').dataset.k)) !== ch; i++) { const pos = await p.evaluate(ch => { const c = document.querySelector('.padf').getBoundingClientRect(), t = [...document.querySelectorAll('#osk [data-k]')].find(e => e.dataset.k === ch).getBoundingClientRect(); return [t.left + t.width / 2 - c.left - c.width / 2, t.top + t.height / 2 - c.top - c.height / 2]; }, ch); await press(Math.abs(pos[1]) > 12 ? (pos[1] > 0 ? 'D' : 'U') : (pos[0] > 0 ? 'R' : 'L')); } await press('A'); } };
  await type('k7mq'); ok(await p.inputValue('#olcode') === 'k7mq', 'keys type into the box: ' + await p.inputValue('#olcode')); await press('X'); ok(await p.inputValue('#olcode') === 'k7m', 'X deletes');
  await type('p2x'); ok(await p.inputValue('#olcode') === 'k7mp2x', 'the box takes its 6 characters'); await type('z'); ok(await p.inputValue('#olcode') === 'k7mp2x', 'and no more');
  await press('B'); ok(!(await p.isVisible('#osk .oskbox')) && await p.isVisible('#olcode'), 'B puts the keyboard away'); h = await hl(); ok(h && h.id === 'olcode', 'and the highlight returns to the box');
  await p.evaluate(() => { DBPAD.press('U', 'kb'); }); await p.evaluate(() => { const e = document.querySelector('#olcode'); DBPAD.press('D', 'kb'); }); ok((await st()).glyph === 'kb', 'the keyboard takes over the prompts again');
  // ---- a replay: LB / RB step through it
  await p.evaluate(() => { closeOv(); startMatch({mode: 'versus', wiz: ['derby', 'eve'], level: 'easy', seed: 3, first: 0, fast: true}); });
  for (let i = 0; i < 900; i++) { const s = await p.evaluate(() => !M || M.G.over ? 'over' : M.busy || !M.G.req || M.G.req.p !== 0 ? 'wait' : (answer(Math.floor(Math.random() * M.G.req.opts.length)), 'go')); if (s === 'over') break; if (s === 'wait') await p.waitForTimeout(15); }
  await p.waitForSelector('#sheet [data-a="rpwatch"]'); await p.evaluate(() => rpOpen(rpList()[0].id)); await p.waitForTimeout(250); h = await hl(); ok(h && h.a === 'rpgo' && h.v === 'play', 'in a replay the highlight starts on Play: ' + JSON.stringify(h));
  await press('RB', 'RB', 'RB'); ok(await p.evaluate(() => M.rp.i === 3), 'RB steps forward'); await press('LB'); ok(await p.evaluate(() => M.rp.i === 2), 'LB steps back'); ok(/Step/.test((await st()).hint), 'the prompts say so: ' + (await st()).hint); await shot('replay');
  await press('B'); ok(/Exit replay/.test(await p.textContent('#sheet')), 'B opens the replay menu');
  // ---- the desktop app on a Steam Deck: Exit, the on-screen keyboard for a tap, and updates from the Linux AppImage
  const dctx = await b.newContext({viewport: {width: 1280, height: 800}});
  await dctx.addInitScript(() => { window.DB_ONL_LOCAL = true; window.__quit = 0; window.__upd = []; window.DBDesk = {platform: 'linux', info: async () => ({deck: true, fullscreen: true, platform: 'linux', version: '1.0.3'}), quit: async () => { window.__quit++; }, canUpdate: async () => ({kind: 'linux', version: '1.0.3'}), update: async u => { window.__upd.push(u); return true; }, onProgress: () => {}}; });
  const rel = {tag_name: 'v1.0.9', assets: ['apk', 'exe', 'AppImage'].map(x => ({name: `DragonBridge-1.0.9.${x}`, browser_download_url: `https://github.com/keithburgun/dragonbridge/releases/download/v1.0.9/DragonBridge-1.0.9.${x}`}))};
  await dctx.route('https://api.github.com/**', r => r.fulfill({contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify(rel)}));
  const d = await dctx.newPage(); d.on('pageerror', e => errs.push('deck: ' + e.message)); await d.goto(PAGE); await d.waitForFunction(() => UPD.S.state === 'available', null, {timeout: 8000});
  ok(await d.isVisible('#exitbtn') && await d.evaluate(() => document.body.classList.contains('deck')), 'the desktop app shows Exit'); if (dir) await d.screenshot({path: path.join(dir, 'pad_deck_title.png')});
  ok(await d.evaluate(() => { const t = document.querySelector('#title'); return t.scrollHeight <= t.clientHeight + 1; }), 'the full title menu (Update, Play, Online, Exit) fits a Steam Deck screen');
  await d.click('#updbtn'); await d.waitForFunction(() => window.__upd.length === 1); ok(await d.evaluate(() => /DragonBridge-1\.0\.9\.AppImage$/.test(window.__upd[0])), 'on Linux the update is the AppImage: ' + await d.evaluate(() => window.__upd[0]));
  await d.evaluate(() => { closeOv(); onlMenu(); }); await d.click('#olcode'); ok(await d.isVisible('#osk .oskbox'), 'on a Steam Deck a tap on a text box opens the on-screen keyboard');
  await d.click('#osk [data-k="a"]'); await d.click('#osk [data-k="7"]'); ok(await d.inputValue('#olcode') === 'a7', 'and its keys can be tapped'); await d.click('#osk [data-k="⏎"]'); ok(!(await d.isVisible('#osk .oskbox')), 'Done puts it away');
  await d.evaluate(() => closeOv()); await d.click('#exitbtn'); ok(await d.evaluate(() => window.__quit === 1), 'Exit asks the app to quit');
  console.log(`controller: ${fails.length} fails, ${errs.length} page errors`, fails, errs);
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
