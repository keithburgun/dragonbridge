/* ---------- Replays: every match is recorded and can be watched again ----------
   A replay is the position at the start of the match plus every choice made in it, in order (the rules engine is
   deterministic, so playing those choices again reproduces the match exactly). The last RP_MAX matches are kept on this
   device; one can be exported as a file or a code and imported somewhere else.
   pov: which seat "you" were (1 for the guest of an online match: the replay is then shown with the seats swapped). */
const RP_KEY = 'db_replays', RP_MAX = 30;
function rpList() { try { const L = JSON.parse(store.get(RP_KEY) || '[]'); return Array.isArray(L) ? L : []; } catch (e) { return []; } }
function rpStore(L) { store.set(RP_KEY, JSON.stringify(L.slice(0, RP_MAX))); }
/* Start recording (startMatch): puzzles and the tutorial are not recorded. */
function rpStart(G, cfg) { return cfg.puzzle || cfg.tutorial || cfg.online === 'guest' || !G.snap ? null : {snap: clone(G.snap), log0: clone(G.S.log.slice(0, G.logAt)), decs: []}; }
/* Seats swapped: what the other player sees (shared with online play). Tiles are not mirrored: there is one bridge. */
const SEAT_KEYS = ['hand', 'pos', 'wiz', 'ready', 'gems', 'aside', 'items', 'hackDown', 'white', 'known', 'away', 'gelf', 'gelfR', 'once', 'names', 'script'];
function mirrorState(S0) {
  const s = clone(S0), fl = x => x === 0 || x === 1 ? 1 - x : x;
  for (const k of SEAT_KEYS) if (Array.isArray(s[k]) && s[k].length === 2) s[k].reverse();
  s.cur = fl(s.cur); s.first = fl(s.first); s.winner = fl(s.winner);
  if (s.log) for (const e of s.log) { if (e.by != null) e.by = fl(e.by); if (e.p != null) e.p = fl(e.p); if (e.pw != null) e.pw = fl(e.pw); }
  return s;
}
/* Save the finished match (finish / onlFinish). Returns its id, or null if it was not recorded. */
function rpSave(extra) {
  const rec = M && (extra && extra.rec || M.rec); if (!rec || M.rp || !rec.snap || !Array.isArray(rec.decs)) return null;
  const S = M.G.S, cfg = M.cfg, pov = extra && extra.pov ? 1 : 0;
  const r = Object.assign({v: 1, id: String(M.id) + (pov ? 'g' : ''), at: Date.now(), mode: cfg.mode, level: cfg.level || null, ed: S.ed === 2 ? 2 : 1, pov, oppName: cfg.oppName || null,
    wiz: rec.snap.wiz.slice(), winner: extra && extra.winner != null ? extra.winner : S.winner, reason: S.reason, turns: S.turn, snap: rec.snap, log0: rec.log0 || [], decs: rec.decs.slice()});
  M.rec = null;
  const L = rpList().filter(x => x.id !== r.id); L.unshift(r); rpStore(L);
  return r.id;
}
const rpFind = id => rpList().find(r => r.id === String(id));
function rpDelete(id) { rpStore(rpList().filter(r => r.id !== String(id))); replaysSheet(); }
const rpModeName = r => ({versus: 'Versus', tour: 'Tournament', ranked: 'Ranked', daily: 'Daily Challenge', online: 'Online'})[r.mode] || 'Match';
const rpTitle = r => `${WIZ[r.wiz[r.pov ? 1 : 0]] ? WIZ[r.wiz[r.pov ? 1 : 0]].s : '?'} vs ${WIZ[r.wiz[r.pov ? 0 : 1]] ? WIZ[r.wiz[r.pov ? 0 : 1]].s : '?'}`;
function rpResult(r) {
  const me = r.pov ? 1 : 0;
  if (r.winner !== 0 && r.winner !== 1) return 'Stalemate';
  return (r.winner === me ? 'Won' : 'Lost') + (r.reason === 'escape' ? ' by escape' : r.reason === 'pounce' ? ' by pounce' : r.reason === 'resign' ? ' (resigned)' : r.reason === 'left' ? ' (opponent left)' : '');
}
function replaysSheet() {
  const L = rpList(), d = t => { try { return new Date(t).toLocaleString([], {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'}); } catch (e) { return ''; } };
  const rows = L.map(r => `<div class="rprow"><img src="${face(r.wiz[r.pov ? 1 : 0])}" alt=""><div class="rpinfo"><b>${esc(rpTitle(r))}</b><span class="lbl">${esc(rpModeName(r))}${r.level && LEVEL_NAMES[r.level] ? ' · ' + LEVEL_NAMES[r.level] : ''} · ${esc(rpResult(r))} · ${r.turns} turns · ${esc(d(r.at))}</span></div>
      <span class="seg"><button class="btn sm pri" data-a="rpwatch" data-id="${esc(r.id)}">Watch</button><button class="btn sm" data-a="rpshare" data-id="${esc(r.id)}">Share</button><button class="btn sm" data-a="rpdel" data-id="${esc(r.id)}" aria-label="Delete this replay">Delete</button></span></div>`).join('');
  openOv(`<div class="row"><h2>Replays</h2><button class="btn sm" data-a="rpimport">Import a replay…</button></div>
    <p class="lbl" style="margin:0">Your last ${RP_MAX} matches are kept on this device. Puzzles and the tutorial are not recorded.</p>
    ${rows || '<p class="lbl">No matches recorded yet. Play one and it will show up here.</p>'}
    <div class="acts"><button class="btn" data-a="close">Close</button></div>`);
}
/* ---- export / import ---- */
const RP_TAG = 'DBR1.';
function rpPack(r) { const o = Object.assign({dragonBridgeReplay: 1}, r); return RP_TAG + btoa(unescape(encodeURIComponent(JSON.stringify(o)))); }
function rpUnpack(text) {
  text = String(text || '').trim(); let o = null;
  try { o = text[0] === '{' ? JSON.parse(text) : JSON.parse(decodeURIComponent(escape(atob(text.replace(/^DBR1\./, '').replace(/\s+/g, ''))))); } catch (e) { return null; }
  return rpValid(o) ? o : null;
}
/* Is this really a replay, and does the engine accept it? (Imported files are other people's data.) */
function rpValid(o) {
  try {
    if (!o || typeof o !== 'object' || !o.snap || typeof o.snap !== 'object' || !Array.isArray(o.decs) || o.decs.length > 5000) return false;
    if (!Array.isArray(o.snap.wiz) || o.snap.wiz.length !== 2 || !o.snap.wiz.every(w => WIZ[w]) || !o.decs.every(d => Number.isInteger(d) && d >= 0 && d < 200)) return false;
    if (!Array.isArray(o.snap.hand) || !Array.isArray(o.snap.deck) || checkState(o.snap)) return false;   // every card, Item, Hack and Gem accounted for
    rpRun(o, o.decs.length); return true;
  } catch (e) { return false; }
}
/* Play a replay's first k choices on the real engine. Returns the Game. marks (optional) gets the turn each choice was made in. */
function rpRun(r, k, marks) {
  const S = clone(r.snap); S.log = clone(Array.isArray(r.log0) ? r.log0 : []); const G = new Game(S);
  for (let i = 0; i < k && G.req && !G.over; i++) { if (marks) marks[i] = S.turn; const d = r.decs[i]; G.answer(d < G.req.opts.length ? d : 0); }
  return G;
}
function rpShareSheet(id) {
  const r = rpFind(id); if (!r) return replaysSheet();
  const file = !!window.DB_SYNC && !(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform());   // (Android's WebView cannot save a file from the page, and neither can the version embedded on claude.ai)
  openOv(`<h2>Share this replay</h2><p style="margin:0"><b>${esc(rpTitle(r))}</b> <span class="lbl">${esc(rpResult(r))} · ${r.turns} turns</span></p>
    <p class="lbl" style="margin:0">Send the code${file ? ' or the file' : ''} to a friend. They choose Replays, then Import a replay.</p>
    <textarea class="rpcode" id="rpcode" readonly aria-label="Replay code">${esc(rpPack(r))}</textarea>
    <div class="acts"><button class="btn pri" data-a="rpcopy" data-id="${esc(r.id)}" autofocus>Copy code</button>${file ? `<button class="btn" data-a="rpfile" data-id="${esc(r.id)}">Save as a file</button>` : ''}<button class="btn" data-a="replays">Back</button></div>`);
}
function rpCopy(id) {
  const r = rpFind(id); if (!r) return; const text = rpPack(r), sel = () => { const t = $('#rpcode'); if (t) { t.focus(); t.select(); } toast('Select the code and copy it.'); };
  try { navigator.clipboard.writeText(text).then(() => toast('Replay code copied.'), sel); } catch (e) { sel(); }
}
function rpDownload(id) {
  const r = rpFind(id); if (!r) return;
  /*FILESAVE*/
  try {
    const a = document.createElement('a'), d = new Date(r.at), day = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(Object.assign({dragonBridgeReplay: 1}, r))], {type: 'application/json'}));
    a.download = `dragon-bridge-${day}-${r.wiz[0]}-vs-${r.wiz[1]}.dbreplay.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Replay file saved. If nothing was saved here, use Copy code instead.'); return;
  } catch (e) {}
  /*END FILESAVE*/
  toast('Couldn’t save a file here. Use Copy code instead.');
}
function rpImportSheet(msg) {
  openOv(`<h2>Import a replay</h2>${msg ? `<p class="acerr" role="alert" style="margin:0">${esc(msg)}</p>` : ''}
    <p class="lbl" style="margin:0">Paste a replay code, or choose a replay file.</p>
    <textarea class="rpcode" id="rpcode" placeholder="DBR1…" aria-label="Replay code" autocomplete="off" spellcheck="false"></textarea>
    <label class="btn sm" style="align-self:center;cursor:pointer">Choose a file…<input type="file" id="rpfilein" accept=".json,.txt,application/json,text/plain" hidden></label>
    <div class="acts"><button class="btn pri" data-a="rpimportgo">Import</button><button class="btn" data-a="replays">Back</button></div>`);
}
function rpImportText(text) {
  const o = rpUnpack(text); if (!o) return rpImportSheet('That isn’t a Dragon Bridge replay (or it is damaged).');
  const r = {v: 1, id: 'i' + Date.now(), at: +o.at || Date.now(), mode: String(o.mode || 'versus').slice(0, 12), level: LEVEL_NAMES[o.level] ? o.level : null, ed: o.ed === 1 ? 1 : 2, pov: o.pov ? 1 : 0,
    oppName: o.oppName ? String(o.oppName).slice(0, 40) : null, wiz: o.snap.wiz.slice(), winner: o.winner === 0 || o.winner === 1 ? o.winner : null, reason: String(o.reason || '').slice(0, 12), turns: +o.turns || 0,
    snap: o.snap, log0: Array.isArray(o.log0) ? o.log0.slice(0, 4).map(e => ({m: String(e && e.m || '').slice(0, 200)})) : [], decs: o.decs, imported: 1};
  const L = rpList(); L.unshift(r); rpStore(L); toast('Replay imported.'); rpOpen(r.id);
}
function rpImportFile(f) { if (!f) return; if (f.size > 400000) return rpImportSheet('That file is too large to be a replay.'); const rd = new FileReader(); rd.onload = () => rpImportText(String(rd.result || '')); rd.onerror = () => rpImportSheet('Couldn’t read that file.'); rd.readAsText(f); }

/* ---- watching ---- */
function rpOpen(id) {
  const r = rpFind(id); if (!r) return replaysSheet();
  rpStop(); if (ONL.on) onlLeave();
  const marks = []; let G;
  try { G = rpRun(r, r.decs.length, marks); } catch (e) { toast('This replay can’t be played by this version of the game.'); return; }
  // Does it still end the way it did? (A replay from another version of the rules may not.)
  const fin = G.S, exact = r.reason === 'resign' || r.reason === 'left' ? true : fin.winner === r.winner && fin.reason === r.reason;
  const pov = r.pov ? 1 : 0, online = r.mode === 'online';
  M = {G: null, cfg: {mode: 'replay', wiz: pov ? r.wiz.slice().reverse() : r.wiz.slice(), level: r.level, ed: r.ed, oppName: r.oppName, human: online, oppLabel: online ? 'Online opponent' : r.level && LEVEL_NAMES[r.level] ? 'CPU · ' + LEVEL_NAMES[r.level] : 'CPU', open: false},
    busy: false, fresh: true, id: Date.now(), rp: {r, i: 0, n: r.decs.length, marks, real: null, playing: false, timer: 0, exact, done: false}};
  resetStage(); $('#ticker').textContent = ''; $('#goal').hidden = true; show('game'); closeOv();
  rpSeek(0);
  if (!exact) toast('This replay was recorded with a different version of the game, so it may not play back exactly.');
}
function rpStop() { if (M && M.rp) { clearTimeout(M.rp.timer); M.rp.playing = false; } }
/* Put the engine's state on screen (seats swapped for a guest's replay). */
function rpSync() {
  const rp = M.rp, real = rp.real;
  M.G = {S: rp.r.pov ? mirrorState(real.S) : real.S, req: null, over: real.over, decs: real.decs, snap: null};
}
function rpSeek(k) {
  const rp = M.rp; k = Math.max(0, Math.min(rp.n, k)); clearTimeout(rp.timer); rp.playing = false;
  rp.real = rpRun(rp.r, k); rp.i = k; rp.done = false; M.busy = false; M.fresh = true; resetStage(); M.gemPrev = null; M.gemNew = []; rpSync();
  const L = M.G.S.log.filter(e => !/^—/.test(e.m)); $('#ticker').textContent = L.length ? L[L.length - 1].m : '';
  render();
}
function rpAtEnd() { const rp = M.rp; return rp.i >= rp.n || !rp.real.req || rp.real.over; }
/* One choice forward, with the usual sounds and animations. Returns how long to let it show (ms at Normal speed). */
function rpFwd() {
  const rp = M.rp, real = rp.real; if (rpAtEnd() || M.busy) return 0;
  const n0 = real.S.log.length, d = rp.r.decs[rp.i]; real.answer(d < real.req.opts.length ? d : 0); rp.i++; rpSync();
  const wait = Math.max(650, playFx(M.G.S.log.slice(n0)));
  render();
  if (rpAtEnd()) rpFinish();
  return wait;
}
function rpFinish() {
  const rp = M.rp, r = rp.r, S = M.G.S; clearTimeout(rp.timer); rp.playing = false; if (rp.done) return; rp.done = true;
  const tail = () => { if (!M || M.rp !== rp) return; M.busy = false; $('#ticker').textContent = S.winner === 0 || S.winner === 1 ? `${nm(S, S.winner)} wins. End of the replay.` : r.reason === 'resign' ? `${nm(S, r.pov ? 1 : 0)} resigned here. End of the replay.` : r.reason === 'left' ? 'A player left here. End of the replay.' : 'End of the replay.'; render(); };
  if (M.G.over) drama(tail); else tail();
}
function rpPlay() {
  const rp = M.rp; if (rpAtEnd()) return rpSeek(0);
  rp.playing = true; render();
  const tick = () => { if (!M || M.rp !== rp || !rp.playing) return; if (M.busy) { rp.timer = setTimeout(tick, 200); return; } const w = rpFwd(); if (rp.playing && !rpAtEnd()) rp.timer = setTimeout(tick, w * Math.max(0.5, speed())); else { rp.playing = false; if (M && M.rp === rp && !M.busy) render(); } };
  tick();
}
function rpTurnEdge(dir) {   // the choice index where the next / previous turn begins
  const rp = M.rp, m = rp.marks, i = rp.i;
  if (dir > 0) { const t = i < rp.n ? m[i] : null; let j = i; while (j < rp.n && m[j] === t) j++; return j; }
  let j = Math.min(i, rp.n) - 1; if (j < 0) return 0; const t = m[j]; while (j > 0 && m[j - 1] === t) j--;
  if (j === i && j > 0) { const t2 = m[j - 1]; j--; while (j > 0 && m[j - 1] === t2) j--; }
  return j;
}
function rpCmd(v) {
  if (!M || !M.rp || M.busy) return; const rp = M.rp;
  if (v === 'play') return rp.playing ? (rpStop(), render()) : rpPlay();
  rpStop();
  if (v === 'next') { rpFwd(); }
  else if (v === 'prev') rpSeek(rp.i - 1);
  else if (v === 'start') rpSeek(0);
  else if (v === 'tnext') { const j = rpTurnEdge(1); if (j - rp.i <= 1) rpFwd(); else { rpSeek(j); if (rpAtEnd()) rpFinish(); } }
  else if (v === 'tprev') rpSeek(rpTurnEdge(-1));
  else if (v === 'hands') { M.cfg.open = !M.cfg.open; render(); }
  else if (v === 'exit') { toTitle(); replaysSheet(); }
}
function rpBar(qe, oe) {
  const rp = M.rp, S = M.G.S, end = rpAtEnd();
  qe.className = 'q'; qe.textContent = `Replay · Turn ${S.turn || 1} · step ${rp.i} of ${rp.n}` + (end ? ' · finished' : '');
  // (while it plays, only the slider's position is refreshed, so a focused button keeps its place)
  const sig = [rp.playing, end, rp.i === 0, M.cfg.open, rp.n].join();
  if (oe.dataset.rp === sig && oe.querySelector('#rpseek')) { const sl = oe.querySelector('#rpseek'); if (document.activeElement !== sl) sl.value = rp.i; return; }
  oe.dataset.rp = sig;
  oe.innerHTML = `<div class="rpbar">
    <button class="btn sm" data-a="rpgo" data-v="start" ${rp.i ? '' : 'disabled'} aria-label="Back to the start">⏮</button>
    <button class="btn sm" data-a="rpgo" data-v="tprev" ${rp.i ? '' : 'disabled'}>◀ Turn</button>
    <button class="btn sm" data-a="rpgo" data-v="prev" ${rp.i ? '' : 'disabled'} aria-label="One step back">◀</button>
    <button class="btn sm pri" data-a="rpgo" data-v="play">${rp.playing ? 'Pause' : end ? 'Watch again' : 'Play'}</button>
    <button class="btn sm" data-a="rpgo" data-v="next" ${end ? 'disabled' : ''} aria-label="One step forward">▶</button>
    <button class="btn sm" data-a="rpgo" data-v="tnext" ${end ? 'disabled' : ''}>Turn ▶</button>
    <input type="range" id="rpseek" min="0" max="${rp.n}" step="1" value="${rp.i}" aria-label="Position in the replay">
    <button class="btn sm" data-a="rpgo" data-v="hands" aria-pressed="${!!M.cfg.open}">${M.cfg.open ? 'Hide their hand' : 'Show their hand'}</button>
    <button class="btn sm" data-a="rpgo" data-v="exit">Exit</button></div>`;
}
