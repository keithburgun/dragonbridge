// Ranked ratings per Wizard (and Random), account sync against a local stand-in for Supabase, in-app update prompts,
// and the Dragon Power card staying put during a pounce. In a real browser.
//   node tests/browser_sync.js [screenshot-dir]
const {chromium} = require('playwright'); const path = require('path'), {spawn} = require('child_process'), http = require('http');
const dir = process.argv[2], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
const PORT = 9217, URLB = 'http://127.0.0.1:' + PORT, KEY = 'sb_publishable_test', PAGE = 'file://' + path.resolve(__dirname, '../dist/dragonbridge.html');
const get = p => new Promise((res, rej) => http.get(URLB + p, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(JSON.parse(s || 'null'))); }).on('error', rej));
(async () => {
  const mock = spawn(process.execPath, [path.join(__dirname, 'supa_mock.js')], {env: Object.assign({}, process.env, {PORT, KEY}), stdio: 'ignore'});
  for (let i = 0; i < 40; i++) { try { await get('/__calls'); break; } catch (e) { await new Promise(r => setTimeout(r, 100)); } }
  const b = await chromium.launch(), errs = [];
  const device = async (cfg = {url: URLB, key: KEY}, extra) => {
    const c = await b.newContext({viewport: {width: 1280, height: 800}}); await c.addInitScript(([cfg]) => { window.DB_SUPA_CFG = cfg; }, [cfg]); if (extra) await c.addInitScript(extra);
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(PAGE); await p.waitForTimeout(300);
    await p.evaluate(() => { P.opt.speed = 0; P.opt.sound = false; window.TEST_FAST = true; }); return p;
  };
  const shot = async (p, n) => { if (dir) await p.screenshot({path: path.join(dir, `sync_${n}.png`)}); };
  const idle = p => p.evaluate(() => SYNC.run());
  const signIn = async (p, em, pw, create) => { await p.evaluate(() => { toTitle(); optionsSheet(); }); await p.click('[data-a="acct"]'); await p.fill('#acem', em); await p.fill('#acpw', pw); await p.click(create ? '[data-a="acctnew"]' : '[data-a="acctgo"]'); };
  const win = (p, mode = 'versus') => p.evaluate(mode => { const k = mode + ':normal'; P.st[k] = P.st[k] || {w: 0, l: 0}; P.st[k].w++; saveProf(); }, mode);

  // ---- Ranked: every Wizard has a rating, and so does Random
  const A = await device();
  await A.click('#title [data-a="play"]'); await A.click('[data-a="setmode"][data-v="ranked"]');
  ok(await A.isVisible('[data-a="setrwiz"][data-v="random"]'), 'Ranked offers Random');
  await A.click('[data-a="setrwiz"][data-v="random"]'); ok(/^Random: Rank 3/.test(await A.textContent('#rkinfo')), 'Random starts at Elo 1000: ' + await A.textContent('#rkinfo')); await shot(A, 'ranked');
  await A.click('[data-a="launch"]');
  ok(await A.evaluate(() => M.cfg.rk === 'random' && WIZ_IDS.includes(M.cfg.wiz[0]) && M.cfg.wiz[0] !== M.cfg.wiz[1]), 'a Random Ranked match picks a Wizard for you');
  const end = async (p, w) => { await p.waitForFunction(() => M && !M.busy && M.G.req && M.G.req.p === 0); return p.evaluate(w => { M.G.S.winner = w; M.G.S.reason = 'resign'; M.G.req = null; closeOv(); render(); finish(); }, w); await p.waitForSelector('#ov.show'); };
  await end(A, 0); await A.waitForFunction(() => /Elo/.test(document.querySelector('#sheet').textContent)); ok(/Random: Elo \+\d+/.test(await A.textContent('#sheet')), 'result names the rating: ' + await A.textContent('#sheet'));
  ok(await A.evaluate(() => P.rk.random && P.rk.random.elo > 1000 && P.rk.random.g === 1 && Object.keys(P.rk).length === 1), 'only the Random rating moved');
  await A.evaluate(() => { toTitle(); P.opt.rwiz = 'eve'; rankGo(); }); ok(await A.evaluate(() => M.cfg.rk === 'eve' && M.cfg.wiz[0] === 'eve'), 'a chosen Wizard plays as itself'); await end(A, 1);
  ok(await A.evaluate(() => P.rk.eve.elo < 1000 && P.rk.random.elo > 1000), 'Eve has her own rating');
  await A.evaluate(() => { toTitle(); statsSheet(); }); ok(/Ranked as/.test(await A.textContent('#sheet')) && /Random/.test(await A.textContent('#sheet')), 'Stats lists the ratings'); await shot(A, 'stats');
  ok(await A.evaluate(() => { const q = normProf({opt: {wiz: 'gelf'}, elo: 1130, bestElo: 1180, rankGames: 9}); return q.rk.gelf.elo === 1130 && q.rk.gelf.best === 1180 && q.rk.gelf.g === 9 && q.elo === undefined; }), 'an older single rating moves to the selected Wizard');

  // ---- Pounce: the Dragon jumps, its Power card stays where it is
  await A.evaluate(() => {
    P.opt.speed = 0.5; P.opt.oneTap = true; window.TEST_FAST = false; startMatch({mode: 'versus', wiz: ['derby', 'gelf'], level: 'easy', seed: 4, first: 0});
    const snap = clone(M.G.snap), all = snap.deck.concat(snap.hand[0]), hand = ['soda', 'transfer', 'bait', 'insight']; for (const c of hand) all.splice(all.indexOf(c), 1);
    all.splice(all.indexOf('gale'), 1); snap.power = 'gale'; snap.hand[0] = hand; snap.deck = all; snap.pos = [1, 11]; snap.ready[0] = 0;
    M.G = Game.resume(snap, [], []); M.fresh = true; resetStage(); render();
  });
  const pw0 = await A.evaluate(() => { const r = document.querySelector('#dpower img').getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; });
  const pick = f => A.evaluate(f => answer(M.G.req.opts.findIndex(new Function('o', 'return ' + f))), f);
  await pick("o.card === 'bait'"); if (await A.evaluate(() => !M.G.over && M.G.req.kind === 'pick')) await pick("o.id === 'no'"); if (await A.evaluate(() => !M.G.over)) await pick("o.act === 'pass'");
  await A.waitForTimeout(700);
  const mid = await A.evaluate(() => { const r = document.querySelector('#dpower img').getBoundingClientRect(), f = document.querySelector('#dragon .dface').getBoundingClientRect(), d = document.querySelector('#dpower');
    return {pw: [Math.round(r.left), Math.round(r.top)], vis: getComputedStyle(d).visibility, face: Math.round(f.left), over: M.G.over && M.G.S.reason}; });
  ok(mid.over === 'pounce' && mid.vis === 'visible' && mid.pw[0] === pw0[0] && mid.pw[1] === pw0[1], 'the Dragon Power card stays during the pounce: ' + JSON.stringify([pw0, mid]));
  ok(mid.face > pw0[0] + 20, 'the Dragon itself has left its seat'); await shot(A, 'pounce');
  await A.waitForSelector('#ov.show', {timeout: 6000}); await A.evaluate(() => { P.opt.speed = 0; window.TEST_FAST = true; toTitle(); });

  // ---- Account: create on device A, pick it up on device B
  await A.evaluate(() => { toTitle(); optionsSheet(); }); ok(await A.isVisible('#acctbox [data-a="acct"]'), 'Options offers the account'); await shot(A, 'options');
  await A.click('[data-a="acct"]'); await A.click('[data-a="acctgo"]'); ok(/enter your email/i.test(await A.textContent('#sheet .acerr')), 'asks for an email'); await shot(A, 'signin');
  await signIn(A, 'wizard@example.com', 'hunter22', true); await A.waitForSelector('#acctbox [data-a="acctout"]');
  ok(/wizard@example\.com/.test(await A.textContent('#acctbox')), 'signed in'); await idle(A); await shot(A, 'signedin');
  let rows = await get('/__save'); ok(rows.length === 1 && rows[0].data.p.rk.random.g === 1 && rows[0].data.p.opt === undefined && rows[0].data.o.mview === undefined && rows[0].data.o.rwiz === 'eve', 'the profile and the shared options are in the account');
  const B = await device();
  await signIn(B, 'wizard@example.com', 'wrong-pass'); await B.waitForSelector('#sheet .acerr'); ok(/Wrong email or password/.test(await B.textContent('#sheet .acerr')), 'a wrong password is explained');
  await B.fill('#acpw', 'hunter22'); await B.click('[data-a="acctgo"]'); await B.waitForSelector('#acctbox [data-a="acctout"]'); await idle(B);
  ok(await B.evaluate(() => P.rk.random && P.rk.random.g === 1 && P.rk.eve.g === 1 && P.opt.rwiz === 'eve'), 'device B has the ratings and options');
  // ---- both devices play before either syncs: both results are kept
  await win(A); await win(B); await win(B, 'tour'); await A.evaluate(() => { P.rk.eve.elo = 1111; P.rk.eve.best = 1111; P.ach.first = '2026-11-01'; P.pz2[3] = 1; saveProf(); });
  await B.evaluate(() => { P.ach.first = '2026-11-05'; P.ach.quick = '2026-11-05'; P.trophies++; P.opt.mview = true; P.opt.level = 'hard'; saveProf(); applyView(); });
  await idle(B); await idle(A); await idle(B);
  const pa = await A.evaluate(() => JSON.stringify([P.st, P.rk, P.ach, P.pz2, P.trophies, P.opt.level])), pb = await B.evaluate(() => JSON.stringify([P.st, P.rk, P.ach, P.pz2, P.trophies, P.opt.level]));
  ok(pa === pb, 'both devices end up the same:\n' + pa + '\n' + pb);
  ok(await A.evaluate(() => P.st['versus:normal'].w === 2 && P.st['tour:normal'].w === 1 && P.rk.eve.elo === 1111 && P.ach.first === '2026-11-01' && P.ach.quick && P.pz2[3] === 1 && P.trophies === 1 && P.opt.level === 'hard'), 'wins add up, ratings and achievements are kept: ' + pa);
  ok(await A.evaluate(() => P.opt.mview === false) && await B.evaluate(() => P.opt.mview === true), 'Mobile View stays per device');
  // ---- the sign-in survives a reload and an expired token
  await get('/__expire'); await B.reload(); await B.waitForTimeout(1300); await win(B); await idle(B);
  ok(await B.evaluate(() => !!SYNC.S.ses && !SYNC.S.err), 'still signed in after a reload with an expired token: ' + await B.evaluate(() => SYNC.S.err)); await idle(A);
  ok(await A.evaluate(() => P.st['versus:normal'].w === 3), 'and its new win reaches device A');
  // ---- sign out: a fresh guest profile here, everything still in the account
  await A.evaluate(() => { toTitle(); optionsSheet(); }); await A.click('[data-a="acctout"]'); await A.click('[data-a="acctout2"]'); await A.waitForSelector('#acctbox [data-a="acct"]');
  ok(await A.evaluate(() => !SYNC.S.ses && !Object.keys(P.st).length && !Object.keys(P.rk).length && localStorage.getItem('db_auth') === null), 'signed out: guest profile');
  await signIn(A, 'wizard@example.com', 'hunter22'); await A.waitForSelector('#acctbox [data-a="acctout"]'); await idle(A); ok(await A.evaluate(() => P.st['versus:normal'].w === 3 && P.trophies === 1), 'signing in again brings it back');
  // ---- Erase all progress also empties the account's copy
  await A.evaluate(() => { toTitle(); optionsSheet(); }); await A.click('[data-a="wipe1"]'); ok(/in your account/.test(await A.textContent('#sheet')), 'the warning mentions the account'); await A.click('[data-a="wipe2"]'); await idle(A); await idle(A);
  rows = await get('/__save'); ok(!Object.keys(rows[0].data.p.st).length && await A.evaluate(() => !Object.keys(P.st).length), 'erased here and in the account'); await idle(B); ok(await B.evaluate(() => !Object.keys(P.st).length), 'and on the other device');
  // ---- a guest with progress signs in: it is combined with the account
  const C = await device(); await win(C); await win(C); await win(A); await idle(A);
  await signIn(C, 'wizard@example.com', 'hunter22'); await C.waitForSelector('#acctbox [data-a="acctout"]'); await idle(C);
  ok(await C.evaluate(() => P.st['versus:normal'].w === 3), 'guest progress is added to the account: ' + await C.evaluate(() => JSON.stringify(P.st)));
  // ---- the table isn't there yet: a clear message, nothing lost
  const D = await device({url: URLB, key: KEY, table: 'not_created_yet'}); await win(D); await signIn(D, 'wizard@example.com', 'hunter22'); await D.waitForSelector('#acctbox [data-a="acctout"]');
  ok(/isn’t switched on/.test(await D.textContent('#acctst')) && await D.evaluate(() => P.st['versus:normal'].w === 1), 'missing table: ' + await D.textContent('#acctst'));

  // ---- Updates: nothing in a browser; in the desktop app a newer release shows on the title screen
  ok(await A.evaluate(() => UPD.S.kind === null && document.querySelector('#updbtn').hidden), 'no update prompts in a browser');
  const fake = () => { window.__upd = []; window.DBDesk = {platform: 'win32', canUpdate: async () => ({kind: 'win', version: '1.0.3'}), update: async u => { window.__upd.push(u); return true; }, onProgress: cb => { window.__prog = cb; }}; };
  const rel = tag => ({tag_name: tag, assets: [{name: `DragonBridge-${tag.slice(1)}.apk`, browser_download_url: `https://github.com/keithburgun/dragonbridge/releases/download/${tag}/DragonBridge-${tag.slice(1)}.apk`}, {name: `DragonBridge-${tag.slice(1)}.exe`, browser_download_url: `https://github.com/keithburgun/dragonbridge/releases/download/${tag}/DragonBridge-${tag.slice(1)}.exe`}]});
  const cu = await b.newContext({viewport: {width: 1280, height: 800}}); await cu.addInitScript(fake); let tag = 'v1.0.3';
  await cu.route('https://api.github.com/**', r => r.fulfill({contentType: 'application/json', headers: {'Access-Control-Allow-Origin': '*'}, body: JSON.stringify(rel(tag))}));
  const U = await cu.newPage(); U.on('pageerror', e => errs.push(e.message)); await U.goto(PAGE); await U.waitForTimeout(1500);
  ok(await U.evaluate(() => UPD.S.kind === 'win' && UPD.S.state === 'current' && document.querySelector('#updbtn').hidden), 'same version: no prompt (' + await U.evaluate(() => UPD.S.state) + ')');
  ok(/1\.0\.3/.test(await U.textContent('#ver')), 'the title shows the app version');
  tag = 'v1.0.12'; await U.evaluate(() => optionsSheet()); await U.click('[data-a="updchk"]'); await U.waitForFunction(() => UPD.S.state === 'available');
  ok(/Version 1\.0\.12 is available/.test(await U.textContent('#updbox')), 'Options says a new version is available'); await shot(U, 'update_options');
  await U.evaluate(() => closeOv()); ok(await U.isVisible('#updbtn') && /Update Available!/.test(await U.textContent('#updbtn')), 'the title screen shows Update Available!'); await shot(U, 'update_title');
  await U.click('#updbtn'); await U.waitForFunction(() => UPD.S.state === 'restarting');
  ok(await U.evaluate(() => window.__upd.length === 1 && window.__upd[0] === 'https://github.com/keithburgun/dragonbridge/releases/download/v1.0.12/DragonBridge-1.0.12.exe'), 'Update now hands the .exe to the app');

  console.log(`sync+ranked+updates: ${fails.length} fails, ${errs.length} page errors`, fails, errs);
  await b.close(); mock.kill(); process.exit(fails.length || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
