// Online play, with two tabs of one browser standing in for two players (window.DB_ONL_LOCAL swaps the network for a
// same-browser channel). Checks the lobby, a whole match played by both sides, what the guest may and may not see,
// the ending on both sides, the replays, and going back to the lobby.
//   node tests/browser_online.js [screenshot-dir]
const {chromium} = require('playwright'); const path = require('path');
const dir = process.argv[2], fails = [], errs = [], ok = (c, m) => { if (!c) fails.push(m); };
const PAGE = 'file://' + path.resolve(__dirname, '../dist/dragonbridge.html');
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({viewport: {width: 1280, height: 800}});
  await ctx.addInitScript(() => { window.DB_ONL_LOCAL = true; });
  const open = async name => { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(name + ': ' + e.message)); await p.goto(PAGE); await p.waitForTimeout(300); await p.evaluate(() => { P.opt.speed = 0; P.opt.sound = false; P.opt.oneTap = true; window.TEST_FAST = true; }); return p; };
  const shot = async (p, n) => { if (dir) await p.screenshot({path: path.join(dir, `onl_${n}.png`)}); };
  const H = await open('host'), G = await open('guest');
  for (const p of [H, G]) await p.evaluate(() => { window.__saved = []; const real = rpSave; window.rpSave = function (e) { const rec = M && (e && e.rec || M.rec), id = real(e); if (id && rec) { const r = {snap: rec.snap, log0: rec.log0, decs: rec.decs}, g = rpRun(r, r.decs.length), st = rpList().find(x => x.id === id) || {}; window.__saved.push({id, mode: st.mode, pov: e && e.pov ? 1 : 0, winner: g.S.winner, n: r.decs.length, same: g.S.reason === M.G.S.reason}); } return id; }; });
  // ---- host a game, join it by code
  await H.click('#onlbtn'); ok(/Host a game/.test(await H.textContent('#sheet')) && /Join a game/.test(await H.textContent('#sheet')), 'Play Online offers Host and Join'); await shot(H, 'menu');
  await H.click('[data-a="olhost"]'); await H.waitForSelector('#sheet.lobby .olbig'); const code = (await H.textContent('.olbig')).trim();
  ok(/^[A-Z0-9]{6}$/.test(code) && /Waiting for your friend/.test(await H.textContent('#sheet')), 'the host gets a 6-character code and waits: ' + code); await shot(H, 'lobby_wait');
  await H.mouse.click(5, 5); ok(await H.isVisible('#sheet.lobby'), 'the lobby does not close by clicking outside it');
  await G.click('#onlbtn'); await G.fill('#olcode', 'zz'); await G.click('[data-a="oljoin"]'); ok(/6-character/.test(await G.textContent('#toast')), 'a short code is refused');
  await G.fill('#olcode', code); await G.click('[data-a="oljoin"]'); await G.waitForSelector('#sheet.lobby .olslots');
  await H.waitForFunction(() => ONL.guest); await G.waitForFunction(() => ONL.host);
  ok(/Choosing|Derby/.test(await H.textContent('.olslots')) && !/Waiting for your friend/.test(await H.textContent('#sheet')), 'the host sees the guest arrive');
  // ---- no mirror matches: the guest cannot ready up with the host's Wizard
  await H.click('[data-a="olwiz"][data-v="eve"]'); await G.click('[data-a="olwiz"][data-v="eve"]'); await H.click('[data-a="olready"]');
  await G.waitForFunction(() => ONL.host && ONL.host.ready); ok(await G.evaluate(() => document.querySelector('[data-a="olready"]').disabled && document.querySelector('[data-a="olwiz"][data-v="eve"]').disabled), 'the guest cannot take the same Wizard'); await shot(G, 'lobby_clash');
  await G.click('[data-a="olwiz"][data-v="gelf"]'); await G.click('[data-a="olready"]');
  await H.waitForFunction(() => M && M.cfg.online === 'host', null, {timeout: 8000}); await G.waitForFunction(() => M && M.cfg.online === 'guest', null, {timeout: 8000});
  ok(await H.evaluate(() => M.G.S.wiz.join() === 'eve,gelf') && await G.evaluate(() => M.G.S.wiz.join() === 'gelf,eve'), 'the match starts; each player sits at the bottom of their own screen');
  await shot(H, 'host_start'); await shot(G, 'guest_start');
  // ---- what the guest is sent
  const view = await G.evaluate(() => ({hand: M.G.S.hand, deck: [...new Set(M.G.S.deck)].join(), seed: M.G.S.seed, opp: document.querySelector('#oppbar').textContent, tok: document.querySelector('#bridge .tok.opp .you').textContent, backs: document.querySelectorAll('#oppbar .backs img').length, undo: !!document.querySelector('#undobtn').offsetParent}));
  const real = await H.evaluate(() => ({hand: M.G.S.hand, pos: M.G.S.pos}));
  ok(view.hand[1].every(c => c === '?') && view.deck === '?' && view.seed === 0, 'the guest is not sent the host’s hand, the deck or the shuffle: ' + JSON.stringify(view.hand[1]));
  ok(view.hand[0].join() === real.hand[1].join() && view.backs === 4, 'the guest has its own hand and sees four card backs');
  ok(/Online opponent/.test(view.opp) && view.tok === 'OPP' && !view.undo, 'the other seat is labelled as an online opponent; no Undo online');
  ok(await G.evaluate(() => JSON.stringify(M.G.S.pos)) === JSON.stringify(real.pos.slice().reverse()), 'both see the same bridge');
  // ---- play it out: each side answers its own choices
  let moves = [0, 0];
  for (let i = 0; i < 4000; i++) {
    const done = await H.evaluate(() => !M || M.G.over); if (done) break; let any = false;
    for (const [k, p] of [[0, H], [1, G]]) {
      const can = await p.evaluate(() => !!(M && !M.busy && !M.G.over && M.G.req && M.G.req.p === 0));
      if (can) { any = true; moves[k]++; await p.evaluate(() => answer(Math.floor(Math.random() * M.G.req.opts.length))); }
    }
    if (!any) await H.waitForTimeout(15);
    if (i % 25 === 0) {   // now and then: the two screens agree
      await H.waitForTimeout(40); const a = await H.evaluate(() => M && !M.busy ? JSON.stringify([M.G.S.pos, M.G.S.nest, M.G.S.ready, M.G.S.turn, M.G.S.dragon]) : null), c = await G.evaluate(() => M ? JSON.stringify([M.G.S.pos.slice().reverse(), M.G.S.nest, M.G.S.ready.slice().reverse(), M.G.S.turn, M.G.S.dragon]) : null);
      if (a && c && a !== c) { await H.waitForTimeout(150); const a2 = await H.evaluate(() => JSON.stringify([M.G.S.pos, M.G.S.nest, M.G.S.ready, M.G.S.turn, M.G.S.dragon])), c2 = await G.evaluate(() => JSON.stringify([M.G.S.pos.slice().reverse(), M.G.S.nest, M.G.S.ready.slice().reverse(), M.G.S.turn, M.G.S.dragon])); ok(a2 === c2, 'the two screens disagree: ' + a2 + ' vs ' + c2); }
    }
  }
  await H.waitForSelector('#ov.show #sheet [data-a="olagain"]', {timeout: 15000}); await G.waitForSelector('#ov.show #sheet [data-a="olagain"]', {timeout: 15000});
  ok(moves[0] > 2 && moves[1] > 2, 'both players made choices: ' + moves);
  const eh = await H.evaluate(() => ({w: M.G.S.winner, why: M.G.S.reason, t: M.G.S.turn, head: document.querySelector('#sheet h2').textContent, txt: document.querySelector('#sheet').textContent})), eg = await G.evaluate(() => ({w: M.G.S.winner, why: M.G.S.reason, t: M.G.S.turn, head: document.querySelector('#sheet h2').textContent, txt: document.querySelector('#sheet').textContent, log: M.G.S.log.length}));
  ok(eh.w === 1 - eg.w && eh.why === eg.why && eh.t === eg.t && eh.head === eg.head, 'both see the same ending: ' + JSON.stringify([eh.head, eg.head, eh.w, eg.w]));
  ok(/That’s you/.test(eh.w === 0 ? eh.txt : eg.txt) && /Better luck/.test(eh.w === 0 ? eg.txt : eh.txt) && /aren’t counted/.test(eh.txt), 'the winner and the loser are told so; not counted in stats'); await shot(H, 'host_end'); await shot(G, 'guest_end');
  ok(await H.evaluate(() => !Object.keys(P.st).length) && await G.evaluate(() => !Object.keys(P.st).length), 'no stats recorded');
  ok(eg.log === await H.evaluate(() => M.G.S.log.length), 'the guest has the whole match log');
  // ---- both keep the replay; the guest's is shown from its own seat
  // (the two tabs share one storage here, so each tab notes what it saved itself)
  const rh = await H.evaluate(() => window.__saved), rg = await G.evaluate(() => window.__saved);
  ok(rh.length === 1 && rg.length === 1 && rh[0].mode === 'online' && rh[0].pov === 0 && rg[0].pov === 1 && rh[0].winner === rg[0].winner && rh[0].n === rg[0].n && rh[0].n > 4 && rh[0].id !== rg[0].id, 'both saved the replay: ' + JSON.stringify([rh, rg]));
  ok(rh[0].same && rg[0].same, 'and both copies play back to the same ending');
  // ---- back to the lobby for another match
  await H.click('[data-a="olagain"]'); await G.waitForSelector('#sheet.lobby'); ok(await H.isVisible('#sheet.lobby') && await G.evaluate(() => !ONL.started && !ONL.ready && document.querySelector('#title').hidden === false), 'both are back in the lobby'); await shot(G, 'lobby_again');
  await H.click('[data-a="olready"]'); await G.click('[data-a="olready"]'); await G.waitForFunction(() => M && M.cfg.online === 'guest' && M.G.S.turn >= 1 && !M.G.over, null, {timeout: 8000});
  ok(await G.evaluate(() => M.G.S.log.length < 6 && M.G.S.nest.length === 0), 'a second match starts fresh');
  // ---- the guest drops out and comes back
  const gid = await H.evaluate(() => M.id);
  await G.evaluate(() => onlLeave()); await H.waitForFunction(() => document.querySelector('#onlbar').classList.contains('show')); ok(/disconnected/.test(await H.textContent('#onlbar')), 'the host is told the guest dropped out'); await shot(H, 'dropped');
  await G.evaluate(() => { toTitle(); }); await G.evaluate(code => onlJoin(code), code);
  await G.waitForFunction(gid => M && M.cfg.online === 'guest' && M.id === gid, gid, {timeout: 8000}); await H.waitForFunction(() => !document.querySelector('#onlbar').classList.contains('show'));
  ok(await G.evaluate(() => JSON.stringify(M.G.S.pos)) === await H.evaluate(() => JSON.stringify(M.G.S.pos.slice().reverse())), 'rejoining with the code picks the match up where it was');
  // ---- leaving
  await G.evaluate(() => menuSheet()); ok(/Leave the match/.test(await G.textContent('#sheet')) && !/Resign/.test(await G.textContent('#sheet')), 'the menu offers Leave'); await G.click('[data-a="olquit"]'); await G.click('[data-a="olcancel"]');
  ok(await G.evaluate(() => !ONL.on && !M && !document.querySelector('#title').hidden), 'leaving returns to the title'); await H.waitForFunction(() => document.querySelector('#onlbar').classList.contains('show'));
  await H.evaluate(() => toTitle()); ok(await H.evaluate(() => !ONL.on && !document.querySelector('#onlbar').classList.contains('show') && !localStorage.getItem('db_save')), 'the host leaving ends the session; nothing is saved to continue');
  // ---- an invite link joins directly
  const H2 = await open('host2'); await H2.click('#onlbtn'); await H2.click('[data-a="olhost"]'); await H2.waitForSelector('.olbig'); const code2 = (await H2.textContent('.olbig')).trim().toLowerCase();
  const G2 = await ctx.newPage(); G2.on('pageerror', e => errs.push('guest2: ' + e.message)); await G2.goto(PAGE + '#join=' + code2); await G2.waitForSelector('#sheet.lobby .olslots', {timeout: 8000});
  await H2.waitForFunction(() => ONL.guest); ok(await G2.evaluate(c => ONL.role === 'guest' && ONL.code === c && !/join=/.test(location.hash), code2), 'opening an invite link joins that game');
  // ---- not offered where it cannot work
  const N = await b.newPage(); await N.goto('file://' + path.resolve(__dirname, '../dist/dragonbridge.html')); await N.waitForTimeout(300);
  ok(await N.evaluate(() => typeof Peer === 'function' && onlAvail()), 'the full build carries the peer-to-peer library');
  console.log(`online: ${fails.length} fails, ${errs.length} page errors`, fails, errs);
  await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
