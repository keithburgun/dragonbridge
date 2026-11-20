/* ---------- Online play: a 1-vs-1 match against a friend ----------
   Two players, one host. The host's game runs the rules; the guest's shows what the host sends and sends back its
   choices. The host is seat 0 and the guest seat 1; the guest is sent the position with the seats swapped (so "you" is
   always the bottom seat) and with everything it may not see masked out (the host's hand, the decks, the shuffle).
   Transport: peer-to-peer over WebRTC, using PeerJS (source/vendor/peerjs.min.js) and its public matchmaking server.
   The host takes a PeerJS id made from the 6-character game code; the guest connects to it. Only the full builds
   include it (window.DB_P2P, set by build.py). window.DB_ONL_LOCAL swaps in a same-browser stand-in for the tests. */
const ONL_PV = 1;   // protocol version: both players must have a build that speaks the same one
const onlFresh = () => ({on: false, role: null, code: null, net: null, guest: null, host: null, started: false, ready: false, wiz: null, reqId: 0, pend: null, seq: 0, seen: 0, answered: null, doneGid: null, starting: false, log: []});
let ONL = onlFresh();
const onlAvail = () => !!(window.DB_ONL_LOCAL || (window.DB_P2P && window.Peer));
const onlInApp = () => !!(window.DBDesk || (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()) || !/^https?:$/.test(location.protocol));
function onlCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; return Array.from({length: 6}, () => a[Math.floor(Math.random() * a.length)]).join(''); }

/* ---- transport: presence(p) / onPeers(fn) / write(state) / watch(fn) / leave() ---- */
function onlP2P(code, role) {
  return new Promise((resolve, reject) => {
    const cfg = Object.assign({debug: 0}, window.DB_PEER_CFG || {}), id = 'dragonbridge-' + code; let done = false;
    const peer = role === 'host' ? new Peer(id, cfg) : new Peer(cfg); const conns = new Set(), mine = {}, others = new Map(); let pfn = null, wfn = null, last = null;
    const list = () => [...others.values()], sendAll = m => { for (const c of conns) if (c.open) { try { c.send(m); } catch (e) {} } };
    const fail = msg => { if (!done) { done = true; try { peer.destroy(); } catch (e) {} reject(new Error(msg)); } };
    const hook = c => {
      conns.add(c);
      c.on('open', () => { try { c.send({t: 'p', p: mine}); if (role === 'host' && last) c.send({t: 's', s: last}); } catch (e) {} });
      c.on('data', m => { if (!m || typeof m !== 'object') return; if (m.t === 'p') { others.set(c.peer, m.p || {}); pfn && pfn(list()); } else if (m.t === 's' && role === 'guest') { last = m.s; wfn && wfn(m.s); } else if (m.t === 'bye') { others.delete(c.peer); pfn && pfn(list()); } });
      c.on('close', () => { conns.delete(c); others.delete(c.peer); pfn && pfn(list()); }); c.on('error', () => {});
    };
    const api = {kind: 'p2p',
      presence: p => { for (const k in p) { if (p[k] === null) delete mine[k]; else mine[k] = p[k]; } sendAll({t: 'p', p: mine}); return Promise.resolve(); },
      onPeers: fn => { pfn = fn; fn(list()); }, write: s => { last = s; sendAll({t: 's', s}); return Promise.resolve(); }, watch: fn => { wfn = fn; if (last) fn(last); },
      leave: () => { sendAll({t: 'bye'}); setTimeout(() => { try { peer.destroy(); } catch (e) {} }, 250); }};
    peer.on('error', e => { const ty = e && e.type; fail(ty === 'unavailable-id' ? 'That game code is already in use. Please try hosting again.' : ty === 'peer-unavailable' ? 'Couldn’t find that game. Check the code, and make sure your friend is still hosting.' : /network|server-error|socket-error|socket-closed/.test(ty || '') ? 'Couldn’t reach the matchmaking service. Check your internet connection and try again.' : 'Couldn’t connect (' + (ty || 'unknown error') + '). Please try again.'); });
    if (role === 'host') { peer.on('open', () => { if (!done) { done = true; resolve(api); } }); peer.on('connection', c => hook(c)); }
    else peer.on('open', () => {
      const c = peer.connect(id, {reliable: true}); hook(c); const to = setTimeout(() => fail('Couldn’t reach the host. Check the code, and make sure your friend is still hosting.'), 15000);
      c.on('open', () => { clearTimeout(to); if (!done) { done = true; resolve(api); } });
    });
    setTimeout(() => fail('Couldn’t reach the matchmaking service. Check your internet connection and try again.'), 20000);
  });
}
function onlLocal(code) {   // two tabs of one browser (automated tests)
  const bc = new BroadcastChannel('db-' + code), me = Math.random().toString(36).slice(2), peers = {}, mine = {}; let pfn = null, wfn = null, last = null;
  const send = hello => bc.postMessage({t: 'p', from: me, p: mine, hello}), list = () => Object.values(peers);
  bc.onmessage = e => { const m = e.data; if (m.t === 'p') { peers[m.from] = m.p; if (m.hello) { send(false); if (last) bc.postMessage({t: 's', s: last}); } pfn && pfn(list()); } else if (m.t === 's') { wfn && wfn(m.s); } else if (m.t === 'bye') { delete peers[m.from]; pfn && pfn(list()); } };
  setTimeout(() => send(true), 30);
  return {kind: 'local', presence: p => { for (const k in p) { if (p[k] === null) delete mine[k]; else mine[k] = p[k]; } send(false); return Promise.resolve(); }, onPeers: fn => { pfn = fn; fn(list()); },
    write: s => { last = s; bc.postMessage({t: 's', s}); return Promise.resolve(); }, watch: fn => { wfn = fn; }, leave: () => { bc.postMessage({t: 'bye', from: me}); bc.close(); }};
}
async function onlConnect(code, role) {
  if (window.DB_ONL_LOCAL) return onlLocal(code);
  if (window.DB_P2P && window.Peer) return onlP2P(code, role);
  throw new Error('Online play isn’t available in this version of the game.');
}
function onlLeave() { try { ONL.net && ONL.net.leave(); } catch (e) {} ONL = onlFresh(); onlBar(); }

