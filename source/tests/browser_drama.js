// Movement slides, the Dragon's flight, and the escape / pounce endings, in a real browser at Fast speed.
//   node tests/browser_drama.js [screenshot-dir]
const {chromium} = require('playwright'); const path = require('path');
const dir = process.argv[2], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
(async () => {
  const b = await chromium.launch(), p = await b.newPage({viewport: {width: 1280, height: 800}}); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (dir) await p.screenshot({path: path.join(dir, `drama_${n}.png`)}); };
  await p.goto('file://' + path.resolve(__dirname, '../dist/dragonbridge.html')); await p.waitForTimeout(400);
  // a match with a hand and position of our choosing (player 0 = you, moving first)
  const stage = (wiz, hand, pre) => p.evaluate(([wiz, hand, pre]) => {
    P.opt.speed = 0.5; P.opt.oneTap = true; P.opt.sound = false;
    startMatch({mode: 'versus', wiz, level: 'easy', seed: 4, first: 0});
    const snap = clone(M.G.snap), all = snap.deck.concat(snap.hand[0]); for (const c of hand) all.splice(all.indexOf(c), 1); snap.hand[0] = hand; snap.deck = all;
    new Function('S', pre)(snap); M.G = Game.resume(snap, [], []); M.fresh = true; resetStage(); render();
  }, [wiz, hand, pre]);
  const pick = f => p.evaluate(f => answer(M.G.req.opts.findIndex(new Function('o', 'return ' + f))), f);
  const banner = () => p.evaluate(() => { const b = document.querySelector('#banner'); return b.classList.contains('on') ? b.innerText.replace(/\s+/g, ' ').trim() : ''; });
  // ---- a move slides
  await stage(['derby', 'gelf'], ['hop', 'soda', 'bait', 'step'], 'S.pos[0] = 9; S.pos[1] = 11;');
  await pick("o.card === 'hop'"); const x0 = await p.evaluate(() => document.querySelector('#bridge .tok.me').getBoundingClientRect().left);
  await pick("o.tile === 12"); await p.waitForTimeout(150);
  const x1 = await p.evaluate(() => document.querySelector('#bridge .tok.me').getBoundingClientRect().left); await p.waitForTimeout(700);
  const x2 = await p.evaluate(() => document.querySelector('#bridge .tok.me').getBoundingClientRect().left);
  ok(x1 > x0 + 2 && x1 < x2 - 2 && x2 > x0 + 60, `token slides between tiles (${Math.round(x0)} → ${Math.round(x1)} → ${Math.round(x2)})`);
  // ---- Flight: the Dragon arcs to the other end
  await stage(['derby', 'gelf'], ['bait', 'soda', 'hop', 'step'], "S.nest = []; for (const c of ['fireball', 'dart', 'transfer']) { const z = S.deck.includes(c) ? S.deck : S.hand[1]; z.splice(z.indexOf(c), 1); S.nest.push(c); } while (S.hand[1].length < 4) S.hand[1].push(S.deck.pop());");
  const dx0 = await p.evaluate(() => document.querySelector('#dragon .dface').getBoundingClientRect().left);
  await pick("o.card === 'bait'"); if (await p.evaluate(() => M.G.req.kind === 'pick')) await pick("o.id === 'no'"); await pick("o.act === 'pass'");
  await p.waitForTimeout(330); await shot('flight');
  const mid = await p.evaluate(() => { const r = document.querySelector('#dragon .dface').getBoundingClientRect(), br = document.querySelector('#bridge').getBoundingClientRect(); return {x: r.left, above: r.top < br.top, anim: document.querySelector('#dragon .dfly').getAnimations().length}; });
  ok(mid.anim === 1 && mid.x > dx0 + 80 && mid.above, 'the Dragon is in the air above the bridge mid-Flight: ' + JSON.stringify(mid));
  ok(await banner() === 'Flight!', 'Flight banner');
  await p.waitForTimeout(900); ok(await p.evaluate(() => M.G.S.dragon === 1 && document.querySelector('#dragon').classList.contains('s1') && document.querySelector('#dragon .dfly').getAnimations().length === 0), 'the Dragon lands at the other end');
  // ---- Escape ending
  await stage(['derby', 'gelf'], ['hop', 'soda', 'bait', 'step'], 'S.pos[0] = 17; S.pos[1] = 11;');
  await pick("o.card === 'hop'"); ok(await p.evaluate(() => M.G.over && M.G.S.reason === 'escape'), 'escape wins');
  const left0 = await p.evaluate(() => document.querySelector('#bridge .tok.me').getBoundingClientRect().left);
  await p.waitForTimeout(900); const op = await p.evaluate(() => +getComputedStyle(document.querySelector('#bridge .tok.me')).opacity); ok(op < 0.9 && op > 0.3, 'the escaping Wizard is fading out slowly: ' + op); await shot('escape1');
  await p.waitForTimeout(500); const op2 = await p.evaluate(() => +getComputedStyle(document.querySelector('#bridge .tok.me')).opacity); ok(op2 < op - 0.15 && op2 > 0, 'and keeps fading: ' + op2);
  ok(Math.abs(left0 - await p.evaluate(() => document.querySelector('#bridge .tok.me').getBoundingClientRect().left)) < 2, 'it fades where it stands');
  ok(!(await p.evaluate(() => document.querySelector('#ov').classList.contains('show'))), 'no result sheet during the ending');
  await p.waitForTimeout(750); ok(await p.evaluate(() => +getComputedStyle(document.querySelector('#bridge .tok.me')).opacity) < 0.02, 'until it is gone'); ok(await banner() === 'Derby ESCAPES!', 'first line: ' + await banner());
  await p.waitForTimeout(650); ok(await banner() === 'Derby ESCAPES! Derby WINS!', 'second line: ' + await banner()); await shot('escape2');
  await p.waitForSelector('#ov.show', {timeout: 4000}); ok(/^Derby ESCAPES!$/.test(await p.textContent('#sheet h2')) && /Derby WINS!/.test(await p.textContent('#sheet')), 'result sheet repeats it');
  // ---- Pounce ending (you end your Gem Phase on a Threatened tile)
  await stage(['derby', 'gelf'], ['soda', 'transfer', 'bait', 'insight'], 'S.pos[0] = 1; S.pos[1] = 11; S.ready[0] = 0;');
  await pick("o.card === 'bait'"); if (await p.evaluate(() => !M.G.over && M.G.req.kind === 'pick')) await pick("o.id === 'no'"); if (await p.evaluate(() => !M.G.over)) await pick("o.act === 'pass'");
  ok(await p.evaluate(() => M.G.over && M.G.S.reason === 'pounce' && M.G.S.winner === 1), 'pounced');
  await p.waitForTimeout(560); await shot('pounce1');
  ok(await p.evaluate(() => document.querySelector('#dragon .dface').getAnimations().length === 1 && document.querySelector('#dragon .dfly').getAnimations().length === 0), 'the Dragon leaps (its face only)');
  await p.waitForTimeout(450);
  ok(await p.evaluate(() => { const d = document.querySelector('#dragon .dface').getBoundingClientRect(), t = document.querySelector('#bridge .tok.me').getBoundingClientRect(); return Math.abs(d.left + d.width / 2 - t.left - t.width / 2) < 12 && Math.abs(d.top + d.height / 2 - t.top - t.height / 2) < 12 && document.querySelector('#bridge .tok.me').classList.contains('squash'); }), 'and lands on the Wizard');
  await p.waitForTimeout(350); ok(await banner() === 'Derby was POUNCED!', 'first line: ' + await banner());
  await p.waitForTimeout(650); ok(await banner() === 'Derby was POUNCED! Gelf WINS!', 'second line: ' + await banner()); await shot('pounce2');
  await p.waitForSelector('#ov.show', {timeout: 4000}); ok(/^Derby was POUNCED!$/.test(await p.textContent('#sheet h2')), 'result sheet');
  // endings play even with CPU animation set to Instant
  await stage(['derby', 'gelf'], ['hop', 'soda', 'bait', 'step'], 'S.pos[0] = 17; S.pos[1] = 11;'); await p.evaluate(() => { P.opt.speed = 0; });
  await pick("o.card === 'hop'"); await p.waitForTimeout(1000); ok(!(await p.evaluate(() => document.querySelector('#ov').classList.contains('show'))) && await p.evaluate(() => { const o = +getComputedStyle(document.querySelector('#bridge .tok.me')).opacity; return o < 0.95 && o > 0.05; }), 'the ending also plays at Instant speed');
  await p.waitForSelector('#ov.show', {timeout: 5000}); await p.evaluate(() => { P.opt.speed = 0.5; });
  // a new match starts clean
  await p.evaluate(() => startMatch({mode: 'versus', wiz: ['derby', 'gelf'], level: 'easy', seed: 4, first: 0}));
  ok(await p.evaluate(() => { const f = document.querySelector('#dragon .dface').getBoundingClientRect(), br = document.querySelector('#bridge').getBoundingClientRect(); return f.right <= br.left + 1 && document.querySelector('#dragon').getAnimations({subtree: true}).length === 0; }), 'after a pounce the Dragon is back beside the bridge, not on it');
  ok(await p.evaluate(() => getComputedStyle(document.querySelector('.zone.threat')).boxShadow === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(getComputedStyle(document.querySelector('.zone.threat')).backgroundColor) && getComputedStyle(document.querySelector('.zone.threat')).backgroundImage === 'none'), 'no red box on the Threatened tiles');
  // ---- moves and bumps slide at Normal speed, also on a device set to reduce motion
  const p2 = await b.newPage({viewport: {width: 1280, height: 800}, reducedMotion: 'reduce'}); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto('file://' + path.resolve(__dirname, '../dist/dragonbridge.html')); await p2.waitForTimeout(400);
  await p2.evaluate(() => {
    P.opt.speed = 1; P.opt.oneTap = true; P.opt.sound = false; startMatch({mode: 'versus', wiz: ['derby', 'gelf'], level: 'easy', seed: 4, first: 0});
    const snap = clone(M.G.snap), hand = ['hop', 'gale', 'bait', 'soda'], all = snap.deck.concat(snap.hand[0]); for (const c of hand) all.splice(all.indexOf(c), 1); snap.hand[0] = hand; snap.deck = all; snap.pos = [9, 12];
    M.G = Game.resume(snap, [], []); M.fresh = true; resetStage(); render();
  });
  const pick2 = f => p2.evaluate(f => answer(M.G.req.opts.findIndex(new Function('o', 'return ' + f))), f), xOf = c => p2.evaluate(c => document.querySelector('#bridge .tok.' + c).getBoundingClientRect().left, c);
  await pick2("o.card === 'gale'"); const o0 = await xOf('opp'); ok(await p2.evaluate(() => M.G.req.verb === 'bump'), 'a bump asks for a tile');
  await p2.evaluate(() => answer(M.G.req.opts.findIndex(o => o.tile > 12))); await p2.waitForTimeout(200); const o1 = await xOf('opp'); await p2.waitForTimeout(700); const o2 = await xOf('opp');
  ok(o1 > o0 + 2 && o1 < o2 - 2 && o2 > o0 + 40, `a bumped Wizard slides (${Math.round(o0)} → ${Math.round(o1)} → ${Math.round(o2)})`);
  await p2.close();
  ok(await p.evaluate(() => document.querySelector('#dragon .dfly').getAnimations().length === 0 && !document.querySelector('#bridge .tok.squash') && getComputedStyle(document.querySelector('#bridge .tok.me')).opacity === '1' && !document.querySelector('#banner').classList.contains('on')), 'the next match starts with a clean board');
  console.log(`drama: ${fails.length} fails, ${errs.length} page errors`, fails, errs.slice(0, 4)); await b.close(); process.exit(fails.length || errs.length ? 1 : 0);
})();
