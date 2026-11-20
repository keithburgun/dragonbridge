/* ---------- Controller (gamepad) and keyboard play ----------
   Works the same in a browser, the Windows / Linux desktop app (Steam Deck) and the Android app.
   A highlight moves between everything you could click. A selects, B goes back (or opens the menu), X takes back your
   last choice (Undo), Y looks at the highlighted card, LB/RB switch tabs (or step through a replay), the right stick
   scrolls, Start opens the menu, View/Select opens the match log.
   Keyboard: arrows, Enter or Space, Esc, U (Undo), L (log), T (Expert tip), Q/E (tabs).
   Text boxes (the online game code, signing in) get an on-screen keyboard when a controller is in use.
   Input comes from the browser's Gamepad API, or (Android app) from native events forwarded through DBPAD.nat*. */
(() => {
const q = s => document.querySelector(s);
const SEL = '[data-a],[data-ci],button,input,select,textarea,a[href]';
const IDX = {A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, SELECT: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15};
const DIRS = new Set(['U', 'D', 'L', 'R']);
let on = false, cur = null, sidPrev = '', reqPrev, glyph = 'xbox', padGlyph = 'xbox', natGlyph = 'xbox', hintSig = '', coachSig = '';
const mem = {}, prev = {}, rep = {}, padActive = {};
const nat = {used: false, kb: [], hb: [], ax: [0, 0, 0, 0]};
const padKind = id => /054c|sony|playstation|dualsense|dualshock|wireless controller/i.test(id || '') ? 'ps' : 'xbox';

const ovOn = () => q('#ov').classList.contains('show');
const oskOn = () => !q('#osk').hidden;
const game = () => { try { return M; } catch (e) { return null; } };
const myReq = () => { const m = game(); return m && !m.busy && !m.rp && !m.G.over && m.G.req && m.G.req.p === 0 ? m.G.req : null; };
const screen = () => [...document.querySelectorAll('.screen')].find(s => !s.hidden) || q('#title');
function scopeEl() { if (oskOn()) return q('#osk'); if (ovOn()) return q('#sheet'); return screen(); }
function scopeId(sc) { if (sc.id === 'sheet') { const h = sc.querySelector('h2,h3'); return 'sheet:' + (h ? h.textContent.trim().slice(0, 40) : sc.className); } return sc.id; }
function ok(el) {
  if (el.disabled || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
  const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0;
}
function cands(sc) {
  const out = new Set(), roots = sc.id === 'game' ? [sc, q('#coach')] : [sc];
  for (const root of roots) for (let el of root.querySelectorAll(SEL)) {
    if (el.classList.contains('tok') || el.id === 'rpfilein') continue;                       // (a Wizard token: the tile under it is what you choose)
    if (el.matches('input[type=checkbox],input[type=radio],input[type=file]')) { const l = el.closest('label'); if (l) el = l; }
    else if (el.parentElement && el.parentElement.closest('button')) continue;
    if (ok(el)) out.add(el);
  }
  return [...out];
}
const DK = ['a', 'v', 'i', 'ci', 'id', 'k', 't'];
function key(el) { const d = el.dataset || {}; let k = el.tagName + '|' + (el.id || '') + '|' + DK.map(x => d[x] || '').join('|'); if (!d.a && !el.id) k += '|' + (el.textContent || '').trim().slice(0, 20); return k; }
function nearest(L, r) { const x = r.left + r.width / 2, y = r.top + r.height / 2; let b = null, bd = 1e12; for (const e of L) { const s = e.getBoundingClientRect(), d = (s.left + s.width / 2 - x) ** 2 + (s.top + s.height / 2 - y) ** 2; if (d < bd) { bd = d; b = e; } } return b; }
/* Where the highlight starts for the choice in front of you. */
function gameDefault(L) {
  const r = myReq(), f = s => L.find(e => e.matches(s)), m = game();
  const co = L.find(e => e.closest('#coach')); if (co) return co;
  if (m && m.rp) return f('[data-v=play]') || L[0];
  if (r) {
    if (r.kind === 'tile') { const tiles = L.filter(e => e.matches('.tile.can')), tk = q('#bridge .tok.' + (r.who === 1 ? 'opp' : 'me')); if (tiles.length) return tk ? nearest(tiles, tk.getBoundingClientRect()) : tiles[0]; }
    if (r.kind === 'card' && r.main) return f('#hand .cardb.can') || f('#hand .cardb');
    return f('#opts [data-a=insight]') || f('#opts .btn.pri') || f('#opts [data-a],#opts [data-ci]') || f('#hand .cardb.can') || f('#table [data-ci]') || f('#hand .cardb') || L[0];
  }
  return f('#mebar [data-a=menu]') || L[0];
}
function defaultFor(sc, L) {
  const f = s => L.find(e => e.matches(s));
  if (sc.id === 'osk') return f('[data-k=q]') || L[0];
  if (sc.id === 'sheet') return f('[autofocus]') || f('.inrow .cardb') || (sc.querySelector('input,label') ? L[0] : null) || f('.acts .btn.pri') || f('.tbtn.pri') || f('.btn.pri') || L[0];   // (a sheet of settings or a form starts at its top)
  if (sc.id === 'title') return f('#contbtn') || f('#playbtn') || L[0];
  if (sc.id === 'setup') return f('[data-a=launch]') || f('[data-a=tourgo]') || f('.pick') || L[0];
  return gameDefault(L);
}
function restore(sid, sc, L) {
  if (!L.length) return null; const m = mem[sid];
  if (sc.id === 'sheet') { const af = L.find(e => e.matches('[autofocus]')); if (af) return af; }   // a sheet that names its main button starts there
  if (m) { const same = L.filter(e => key(e) === m.k); if (same.length) return same[Math.min(m.n, same.length - 1)]; if (sid === 'game' || sid === 'setup') return nearest(L, m.r); }
  return defaultFor(sc, L);
}
function setCur(el, scroll = true) {
  if (cur && cur !== el) cur.classList.remove('padf'); cur = el; if (!el) { hint(); return; }
  if (on) {
    el.classList.add('padf');
    const ae = document.activeElement;
    if (el.matches('button,a[href],input[type=range]')) { if (ae !== el) try { el.focus({preventScroll: true}); } catch (e) {} }
    else if (ae && ae !== document.body && !el.contains(ae) && ae.blur) ae.blur();
    if (scroll) try { el.scrollIntoView({block: 'nearest', inline: 'nearest'}); } catch (e) {}
  }
  const sc = scopeEl(), k = key(el), same = cands(sc).filter(e => key(e) === k);
  mem[scopeId(sc)] = {k, n: Math.max(0, same.indexOf(el)), r: el.getBoundingClientRect()};
  hint();
}
/* Keep the highlight on something sensible as screens open, close and redraw. */
function upkeep() {
  const sc = scopeEl(), sid = scopeId(sc);
  if (sid !== sidPrev) { sidPrev = sid; setCur(restore(sid, sc, cands(sc))); }
  else if (!cur || !cur.isConnected || !(sc.contains(cur) || cur.closest('#coach')) || !ok(cur)) setCur(restore(sid, sc, cands(sc)), false);
  if (sid === 'game') {
    const co = q('#coach'), cs = co.hidden ? '' : co.textContent.slice(0, 60);
    if (cs !== coachSig) { coachSig = cs; const b = !co.hidden && co.querySelector('[data-a]'); if (b) setCur(b); }   // the tutorial coach speaks: go to its button
    const r = myReq(), m = game(), sig = r ? r : m && m.rp ? 'rp' : null;
    if (sig !== reqPrev && !(sig === 'rp' && !q('#opts [data-v=play]'))) { reqPrev = sig; if (sig) forReq(); }   // a new choice in front of you (or a replay): the highlight goes to it; coming back from a menu to the same choice, it stays put
  }
  if (on && cur && !cur.classList.contains('padf')) cur.classList.add('padf');
}
function forReq() { if (cur && cur.closest('#coach')) return; const t = gameDefault(cands(q('#game'))); if (t) setCur(t); }

function move(dx, dy) {
  const sc = scopeEl(), L = cands(sc); if (!L.length) return;
  if (!cur || !L.includes(cur)) { setCur(restore(scopeId(sc), sc, L)); return; }
  if (dx && cur.matches('input[type=range]')) { const st = +cur.step || 1, v = Math.max(+cur.min || 0, Math.min(+cur.max || 100, +cur.value + dx * st)); if (v !== +cur.value) { cur.value = v; cur.dispatchEvent(new Event('input', {bubbles: true})); cur.dispatchEvent(new Event('change', {bubbles: true})); } return; }
  const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2; let best = null, bs = 1e12;
  for (const e of L) {
    if (e === cur || e.contains(cur) || cur.contains(e)) continue;
    const r = e.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const p = dx ? (cx - ax) * dx : (cy - ay) * dy; if (p <= Math.max(2, .35 * (dx ? Math.min(a.width, r.width) : Math.min(a.height, r.height)))) continue;   // must really lie that way, not a neighbour on the same row
    const edge = dx ? (dx > 0 ? r.left - a.right : a.left - r.right) : (dy > 0 ? r.top - a.bottom : a.top - r.bottom);
    const og = dx ? Math.max(0, r.top - a.bottom, a.top - r.bottom) : Math.max(0, r.left - a.right, a.left - r.right);
    const oc = dx ? Math.abs(cy - ay) : Math.abs(cx - ax);
    const s = Math.max(0, edge) + p * .25 + og * 4 + oc * .35; if (s < bs) { bs = s; best = e; }
  }
  if (best) setCur(best);
  else if (dy) { const s = scroller(); if (s) s.scrollBy({top: dy * 160, behavior: 'smooth'}); }   // nothing further that way: scroll (a long rulebook page, the log)
}
const TEXTY = 'input[type=text],input[type=email],input[type=password],input[type=number],input:not([type]),textarea';
function activate(el) {
  if (!el) return;
  if (el.matches(TEXTY)) { if (el.readOnly) { try { el.focus(); el.select(); } catch (e) {} return; } if (glyph !== 'kb') oskOpen(el); else { el.focus(); try { el.select(); } catch (e) {} } return; }
  if (el.matches('input[type=range]')) return;
  el.click();
}
function clickIn(sc, sels) { for (const s of sels) { const b = [...sc.querySelectorAll(s)].find(ok); if (b) { b.click(); return true; } } return false; }
function back() {
  if (oskOn()) { oskClose(); return; }
  if (ovOn()) {
    const sh = q('#sheet'); if (sh.classList.contains('lobby')) return;                        // the lobby closes with its own Leave button
    if (clickIn(sh, ['[data-a=close]', '[data-a=sub]'])) return;
    const b = [...sh.querySelectorAll('.acts .btn')].filter(ok).find(e => /^(back|cancel|close|done|keep|stay|not now|no\b)/i.test(e.textContent.trim())); if (b) { b.click(); return; }
    if (!sh.classList.contains('lock')) closeOv(); return;
  }
  const sc = screen(), m = game();
  if (sc.id === 'setup') { toTitle(); return; }
  if (sc.id === 'game' && m) { if (clickIn(q('#opts'), ['[data-a=sub]'])) return; menuSheet(); }
}
function tabs(d) {
  const sc = scopeEl(), m = game();
  if (sc.id === 'game' && m && m.rp) { rpCmd(d < 0 ? 'prev' : 'next'); return true; }
  for (const a of ['libtab', 'setmode', 'libed']) {
    const g = [...sc.querySelectorAll(`[data-a="${a}"]`)].filter(ok); if (g.length < 2) continue;
    let i = g.findIndex(e => e.getAttribute('aria-pressed') === 'true'); if (i < 0) i = 0;
    const n = g[(i + d + g.length) % g.length], k = key(n); n.click();
    requestAnimationFrame(() => { const m2 = cands(scopeEl()).find(e => key(e) === k); if (m2) setCur(m2); }); return true;
  }
  return false;
}
function scroller() {
  let e = cur; while (e && e !== document.body && e !== document.documentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 2) return e; e = e.parentElement; }
  if (ovOn()) return q('#sheet'); const sc = screen(); if (sc.id === 'game') return q('#loglive'); return sc.scrollHeight > sc.clientHeight + 2 ? sc : q('#setupbody') || sc;
}
function page(d) { const s = scroller(); if (s) s.scrollBy({top: d * s.clientHeight * .8, behavior: 'smooth'}); }
/* Y: read the highlighted card (or Wizard, Item, Hack) at full size. */
function peekOf(el) { const p = el && el.dataset && el.dataset.peek; if (!p) return null; return p === 'dragon' ? ['dragon'] : /^wz_/.test(p) ? ['wiz', p.slice(3)] : /^it_/.test(p) ? ['item', p.slice(3)] : /^hk_/.test(p) ? ['hack', p.slice(3)] : ['card', p]; }
function lookY() { const k = peekOf(cur); if (!k || ovOn()) return; if (k[0] === 'dragon') q('#dragon .dface').click(); else zoomThing(k[0], k[1]); }
function undoX() { if (oskOn()) { oskKey('⌫'); return; } const b = q('#undobtn'); if (b && ok(b) && !ovOn()) b.click(); }
function tipKey() { const b = q('#tipbtn'); if (b && ok(b) && !ovOn()) b.click(); }
function startBtn() {
  if (oskOn()) { oskClose(); return; } if (ovOn()) { back(); return; }
  const sc = screen(); if (sc.id === 'title') { const b = defaultFor(sc, cands(sc)); if (b) b.click(); return; }
  if (sc.id === 'setup') { const b = [...sc.querySelectorAll('[data-a=launch],[data-a=tourgo]')].find(ok); if (b) b.click(); return; }
  if (game()) menuSheet();
}
function selBtn() { if (game() && !ovOn() && screen().id === 'game') logSheet(); }

function wake() { if (on) return; on = true; document.body.classList.add('pad'); try { hidePeek(); } catch (e) {} if (cur && cur.isConnected) cur.classList.add('padf'); }
function sleep() { if (!on) return; on = false; document.body.classList.remove('pad'); if (cur) cur.classList.remove('padf'); hint(); }
function press(k, src) {
  const g = src === 'kb' ? 'kb' : (nat.used ? natGlyph : padGlyph); if (g !== glyph) { glyph = g; hintSig = ''; }   // the prompts follow whatever you last pressed
  const was = on, had = !!(cur && cur.isConnected); wake(); upkeep();
  if (!was && (DIRS.has(k) || k === 'A')) { if (!had) setCur(restore(sidPrev, scopeEl(), cands(scopeEl()))); hint(); return; }   // the first press only shows where the highlight is
  switch (k) {
    case 'U': move(0, -1); break; case 'D': move(0, 1); break; case 'L': move(-1, 0); break; case 'R': move(1, 0); break;
    case 'A': activate(cur); break; case 'B': back(); break; case 'X': undoX(); break; case 'Y': lookY(); break;
    case 'LB': if (!tabs(-1)) page(-1); break; case 'RB': if (!tabs(1)) page(1); break; case 'LT': page(-1); break; case 'RT': page(1); break;
    case 'START': startBtn(); break; case 'SEL': selBtn(); break; case 'TIP': tipKey(); break;
  }
  setTimeout(() => { upkeep(); hint(); }, 0);
}

/* ---------- the on-screen keyboard (for a controller: game codes, signing in) ---------- */
const OSK_ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', '@._-'];
let oskFor = null, oskShift = false;
function oskDraw() {
  const o = q('#osk'), v = oskFor ? oskFor.value : '', pw = oskFor && oskFor.type === 'password';
  o.innerHTML = `<div class="oskbox"><div class="oskval" aria-live="polite">${pw ? '•'.repeat(v.length) : esc(v) || '<span class="lbl">…</span>'}</div>`
    + OSK_ROWS.map(r => `<div class="oskrow">${[...r].map(c => `<button class="btn sm" data-osk="1" data-k="${esc(c)}">${esc(oskShift ? c.toUpperCase() : c)}</button>`).join('')}</div>`).join('')
    + `<div class="oskrow"><button class="btn sm" data-osk="1" data-k="⇧" aria-pressed="${oskShift}">Shift</button><button class="btn sm" data-osk="1" data-k=" ">Space</button><button class="btn sm" data-osk="1" data-k="⌫">Delete</button><button class="btn sm pri" data-osk="1" data-k="⏎">Done</button></div></div>`;
}
function oskOpen(el) { oskFor = el; oskShift = false; q('#osk').hidden = false; oskDraw(); sidPrev = ''; upkeep(); }
function oskClose() { q('#osk').hidden = true; const el = oskFor; oskFor = null; sidPrev = ''; upkeep(); if (el && el.isConnected) { const L = cands(scopeEl()); if (L.includes(el)) setCur(el); } }
function oskKey(k) {
  const el = oskFor; if (!el || !el.isConnected) return oskClose();
  if (k === '⏎') return oskClose();
  if (k === '⇧') oskShift = !oskShift;
  else { const max = el.maxLength > 0 ? el.maxLength : 200; el.value = k === '⌫' ? el.value.slice(0, -1) : (el.value + (oskShift ? k.toUpperCase() : k)).slice(0, max); el.dispatchEvent(new Event('input', {bubbles: true})); }
  const kk = cur && cur.dataset ? cur.dataset.k : null; oskDraw(); const b = kk != null && [...q('#osk').querySelectorAll('[data-k]')].find(e => e.dataset.k === kk); if (b) setCur(b, false);
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-osk]'); if (b) { e.stopPropagation(); oskKey(b.dataset.k); } }, true);

/* ---------- on-screen button prompts ---------- */
const GL = {xbox: {A: 'A', B: 'B', X: 'X', Y: 'Y', LB: 'LB', RB: 'RB', SEL: '⧉', START: '☰'}, ps: {A: '✕', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', SEL: '⧉', START: '☰'},
  kb: {A: 'Enter', B: 'Esc', X: 'U', Y: 'Y', LB: 'Q', RB: 'E', SEL: 'L', START: 'Enter'}};
function hint() {
  const el = q('#padhint'); if (!el) return; if (!on) { el.classList.remove('show'); hintSig = ''; return; }
  const sc = scopeEl(), inGame = sc.id === 'game', m = game(), items = [];
  let aL = 'Select';
  if (cur) {
    if (cur.matches('.tile.can')) aL = myReq() && myReq().verb === 'bump' ? 'Bump here' : 'Go here';
    else if (cur.matches('#hand .cardb')) aL = cur.dataset.ci != null ? 'Play' : 'Look';
    else if (cur.matches('label')) aL = 'Toggle';
    else if (cur.matches('input[type=range]')) aL = '';
    else if (cur.matches(TEXTY)) aL = 'Type';
    else if (cur.dataset.osk) aL = 'Type';
  }
  if (cur && cur.matches('input[type=range]')) items.push(['', glyph === 'kb' ? '← → Adjust' : '◀ ▶ Adjust']);
  if (aL) items.push(['A', aL]);
  if (sc.id === 'osk') items.push(['X', 'Delete'], ['B', 'Done']);
  else {
    if (!ovOn() && aL !== 'Look' && peekOf(cur)) items.push(['Y', 'Look']);
    const ub = q('#undobtn'); if (inGame && ub && ok(ub)) items.push(['X', 'Undo']);
    if (inGame && m && m.rp) items.push(['LB', 'RB', 'Step']);
    else if (['libtab', 'setmode', 'libed'].some(a => [...sc.querySelectorAll(`[data-a="${a}"]`)].filter(ok).length > 1)) items.push(['LB', 'RB', 'Tabs']);
    if (ovOn()) { if (!q('#sheet').classList.contains('lobby')) items.push(['B', 'Back']); }
    else if (sc.id === 'setup') { items.push(['B', 'Back']); if (glyph !== 'kb') items.push(['START', 'Start']); }
    else if (inGame && m) items.push(['B', 'Menu'], ['SEL', 'Log']);
  }
  const G = GL[glyph], sig = glyph + JSON.stringify(items); if (sig === hintSig) { el.classList.add('show'); return; } hintSig = sig;
  el.classList.remove('idle'); clearTimeout(hint.t); hint.t = setTimeout(() => el.classList.add('idle'), 5000);   // fades back after a few seconds so it doesn't cover the table
  el.innerHTML = items.map(it => { const lab = it[it.length - 1], bs = it.slice(0, -1).filter(Boolean); return `<span class="ph">${bs.map(b => `<b class="pg pg-${b.toLowerCase()} ${glyph}${glyph === 'kb' ? ' key' : ''}">${G[b] || b}</b>`).join('')}${lab}</span>`; }).join('');
  el.classList.add('show');
}

/* ---------- input sources ---------- */
function readPad() {
  if (nat.used) { const b = []; for (let i = 0; i < 17; i++) b[i] = !!(nat.kb[i] || nat.hb[i]); return {b, ax: nat.ax}; }
  let gs = []; try { gs = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) {}
  const b = [], ax = [0, 0, 0, 0]; let any = false;
  for (const g of gs) {
    if (!g || !g.connected) continue; any = true;
    g.buttons.forEach((x, i) => { if (x && (x.pressed || x.value > .5)) b[i] = true; });
    g.axes.forEach((v, i) => { if (i < 4 && Math.abs(v) > Math.abs(ax[i])) ax[i] = v; });
    const act = g.buttons.some(x => x && (x.pressed || x.value > .5)) || g.axes.slice(0, 2).some(v => Math.abs(v) > .55);
    if (act && !padActive[g.index]) padGlyph = padKind(g.id); padActive[g.index] = act;
  }
  return any ? {b, ax} : null;
}
let tick = 0;
function frame(t) {
  requestAnimationFrame(frame); const s = readPad();
  if (s) {
    const v = {A: s.b[0], B: s.b[1], X: s.b[2], Y: s.b[3], LB: s.b[4], RB: s.b[5], LT: s.b[6], RT: s.b[7], SEL: s.b[8], START: s.b[9],
      U: s.b[12] || s.ax[1] < -.55, D: s.b[13] || s.ax[1] > .55, L: s.b[14] || s.ax[0] < -.55, R: s.b[15] || s.ax[0] > .55};
    for (const k in v) {
      const d = !!v[k];
      if (d && !prev[k]) { press(k); rep[k] = t + 380; }
      else if (d && DIRS.has(k) && t >= rep[k]) { press(k); rep[k] = t + 115; }
      prev[k] = d;
    }
    const ry = s.ax[3] || 0; if (Math.abs(ry) > .25) { wake(); const sc = scroller(); if (sc) sc.scrollBy(0, Math.sign(ry) * ry * ry * 24); }
  }
  if (on && ++tick % 6 === 0) { upkeep(); hint(); }
}
requestAnimationFrame(frame);

document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const t = e.target, typing = t && t.matches && t.matches(TEXTY + ',select');
  const go = k => { e.preventDefault(); e.stopPropagation(); press(k, 'kb'); };
  const K = {ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R'}[e.key];
  if (K) { if (typing && (K === 'L' || K === 'R')) return; if (typing) t.blur(); go(K); return; }
  if (e.key === 'Escape') { if (typing) { t.blur(); return; } go('B'); return; }
  if (typing) {   // Enter in a text box presses the button that goes with it
    if (e.key === 'Enter' && !t.matches('textarea')) { const b = t.id === 'olcode' ? q('[data-a=oljoin]') : t.id === 'acem' || t.id === 'acpw' ? q('[data-a=acctgo],[data-a=newpw]') : null; if (b) { e.preventDefault(); b.click(); } }
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') { if (!on || !cur) { if (e.key === ' ') return; wake(); upkeep(); e.preventDefault(); hint(); return; } go('A'); return; }
  const L = {q: 'LB', e: 'RB', PageUp: 'LT', PageDown: 'RT', u: 'X', y: 'Y', l: 'SEL', t: 'TIP'}[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (L) go(L);
}, true);
document.addEventListener('pointermove', e => { if (on && Math.abs(e.movementX) + Math.abs(e.movementY) > 3) sleep(); }, {passive: true});
document.addEventListener('pointerdown', e => { if (e.isTrusted) sleep(); }, true);
document.addEventListener('wheel', () => sleep(), {passive: true});

/* Follow the screen as soon as it changes (a redraw, a sheet opening or closing), not just on the next tick. */
for (const name of ['render', 'openOv', 'closeOv']) { const f = window[name]; if (typeof f === 'function') window[name] = function () { const r = f.apply(this, arguments); if (on) { upkeep(); hint(); } return r; }; }

window.DBPAD = {
  nat(k, d) { nat.used = true; const i = IDX[k]; if (i != null) nat.kb[i] = !!d; },
  natAxes(lx, ly, rx, ry, hx, hy) { nat.used = true; nat.ax = [+lx || 0, +ly || 0, +rx || 0, +ry || 0]; nat.hb[14] = hx < -.5; nat.hb[15] = hx > .5; nat.hb[12] = hy < -.5; nat.hb[13] = hy > .5; },
  natName(n) { natGlyph = padKind(n); },
  press,
  osk(el) { if (el && el.matches(TEXTY) && !el.readOnly && !oskOn()) oskOpen(el); },   // (the Steam Deck: also for a tap on a text box)
  state() { return {on, key: cur && cur.isConnected ? key(cur) : null, label: cur ? ((cur.getAttribute('aria-label') || cur.textContent || '').trim().slice(0, 40)) : '', scope: sidPrev, hint: (q('#padhint') || {}).textContent || '', glyph}; },
  list() { return cands(scopeEl()).map(e => key(e)); },
};
})();