/* ---- lobby ---- */
const onlEd = () => ONL.role === 'guest' ? (ONL.host && ONL.host.ed === 1 ? 1 : 2) : (P.opt.ed2 ? 2 : 1);   // a match uses the HOST's edition
const onlOther = () => ONL.role === 'host' ? ONL.guest : ONL.host;
function onlErr(msg) { $('#sheet').insertAdjacentHTML('afterbegin', `<p class="acerr" role="alert" style="margin:0">${esc(msg)}</p>`); }
function onlMenu(pre) {
  if (!onlAvail()) { toast('Online play isn’t available in this version of the game.'); return; }
  openOv(`<h2>Play a friend online</h2><p style="margin:0">A 1-vs-1 match against a friend, over the internet. Online matches aren’t counted in your stats.</p>
    <div class="olgrid"><div><h3>Host a game</h3><p class="lbl">You get a code to send your friend.</p><button class="btn pri" data-a="olhost">Host a game</button></div>
    <div><h3>Join a game</h3><p class="lbl">Enter the code your friend sent you.</p><div class="row" style="justify-content:center"><input id="olcode" class="olin" maxlength="6" placeholder="code" value="${esc(pre || '')}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Game code"><button class="btn" data-a="oljoin">Join</button></div></div></div>
    <div class="acts"><button class="btn" data-a="close">Close</button></div>`);
}
const onlLink = () => `${location.href.split('#')[0]}#join=${ONL.code}`;
function onlCopy() {
  const text = onlInApp() ? ONL.code.toUpperCase() : onlLink(), what = onlInApp() ? 'Game code' : 'Invite link';
  try { navigator.clipboard.writeText(text).then(() => toast(what + ' copied.'), () => toast('Your game code is ' + ONL.code.toUpperCase() + '.')); } catch (e) { toast('Your game code is ' + ONL.code.toUpperCase() + '.'); }
}
function onlLobby(msg) {
  if (!ONL.on || ONL.started) return;
  const host = ONL.role === 'host', opp = onlOther(), taken = opp && opp.wiz, clash = taken && taken === ONL.wiz, both = ONL.ready && opp && opp.ready && opp.wiz && !clash;
  const slot = (lab, w, ready, here) => `<div class="olslot${ready ? ' rdy' : ''}"><img src="${face(w && here ? w : 'dragon')}" alt="" class="${w && here ? '' : 'dim'}"><div><b>${lab}</b><span>${here ? (w ? esc(WIZ[w].n) : 'Choosing…') : (host ? 'Waiting for your friend…' : 'Connecting to the host…')}</span><span class="olrdy">${here ? (ready ? 'Ready ✓' : 'Not ready') : ''}</span></div></div>`;
  const invite = host ? `<div class="olinvite"><span>Game code: <b class="olbig">${ONL.code.toUpperCase()}</b></span><button class="btn sm" data-a="olcopy">${onlInApp() ? 'Copy code' : 'Copy invite link'}</button>
    <p class="lbl" style="margin:0">${onlInApp() ? 'Tell your friend the code. They choose Play Online, then Join a game.' : 'Send your friend the link: opening it joins this game. Or they can choose Play Online, Join a game and enter the code.'}</p></div>` : '';
  const tiles = `<div class="picks">${WIZ_IDS.map(w => `<button class="pick" data-a="olwiz" data-v="${w}" aria-pressed="${ONL.wiz === w}" ${taken === w && opp.ready ? 'disabled title="Your opponent has this Wizard"' : ''}><img src="${face(w)}" alt=""><div><b>${esc(WIZ[w].s)}</b><span>${esc(WIZ[w].title)}</span></div></button>`).join('')}</div>`;
  const old = $('#sheet'), sc = old.classList.contains('lobby') ? old.scrollTop : 0;
  openOv(`<h2>Online lobby</h2>${msg ? `<p class="acerr" role="alert" style="margin:0">${esc(msg)}</p>` : ''}${invite}
    <p class="lbl" style="margin:0">Rules: ${onlEd() === 2 ? '2nd Edition' : '1st Edition'}${host ? ' (your setting in Options)' : ' (the host’s choice)'}. Who goes first is random.</p>
    <div class="olslots">${slot('You', ONL.wiz, ONL.ready, true)}${slot(host ? 'Opponent' : 'Host', opp && opp.wiz, opp && opp.ready, !!opp)}</div>
    <div class="acts"><button class="btn pri" data-a="olready" ${both || (!ONL.ready && clash && opp.ready) ? 'disabled' : ''}>${ONL.ready ? 'Not ready' : 'Ready'}</button><button class="btn" data-a="olcancel">Leave lobby</button></div>
    ${ONL.ready ? `<p class="lbl" style="margin:0;text-align:center">${both ? 'Both players are ready. Starting…' : 'You’re ready. Waiting for your opponent…'}</p>` : `<h3>Choose your Wizard</h3>${clash ? '<p class="lbl" style="margin:0">Your opponent picked the same Wizard. One of you needs a different one.</p>' : ''}${tiles}`}`, 'lock lobby');
  $('#sheet').scrollTop = sc;
}
function onlPick(w) { if (!ONL.on || ONL.ready || !WIZ[w]) return; ONL.wiz = w; ONL.net.presence({wiz: w}); onlLobby(); }
function onlReady() {
  if (!ONL.on || ONL.started) return; const opp = onlOther();
  if (!ONL.ready && opp && opp.ready && opp.wiz === ONL.wiz) { onlLobby(); return; }   // no mirror matches
  ONL.ready = !ONL.ready; ONL.net.presence({ready: ONL.ready}); onlLobby(); onlMaybeStart();
}
function onlMaybeStart() {
  if (ONL.role !== 'host' || ONL.started || ONL.starting) return;
  const ok = () => { const g = ONL.guest; return ONL.on && ONL.role === 'host' && !ONL.started && ONL.ready && g && g.ready && WIZ[g.wiz] && g.wiz !== ONL.wiz; };
  if (ok()) { ONL.starting = true; setTimeout(() => { ONL.starting = false; if (ok()) onlStart(); }, 900); }
}
async function onlHost() {
  const code = onlCode(); ONL = onlFresh(); Object.assign(ONL, {on: true, role: 'host', code, wiz: P.opt.wiz});
  openOv('<h2>Online lobby</h2><p>Setting up your game…</p>', 'lock');
  try { ONL.net = await onlConnect(code, 'host'); await ONL.net.write({pv: ONL_PV, status: 'lobby'}); }
  catch (e) { onlLeave(); onlMenu(); onlErr(e && e.message || 'Couldn’t create the game. Please try again.'); return; }
  if (!ONL.on || ONL.code !== code) return;   // left while it was connecting
  ONL.net.presence({role: 'host', wiz: ONL.wiz, ready: false, ed: P.opt.ed2 ? 2 : 1, pv: ONL_PV});
  ONL.net.onPeers(ps => {
    const had = !!ONL.guest; ONL.guest = ps.find(x => x.role === 'guest') || null;
    if (!ONL.started) { onlLobby(ONL.guest && ONL.guest.pv !== ONL_PV ? 'Your friend has a different version of Dragon Bridge. Both of you need the latest version.' : ''); onlMaybeStart(); }
    else { onlBar(); if (!had && ONL.guest) onlPush(); onlCheckAns(); }
  });
  onlLobby();
}
async function onlJoin(code) {
  code = String(code || '').trim().toLowerCase(); if (!/^[a-z0-9]{6}$/.test(code)) { toast('Enter the 6-character code.'); return; }
  ONL = onlFresh(); Object.assign(ONL, {on: true, role: 'guest', code, wiz: P.opt.wiz});
  openOv('<h2>Online lobby</h2><p>Connecting…</p>', 'lock');
  try { ONL.net = await onlConnect(code, 'guest'); } catch (e) { onlLeave(); onlMenu(code); onlErr(e && e.message || 'Couldn’t connect. Please try again.'); return; }
  if (!ONL.on || ONL.code !== code) return;
  ONL.net.presence({role: 'guest', wiz: ONL.wiz, ready: false, ans: null, pv: ONL_PV});
  ONL.net.onPeers(ps => { ONL.host = ps.find(x => x.role === 'host') || null; if (!ONL.started) onlLobby(ONL.host && ONL.host.pv !== ONL_PV ? 'Your friend has a different version of Dragon Bridge. Both of you need the latest version.' : ''); else onlBar(); });
  ONL.net.watch(st => onlGuestState(st)); onlLobby();
}
/* The banner at the top while a match is on and the other player has dropped out. */
function onlBar() {
  const b = $('#onlbar'); if (!b) return;
  const lost = ONL.on && ONL.started && M && !M.G.over && !onlOther();
  b.textContent = lost ? 'Your opponent disconnected. Waiting for them to come back…' : ''; b.classList.toggle('show', !!lost);
}

