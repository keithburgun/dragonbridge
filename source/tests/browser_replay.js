// Replays, the volume slider and the title menu, in a real browser.
//   node tests/browser_replay.js [screenshot-dir]
const {chromium} = require('playwright'); const path = require('path');
const dir = process.argv[2], fails = [], errs = [], ok = (c, m) => { if (!c) fails.push(m); };
const PAGE = 'file://' + path.resolve(__dirname, '../dist/dragonbridge.html');
(async () => {
  const b = await chromium.launch();
  const open = async (w, h) => { const p = await b.newPage({viewport: {width: w, height: h}}); p.on('pageerror', e => errs.push(e.message)); await p.goto(PAGE); await p.waitForTimeout(300); await p.evaluate(() => { P.opt.speed = 0; P.opt.sound = false; P.opt.oneTap = true; window.TEST_FAST = true; }); return p; };
  const shot = async (p, n) => { if (dir) await p.screenshot({path: path.join(dir, `rp_${n}.png`)}); };
  const p = await open(1280, 800);
  // ---- title: the menu fits, Exit and Play Online only where they work
  ok(await p.evaluate(() => { const t = document.querySelector('#title'); return t.scrollHeight <= t.clientHeight + 1; }), 'the title menu fits at 1280x800');
  ok(await p.evaluate(() => document.querySelector('#exitbtn').hidden && !document.querySelector('#onlbtn').hidden), 'no Exit in a browser; Play Online is offered'); await shot(p, 'title');
  // ---- volume
  await p.click('#title [data-a="options"]'); ok(await p.isVisible('#opt-vol') && await p.evaluate(() => document.querySelector('#opt-vol').value === '70'), 'Options has the volume slider at 70%'); await shot(p, 'options');
  await p.evaluate(() => { const s = document.querySelector('#opt-vol'); s.value = 35; s.dispatchEvent(new Event('input', {bubbles: true})); });
  ok(await p.evaluate(() => P.opt.vol === 0.35 && document.querySelector('#volpct').textContent === '35%' && JSON.parse(localStorage.getItem('db_profile')).opt.vol === 0.35), 'the slider sets and saves the volume');
  await p.evaluate(() => { P.opt.sound = true; saveProf(); beep(440); }); ok(await p.evaluate(() => MG && Math.abs(MG.gain.value - 0.5) < 1e-6), 'the master gain follows it: ' + await p.evaluate(() => MG && MG.gain.value));
  await p.click('#mutebtn'); ok(await p.evaluate(() => P.opt.sound === false && /Muted/.test(document.querySelector('#mutebtn').textContent) && document.querySelector('.volrow').classList.contains('off')), 'Mute silences it');
  await p.evaluate(() => closeOv()); ok(await p.evaluate(() => document.querySelector('#tmute').getAttribute('aria-pressed') === 'true'), 'the title mute button shows it'); await p.click('#tmute'); ok(await p.evaluate(() => P.opt.sound === true), 'and turns sound back on');
  await p.evaluate(() => { P.opt.sound = false; });
  // ---- a match is recorded
  const play = async (seed, undoOnce) => {
    await p.evaluate(seed => startMatch({mode: 'versus', wiz: ['derby', 'eve'], level: 'easy', seed, first: 0}), seed);
    let undone = !undoOnce;
    for (let i = 0; i < 900; i++) {
      const st = await p.evaluate(() => !M || M.G.over ? 'over' : M.busy || !M.G.req || M.G.req.p !== 0 ? 'wait' : 'go'); if (st === 'over') break; if (st === 'wait') { await p.waitForTimeout(20); continue; }
      if (!undone && await p.evaluate(() => M.hist && M.hist.length > 0)) { await p.evaluate(() => undo()); undone = true; continue; }
      await p.evaluate(() => answer(Math.floor(Math.random() * M.G.req.opts.length)));
    }
    await p.waitForSelector('#ov.show');
    return p.evaluate(() => ({winner: M.G.S.winner, reason: M.G.S.reason, turn: M.G.S.turn, pos: M.G.S.pos.join(), log: M.G.S.log.length}));
  };
  const end = await play(11, true);
  ok(await p.isVisible('#sheet [data-a="rpwatch"]'), 'the result offers Watch replay');
  const L = await p.evaluate(() => rpList().map(r => ({id: r.id, n: r.decs.length, w: r.winner, why: r.reason, t: r.turns, mode: r.mode})));
  ok(L.length === 1 && L[0].w === end.winner && L[0].why === end.reason && L[0].t === end.turn && L[0].n > 5, 'the match is in the replay list: ' + JSON.stringify(L));
  // ---- watch it: it plays back to the very same ending
  await p.click('#sheet [data-a="rpwatch"]'); await p.waitForSelector('.rpbar');
  ok(await p.evaluate(() => M.rp && M.rp.i === 0 && M.rp.exact && M.G.S.turn === 1 && !document.querySelector('#undobtn').offsetParent), 'the replay opens at the start (no Undo)'); await shot(p, 'start');
  ok(await p.evaluate(() => document.querySelector('[data-a="rpgo"][data-v="prev"]').disabled && !document.querySelector('[data-a="rpgo"][data-v="next"]').disabled), 'step-back is off at the start');
  await p.click('[data-a="rpgo"][data-v="next"]'); await p.click('[data-a="rpgo"][data-v="next"]'); ok(await p.evaluate(() => M.rp.i === 2), 'Step forward'); 
  await p.click('[data-a="rpgo"][data-v="prev"]'); ok(await p.evaluate(() => M.rp.i === 1), 'Step back');
  await p.click('[data-a="rpgo"][data-v="tnext"]'); const t2 = await p.evaluate(() => [M.G.S.turn, M.rp.i, M.rp.marks[M.rp.i], M.rp.marks[M.rp.i - 1]]); ok(t2[2] === t2[3] + 1, 'Turn ▶ lands on the first choice of the next turn: ' + t2);
  await p.click('[data-a="rpgo"][data-v="tnext"]'); await p.click('[data-a="rpgo"][data-v="tprev"]'); ok(await p.evaluate(t => M.rp.i === t, t2[1]), '◀ Turn goes back to the start of that turn');
  await p.evaluate(() => { const s = document.querySelector('#rpseek'); s.value = Math.floor(M.rp.n / 2); s.dispatchEvent(new Event('input', {bubbles: true})); });
  ok(await p.evaluate(() => M.rp.i === Math.floor(M.rp.n / 2)), 'the slider jumps to any point'); await shot(p, 'mid');
  ok(await p.evaluate(() => document.querySelectorAll('#oppbar .backs img').length > 0), 'their hand is hidden, as it was');
  await p.click('[data-a="rpgo"][data-v="hands"]'); ok(await p.evaluate(() => document.querySelectorAll('#oppbar .backs img').length === 0 && document.querySelectorAll('#oppbar .oppinfo .cardb').length === M.G.S.hand[1].length), 'Show their hand reveals it');
  await p.click('[data-a="rpgo"][data-v="play"]'); await p.waitForFunction(() => M.rp.done, null, {timeout: 60000});
  const fin = await p.evaluate(() => ({winner: M.G.S.winner, reason: M.G.S.reason, turn: M.G.S.turn, pos: M.G.S.pos.join(), log: M.G.S.log.length, i: M.rp.i, n: M.rp.n}));
  ok(fin.winner === end.winner && fin.reason === end.reason && fin.turn === end.turn && fin.pos === end.pos && fin.log === end.log && fin.i === fin.n, 'Play runs it to the same ending: ' + JSON.stringify([end, fin]));
  ok(/finished/.test(await p.textContent('#q')) && /Watch again/.test(await p.textContent('.rpbar')), 'and says it is finished'); await shot(p, 'end');
  ok(await p.evaluate(() => rpList().length === 1 && !localStorage.getItem('db_save')), 'watching a replay records nothing and saves no match');
  // ---- share: code out, code in
  await p.click('[data-a="rpgo"][data-v="exit"]'); await p.waitForSelector('#sheet .rprow'); ok(await p.evaluate(() => document.querySelector('#title').hidden === false), 'Exit returns to the title, with the list open'); await shot(p, 'list');
  await p.click('#sheet [data-a="rpshare"]'); const code = await p.inputValue('#rpcode'); ok(/^DBR1\./.test(code) && code.length > 500, 'Share shows a replay code'); await shot(p, 'share');
  await p.evaluate(() => { localStorage.removeItem('db_replays'); replaysSheet(); }); ok(/No matches recorded/.test(await p.textContent('#sheet')), 'an empty list says so');
  await p.click('#sheet [data-a="rpimport"]'); await p.fill('#rpcode', 'not a replay'); await p.click('#sheet [data-a="rpimportgo"]'); ok(/isn’t a Dragon Bridge replay/.test(await p.textContent('#sheet')), 'rubbish is refused');
  await p.fill('#rpcode', code.slice(0, 40) + 'AAAA' + code.slice(44)); await p.click('#sheet [data-a="rpimportgo"]'); ok(/isn’t a Dragon Bridge replay/.test(await p.textContent('#sheet')), 'a damaged code is refused');
  ok(await p.evaluate(() => !rpUnpack(JSON.stringify({dragonBridgeReplay: 1, snap: {wiz: ['derby', 'eve'], hand: [[], []], deck: []}, decs: [0]})) && !rpUnpack('{"snap":{"wiz":["<img src=x onerror=alert(1)>","eve"]},"decs":[]}')), 'a made-up replay is refused');
  await p.fill('#rpcode', code); await p.click('#sheet [data-a="rpimportgo"]'); await p.waitForSelector('.rpbar');
  ok(await p.evaluate(() => M.rp && M.rp.exact && rpList().length === 1 && rpList()[0].imported === 1), 'the real code imports and opens');
  await p.evaluate(() => rpSeek(M.rp.n)); ok(await p.evaluate(e => M.G.S.winner === e.winner && M.G.S.pos.join() === e.pos, end), 'and plays to the same ending');
  // ---- a guest's replay is shown from the other seat
  await p.evaluate(() => { const r = rpList()[0]; r.id = 'pov1'; r.pov = 1; r.mode = 'online'; rpStore([r]); rpOpen('pov1'); });
  ok(await p.evaluate(() => M.cfg.wiz.join() === 'eve,derby' && M.G.S.wiz[0] === 'eve' && /Online opponent/.test(document.querySelector('#oppbar').textContent) && document.querySelector('#bridge .tok.opp .you').textContent === 'OPP'), 'seats are swapped for the guest');
  await p.evaluate(() => rpSeek(M.rp.n)); ok(await p.evaluate(e => M.G.S.winner === 1 - e.winner, end), 'and so is the winner');
  // ---- a resigned match, and a match resumed from a save, keep their replays
  await p.evaluate(() => { toTitle(); localStorage.removeItem('db_replays'); startMatch({mode: 'versus', wiz: ['gelf', 'bill'], level: 'easy', seed: 5, first: 0}); });
  const mine = () => p.waitForFunction(() => M && !M.busy && (M.G.over || M.G.req && M.G.req.p === 0));
  for (let i = 0; i < 4; i++) { await mine(); await p.evaluate(() => { const q = M.G.req, k = q.opts.findIndex(o => o.act === 'pass' || o.label === 'Stay' || o.id === 'no'); answer(k >= 0 ? k : 0); }); }
  await mine(); ok(await p.evaluate(() => !M.G.over), 'still playing'); const before = await p.evaluate(() => M.rec.decs.length);
  await p.evaluate(() => { toTitle(); resumeMatch(); }); ok(await p.evaluate(n => M.rec && M.rec.decs.length === n, before), 'a resumed match keeps recording from where it was');
  await mine(); await p.evaluate(() => menuSheet()); await p.click('[data-a="resign"]'); await p.click('[data-a="resign2"]'); await p.waitForSelector('#sheet [data-a="rpwatch"]');
  ok(await p.evaluate(() => rpList()[0].reason === 'resign' && rpList()[0].winner === 1), 'a resigned match is recorded'); await p.click('#sheet [data-a="rpwatch"]'); await p.evaluate(() => rpSeek(M.rp.n));
  await p.evaluate(() => rpCmd('prev')); await p.evaluate(() => rpCmd('next')); ok(/resigned here/.test(await p.textContent('#ticker')), 'its replay ends with the resignation: ' + await p.textContent('#ticker'));
  // ---- puzzles and the tutorial are not recorded; the list is capped
  await p.evaluate(() => { toTitle(); puzzleGo(1); }); ok(await p.evaluate(() => M.rec === null), 'puzzles are not recorded');
  await p.evaluate(() => { toTitle(); const r = rpList()[0]; rpStore(Array.from({length: 40}, (_, i) => Object.assign({}, r, {id: 'x' + i}))); }); ok(await p.evaluate(() => rpList().length === 30), 'only the last 30 are kept');
  // ---- phone
  const ph = await open(390, 780); ok(await ph.evaluate(() => { const t = document.querySelector('#title'); return t.scrollHeight <= t.clientHeight + 1; }), 'the title menu fits on a phone'); await shot(ph, 'phone_title');
  await ph.evaluate(code => { rpImportText(code); }, code); await ph.waitForSelector('.rpbar'); await ph.evaluate(() => rpSeek(9)); await shot(ph, 'phone_replay');
  ok(await ph.evaluate(() => document.querySelector('#app').scrollWidth <= document.querySelector('#app').clientWidth + 1 && document.querySelector('.rpbar').getBoundingClientRect().bottom <= document.querySelector('#hand').getBoundingClientRect().top + 2), 'the replay controls fit on a phone');
  console.log(`replays+volume: ${fails.length} fails, ${errs.length} page errors`, fails, errs);
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