/* ---- host side ---- */
function onlStart() {
  const g = ONL.guest; if (!g || !WIZ[g.wiz]) return;
  ONL.started = true; ONL.pend = null; ONL.doneGid = null;
  startMatch({mode: 'online', online: 'host', wiz: [ONL.wiz, g.wiz], ed: P.opt.ed2 ? 2 : 1});
}
/* What seat `viewer` may see: the other hand shows only the cards they know of; the decks and the shuffle are hidden. */
function onlMask(S, viewer) {
  const s = clone(S), o = 1 - viewer, kn = knownOf(S, o), hide = a => a.map(() => '?');
  s.hand[o] = kn.concat(Array(Math.max(0, S.hand[o].length - kn.length)).fill('?'));
  s.deck = hide(s.deck); s.itemDeck = hide(s.itemDeck); s.hackDeck = hide(s.hackDeck); s.hackDown[o] = hide(s.hackDown[o]); s.seed = 0; delete s.script;
  return s;
}
/* Send the guest the position, and the choice in front of them if it is theirs. */
function onlPush() {
  if (!ONL.on || ONL.role !== 'host' || !ONL.started || !ONL.net || !M || !M.cfg.online) return;
  const G = M.G, S = G.S, q = !G.over && G.req && G.req.p === 1 ? G.req : null;
  if (!q) ONL.pend = null; else if (!ONL.pend || ONL.pend.q !== q) ONL.pend = {id: ++ONL.reqId, q};
  const view = mirrorState(onlMask(S, 1)), logN = view.log.length; view.log = view.log.slice(-60);
  const st = {pv: ONL_PV, status: G.over ? 'over' : 'playing', seq: ++ONL.seq, gid: M.id, view, logN,
    req: q ? Object.assign({}, q, {id: ONL.pend.id, p: 0}, q.who == null ? {} : {who: 1 - q.who}) : null};
  if (G.over && M.rec) st.rec = {snap: M.rec.snap, log0: M.rec.log0, decs: M.rec.decs};   // the finished match, so the guest can keep the replay too
  ONL.net.write(st).catch(() => {});
}
/* The guest's answer arrives in its presence: {id (of the request), v (the option's number)}. */
function onlCheckAns() {
  const R = ONL.pend, a = ONL.guest && ONL.guest.ans;
  if (!R || !a || a.id !== R.id || !M || M.busy || !M.cfg.online || M.G.req !== R.q) return;
  const i = +a.v; ONL.pend = null; if (!Number.isInteger(i) || i < 0 || i >= R.q.opts.length) { onlPush(); return; }
  answer(i);
}

/* ---- guest side ---- */
function onlGuestStart(st) {
  rpStop(); ONL.started = true; ONL.seen = 0; ONL.answered = null; ONL.log = [];
  M = {G: {S: st.view, req: null, over: false, decs: [], snap: null}, cfg: {mode: 'online', online: 'guest', wiz: st.view.wiz.slice(), ed: st.view.ed}, busy: false, fresh: true, id: st.gid};
  resetStage(); $('#ticker').textContent = ''; $('#goal').hidden = true; show('game'); closeOv();
}
function onlGuestState(st) {
  if (!ONL.on || ONL.role !== 'guest' || !st) return;
  if (st.pv !== ONL_PV) { if (!ONL.started) onlLobby('Your friend has a different version of Dragon Bridge. Both of you need the latest version.'); return; }
  if (st.status === 'lobby') { if (ONL.started) { ONL.started = false; ONL.ready = false; ONL.net.presence({ready: false, ans: null}); if (M && M.cfg.online) { M = null; show('title'); } } onlLobby(); return; }
  if (st.gid === ONL.doneGid) return;   // the match we already finished (and left for the lobby)
  if (!ONL.started || !M || M.id !== st.gid) onlGuestStart(st);
  if (st.seq <= ONL.seen) return; ONL.seen = st.seq;
  const G = M.G, n0 = ONL.log.length, tail = st.view.log || [];
  ONL.log = ONL.log.slice(0, Math.max(0, st.logN - tail.length)).concat(tail); st.view.log = ONL.log;
  const fresh = st.logN >= n0 ? ONL.log.slice(n0) : [];
  G.S = st.view; G.over = st.status === 'over'; G.req = !G.over && st.req && st.req.id !== ONL.answered ? st.req : null;
  if (!G.req) { M.sub = null; if ($('#sheet').classList.contains('insight')) closeOv(); }
  playFx(fresh); render(); onlBar();
  if (G.over && !ONL.endShown) { ONL.endShown = true; ONL.rec = st.rec || null; drama(() => onlFinish()); }
}
function onlGuestAnswer(i) {
  const G = M.G, q = G.req; if (!q || !ONL.net) return;
  $('#coach').hidden = true; M.sub = null; M.insAt = null; if ($('#sheet').classList.contains('insight')) closeOv();
  ONL.answered = q.id; ONL.net.presence({ans: {id: q.id, v: i}}); G.req = null; render();
}

/* ---- the end of an online match (both sides) ---- */
function onlFinish() {
  if (!M) return; const S = M.G.S, guest = M.cfg.online === 'guest', M0 = M;
  if (window.TEST_FAST || (S.reason !== 'escape' && S.reason !== 'pounce')) (S.winner === HUMAN ? SFX.win : SFX.lose)();
  // keep the replay: the host recorded it; the guest was sent it (seats as the host saw them, so its point of view is seat 1)
  const rid = guest ? (ONL.rec ? rpSave({rec: ONL.rec, pov: 1, winner: S.winner === 0 || S.winner === 1 ? 1 - S.winner : S.winner}) : null) : rpSave();
  ONL.doneGid = M.id; ONL.endShown = false; ONL.rec = null;
  const dec = S.winner === 0 || S.winner === 1, nW = dec ? WIZ[S.wiz[S.winner]].s : '', nL = dec ? WIZ[S.wiz[1 - S.winner]].s : '';
  const head = !dec ? 'Stalemate' : S.reason === 'escape' ? `${nW} ESCAPES!` : `${nL} was POUNCED!`;
  setTimeout(() => M === M0 && openOv(`<h2>${head}</h2><p style="margin:0">${dec ? `<b>${nW} WINS!</b> ${S.winner === HUMAN ? 'That’s you.' : 'Better luck next time.'}` : 'Nobody got off the bridge.'} <span class="lbl">${S.turn} turns. Online matches aren’t counted in your stats.${rid ? ' This one is saved in Replays.' : ''}</span></p>
    <div class="acts"><button class="btn pri" data-a="olagain" autofocus>Back to the lobby</button><button class="btn" data-a="log">Match log</button><button class="btn" data-a="olcancel">Leave</button></div>`), speed() ? 250 : 140);
}
/* Back to the lobby with the same friend, for another match. */
function onlAgain() {
  if (!ONL.on) return toTitle();
  ONL.started = false; ONL.ready = false; ONL.pend = null; ONL.net.presence({ready: false, ans: null});
  if (ONL.role === 'host') ONL.net.write({pv: ONL_PV, status: 'lobby'}).catch(() => {});
  M = null; closeOv(); show('title'); onlBar(); onlLobby();
}
/* An invite link (…#join=code) opens straight into joining that game. */
function onlBoot() {
  const m = /[#&]join=([a-z0-9]{6})\b/i.exec(location.hash || ''); if (!m || !onlAvail()) return;
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  setTimeout(() => onlJoin(m[1]), 300);
}
