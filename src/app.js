import { APP_NAME, DRINK_SECTION, FOOD_SECTION } from './config.js';
import { createSync } from './sync.js';
import * as U from './usage.js';
import { DRINKS, CATS, drinkInfo, drinkTitle, dayKey, monthKey, activeTrip, drinkBoards, biteStats, biteBoards, awards, tripDays, isFinalNight } from './logic.js';
const VERSION = '__VERSION__';
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p) => p + '-' + crypto.randomUUID().slice(0, 12);
const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const fmtDate = (k) => new Date(k + 'T12:00').toLocaleDateString([], { month: 'short', day: 'numeric' });
const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtDate(dayKey(t)); };
const LS = { code: 'sb-code', me: 'sb-me', theme: 'sb-theme' };

// ---------- errors: calm banner + ring buffer (no PII) ----------
const errLog = [];
function showErr(e) { const m = String((e && (e.message || e)) || 'error').slice(0, 200); errLog.push({ t: Date.now(), m }); errLog.splice(0, errLog.length - 20); U.error(m); const b = $('#err'); if (b) b.hidden = false; }
addEventListener('error', (e) => showErr(e.error || e.message));
addEventListener('unhandledrejection', (e) => showErr(e.reason));

const S = { tab: 'home', me: localStorage.getItem(LS.me) || '', who: null, scope: 'all', status: { connected: 0, total: 0, pending: 0 }, viewTrip: null, persisted: null };
let db = null, code = null;

// ---------- data helpers ----------
const all = (t) => (db ? db.all().filter((r) => r.t === t) : []);
const people = () => all('person').sort((a, b) => a.name.localeCompare(b.name));
const peopleMap = () => Object.fromEntries(people().map((p) => [p.id, p]));
const nameOf = (id) => (peopleMap()[id] || {}).name || 'Someone';
const trips = () => all('trip');
const drinkKinds = () => [...DRINKS, ...all('dkind').sort((a, b) => a.ca - b.ca).map((d) => ({ k: d.id, label: d.label, icon: '🥂', title: `${d.label} Legend` }))];
const kindInfo = (k) => drinkKinds().find((d) => d.k === k) || drinkInfo(k);
const kindTitle = (k, person) => (DRINKS.some((d) => d.k === k) ? drinkTitle(k, person) : kindInfo(k).title);

async function put(rec) { const r = await db.put(rec); U.track('put:' + rec.t); protectStorage(); return r; }

// ---------- toast with Undo ----------
let toastT;
function toast(msg, undo) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>` + (undo ? '<button type="button" id="undo">Undo</button>' : '');
  if (undo) $('#undo').onclick = async () => { await undo(); U.track('undo'); el.classList.remove('show'); render(); };
  el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 6000);
}

// ---------- sheet (native dialog) ----------
function sheet(title, html, onSubmit) {
  const d = $('#sheet');
  d.innerHTML = `<form method="dialog" class="sheetform"><div class="sheethead"><h2 id="sheet-h">${esc(title)}</h2><button type="button" class="btn" data-close>Close</button></div>${html}</form>`;
  d.setAttribute('aria-labelledby', 'sheet-h');
  $('[data-close]', d).onclick = () => d.close();
  $('form', d).onsubmit = async (e) => { e.preventDefault(); const ok = await onSubmit?.(new FormData(e.target), e.submitter); if (ok !== false) d.close(); render(); };
  if (!d.open) d.showModal();
  const f = $('input:not([type=hidden]), button[type=submit]', d); if (f && f.tagName === 'INPUT') f.focus();
}
const closeSheet = () => { const d = $('#sheet'); if (d.open) d.close(); };

// ---------- who am I (device-only) ----------
function whoSheet(first) {
  const ps = people();
  sheet(first ? `Welcome to ${APP_NAME}! Who are you?` : 'Who are you on this phone?', `
    ${ps.length ? `<div class="chips">${ps.map((p) => `<button type="button" class="chip big" data-pick="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div><p class="small">Not listed? Add yourself:</p>` : '<p class="small">Add your first name. Everyone in the family adds their own.</p>'}
    <label for="mein">Your name</label><input id="mein" name="name" maxlength="30" autocomplete="given-name" class="bigin">
    <button class="btn primary wide" type="submit">Add me</button>`, async (fd) => {
    const name = String(fd.get('name') || '').trim(); if (!name) { $('#mein').focus(); return false; }
    const existing = people().find((p) => p.name.toLowerCase() === name.toLowerCase());
    const p = existing || (await put({ id: uid('p'), t: 'person', name }));
    setMe(p.id);
  });
  for (const b of document.querySelectorAll('[data-pick]')) b.onclick = () => { setMe(b.dataset.pick); closeSheet(); render(); };
}
function setMe(id) { S.me = id; S.who = id; localStorage.setItem(LS.me, id); }

// ---------- render ----------
const TABS = [['home', '🏠', 'Home'], ['bites', '🍽️', 'Bites'], ['boards', '🏆', 'Boards'], ['trips', '🏖️', 'Trips'], ['more', '⚙️', 'More']];
function syncPill() {
  const s = S.status;
  if (!navigator.onLine || !s.connected) return `<span class="pill" id="syncpill">● Saved on this phone${s.pending ? ` · ${s.pending} to share` : ''}</span>`;
  return `<span class="pill ok" id="syncpill">● ${s.pending ? 'Sharing…' : 'Shared with family'}</span>`;
}
function render() {
  if (!db) return;
  const keep = document.activeElement && document.activeElement.id; const y = scrollY;
  for (const b of document.querySelectorAll('#nav [data-tab]')) { const on = b.dataset.tab === S.tab; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); }
  const view = { home: viewHome, bites: viewBites, boards: viewBoards, trips: viewTrips, more: viewMore }[S.tab]();
  $('#main').innerHTML = `<div class="top"><h1>${S.tab === 'home' ? esc(APP_NAME) : TABS.find((t) => t[0] === S.tab)[2]}</h1>${syncPill()}</div>${view}`;
  if (keep && document.getElementById(keep)) document.getElementById(keep).focus({ preventScroll: true });
  scrollTo(0, y);
}
function tripBanner() {
  const t = activeTrip(trips()); if (!t) return '';
  const days = tripDays(t), i = days.indexOf(dayKey(Date.now())) + 1;
  return `<div class="banner trip"><div><b>🏖️ ${esc(t.name)}</b><div class="small">Day ${i} of ${days.length} · logs count toward the trip</div></div>${isFinalNight(t) ? `<button class="btn primary" data-act="wrap" data-id="${esc(t.id)}">Final-night wrap-up</button>` : `<button class="btn" data-act="opentrip" data-id="${esc(t.id)}">Trip boards</button>`}</div>`;
}
function viewHome() {
  const ps = people(); if (!S.who || !peopleMap()[S.who]) S.who = S.me;
  const today = dayKey(Date.now());
  const myToday = all('drink').filter((d) => d.who === S.who && dayKey(d.at) === today);
  const cnt = (k) => myToday.filter((d) => d.kind === k).length;
  const whoRow = ps.length > 1 ? `<div class="chips" role="radiogroup" aria-label="Who is drinking">${ps.map((p) => `<button class="chip ${p.id === S.who ? 'sel' : ''}" role="radio" aria-checked="${p.id === S.who}" data-act="who" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')}</div>` : '';
  const grid = `<div class="qgrid">${drinkKinds().map((d) => `<button class="qbtn" data-act="drink" data-k="${esc(d.k)}"><span aria-hidden="true" class="qi">${d.icon}</span>${esc(d.label)}<span class="cnt">${cnt(d.k) ? `${cnt(d.k)} today` : '&nbsp;'}</span></button>`).join('')}<button class="qbtn ghost" data-act="customdrink"><span aria-hidden="true" class="qi">➕</span>Other drink</button></div>`;
  // Glance
  const todayDrinks = all('drink').filter((d) => dayKey(d.at) === today);
  const perP = {}; for (const d of todayDrinks) perP[d.who] = (perP[d.who] || 0) + 1;
  const mb = biteBoards(all('bite'), all('rating'), { kind: 'month', key: monthKey(Date.now()) });
  const mdb = drinkBoards(all('drink'), { kind: 'month', key: monthKey(Date.now()) });
  const feed = [...all('drink').map((d) => ({ at: d.at, html: `${kindInfo(d.kind).icon} <b>${esc(nameOf(d.who))}</b> had a ${esc(kindInfo(d.kind).label.toLowerCase())}` })),
    ...all('bite').map((b) => ({ at: b.at, html: `${(CATS.find((c) => c.k === b.cat) || CATS[0]).icon} <b>${esc(nameOf(b.by))}</b> added ${esc(b.name)}` })),
    ...all('rating').map((r) => ({ at: r.at, html: `⭐ <b>${esc(nameOf(r.who))}</b> gave ${esc((db.get(r.bite) || {}).name || 'a bite')} ${r.score}/10${r.note ? ` · “${esc(r.note)}”` : ''}` }))]
    .filter((x) => x.at).sort((a, b) => b.at - a.at).slice(0, 8);
  return `${tripBanner()}
  <section aria-labelledby="cc-h"><h2 id="cc-h">🥤 ${esc(DRINK_SECTION)}</h2>${whoRow}<p class="small">Tap a drink to log it for <b>${esc(nameOf(S.who))}</b>.</p>${grid}</section>
  <section aria-labelledby="gl-h"><h2 id="gl-h">At a glance</h2>
   <div class="cards">
    <div class="card"><div class="small">Drinks today</div><div class="big">${todayDrinks.length}</div><div class="small">${Object.entries(perP).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${esc(nameOf(w))} ${n}`).join(' · ') || 'None yet'}</div></div>
    <div class="card"><div class="small">This month’s top bite</div><div class="big2">${mb.top[0] ? esc(mb.top[0].name) : '—'}</div><div class="small">${mb.top[0] ? `${mb.top[0].avg.toFixed(1)} / 10` : 'Rate something!'}</div></div>
    <div class="card"><div class="small">Chug Champion this month</div><div class="big2">${mdb.overall[0] ? esc(nameOf(mdb.overall[0].who)) : '—'}</div><div class="small">${mdb.overall[0] ? `${mdb.overall[0].n} drinks` : 'Log a drink!'}</div></div>
   </div>
   ${feed.length ? `<ul class="list feed">${feed.map((f) => `<li><span>${f.html}</span><span class="small">${ago(f.at)}</span></li>`).join('')}</ul>` : '<p class="empty">Nothing yet. Tap a drink above or add a bite.</p>'}
  </section>`;
}
function stars(avg) { return avg == null ? '<span class="small">No ratings yet</span>' : `<b class="score">${avg.toFixed(1)}</b><span class="small"> / 10</span>`; }
function viewBites() {
  const stats = biteStats(all('bite'), all('rating')).sort((a, b) => b.at - a.at);
  return `<p class="small">${esc(FOOD_SECTION)}: add a meal, snack, or restaurant dish. Everyone rates it 1–10.</p>
   <button class="btn primary wide big" data-act="addbite">➕ Add a bite</button>
   ${stats.length ? `<ul class="list bites">${stats.map((b) => { const mine = b.ratings.find((r) => r.who === S.me); return `<li class="bite"><div><b>${(CATS.find((c) => c.k === b.cat) || CATS[0]).icon} ${esc(b.name)}</b><div class="small">${esc(nameOf(b.by))} · ${fmtDate(dayKey(b.at))} · ${b.n} rating${b.n === 1 ? '' : 's'}${mine ? ` · you: ${mine.score}` : ''}</div>${b.ratings.filter((r) => r.note).slice(0, 2).map((r) => `<div class="small quote">“${esc(r.note)}” – ${esc(nameOf(r.who))}</div>`).join('')}</div><div class="rcol">${stars(b.avg)}<button class="btn ${mine ? '' : 'primary'}" data-act="rate" data-id="${esc(b.id)}" aria-label="${mine ? 'Change rating for' : 'Rate'} ${esc(b.name)}">${mine ? 'Change' : 'Rate'}</button></div></li>`; }).join('')}</ul>` : '<p class="empty">No bites yet. Add the first one!</p>'}`;
}
function boardsHTML(scope, { daily } = {}) {
  const pm = peopleMap(), nm = (id) => esc(nameOf(id));
  const dbd = drinkBoards(all('drink'), scope), bb = biteBoards(all('bite'), all('rating'), scope);
  const rows = (arr, f) => `<ol class="rank">${arr.slice(0, 5).map((r, i) => `<li><span>${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${f(r)}</span></li>`).join('')}</ol>`;
  const drinkSec = dbd.total ? `<div class="cards">${Object.entries(dbd.byKind).map(([k, rs]) => `<div class="card board"><div class="small">${kindInfo(k).icon} ${esc(kindTitle(k, pm[rs[0].who]))}</div><div class="big2">${nm(rs[0].who)}</div>${rows(rs, (r) => `${nm(r.who)} · ${r.n}`)}</div>`).join('')}</div>` : '<p class="empty">No drinks logged here yet.</p>';
  const biteSec = bb.count ? `<div class="cards">
    <div class="card board"><div class="small">🥇 Top bites</div>${bb.top.length ? rows(bb.top, (b) => `${esc(b.name)} · ${b.avg.toFixed(1)}`) : '<p class="small">Nothing rated yet</p>'}</div>
    <div class="card board"><div class="small">🙈 Bottom bites</div>${bb.bottom.length ? rows(bb.bottom, (b) => `${esc(b.name)} · ${b.avg.toFixed(1)}`) : '<p class="small">Needs 2+ rated bites</p>'}</div>
    <div class="card board"><div class="small">🍿 Snack Champ</div><div class="big2">${bb.snackChamp ? nm(bb.snackChamp.who) : '—'}</div><div class="small">${bb.snackChamp ? `${bb.snackChamp.n} snacks added` : 'Add a snack'}</div></div>
    <div class="card board"><div class="small">😇 Most Generous Critic</div><div class="big2">${bb.generous ? nm(bb.generous.who) : '—'}</div><div class="small">${bb.generous ? `avg ${bb.generous.avg.toFixed(1)} over ${bb.generous.n}` : 'Needs 2+ ratings'}</div></div>
    <div class="card board"><div class="small">🧐 Harshest Critic</div><div class="big2">${bb.harsh ? nm(bb.harsh.who) : '—'}</div><div class="small">${bb.harsh ? `avg ${bb.harsh.avg.toFixed(1)} over ${bb.harsh.n}` : 'Needs 2 critics'}</div></div></div>` : '<p class="empty">No bites here yet.</p>';
  return `<h2>${daily ? 'Today’s' : ''} 🥤 ${esc(DRINK_SECTION)} boards</h2>${drinkSec}<h2>${daily ? 'Today’s' : ''} 🍽️ ${esc(FOOD_SECTION)} boards</h2>${biteSec}`;
}
function viewBoards() {
  const t = activeTrip(trips());
  const opts = [['all', 'All-time'], ['month', 'This month'], ...(t ? [['trip', 'This trip']] : [])];
  if (!opts.some((o) => o[0] === S.scope)) S.scope = 'all';
  const scope = S.scope === 'month' ? { kind: 'month', key: monthKey(Date.now()) } : S.scope === 'trip' ? { kind: 'trip', id: t.id } : { kind: 'all' };
  return `<div class="chips seg" role="radiogroup" aria-label="Board period">${opts.map(([k, l]) => `<button class="chip ${S.scope === k ? 'sel' : ''}" role="radio" aria-checked="${S.scope === k}" data-act="scope" data-k="${k}">${l}</button>`).join('')}</div>${boardsHTML(scope)}`;
}
function awardsHTML(t, scope) {
  const aw = awards(all('drink'), all('bite'), all('rating'), scope || { kind: 'trip', id: t.id }, peopleMap());
  return aw.length ? `<ul class="list awards">${aw.map((a) => `<li><span><span aria-hidden="true">${a.icon}</span> <b>${esc(a.title)}</b>: ${esc(a.who)}</span><span class="small">${esc(a.detail)}</span></li>`).join('')}</ul>` : '<p class="empty">No awards yet. Log drinks and rate bites to earn them.</p>';
}
function tripView(t) {
  const days = tripDays(t), today = dayKey(Date.now());
  const perDay = days.map((d) => ({ d, n: all('drink').filter((x) => x.trip === t.id && dayKey(x.at) === d).length + all('bite').filter((x) => x.trip === t.id && dayKey(x.at) === d).length }));
  return `<div class="tripview"><button class="btn" data-act="closetrip">← All trips</button>
   <h2>🏖️ ${esc(t.name)}</h2><p class="small">${fmtDate(t.start)} – ${fmtDate(t.end)}${t.archived ? ' · in the catalog' : ''}</p>
   ${!t.archived ? `<div class="row2"><button class="btn primary" data-act="wrap" data-id="${esc(t.id)}">Final-night wrap-up</button><button class="btn" data-act="archive" data-id="${esc(t.id)}">Archive trip</button></div>` : ''}
   <h2>🏅 Trip awards</h2>${awardsHTML(t)}
   ${!t.archived && days.includes(today) ? boardsHTML({ kind: 'day', key: today, trip: t.id }, { daily: true }) : ''}
   <h2>Day by day</h2><ul class="list">${perDay.map((x) => `<li><span>${fmtDate(x.d)}</span><span class="small">${x.n} logs</span></li>`).join('')}</ul>
   <h2>Whole-trip boards</h2>${boardsHTML({ kind: 'trip', id: t.id })}</div>`;
}
function viewTrips() {
  if (S.viewTrip) { const t = db.get(S.viewTrip); if (t) return tripView(t); S.viewTrip = null; }
  const ts = trips(), open = ts.filter((t) => !t.archived).sort((a, b) => a.start.localeCompare(b.start)), arch = ts.filter((t) => t.archived).sort((a, b) => b.start.localeCompare(a.start));
  const card = (t) => `<li><span><b>${esc(t.name)}</b><span class="small"> · ${fmtDate(t.start)} – ${fmtDate(t.end)}</span></span><button class="btn" data-act="opentrip" data-id="${esc(t.id)}" aria-label="Open ${esc(t.name)}">Open</button></li>`;
  return `<p class="small">Trip Mode: while a trip’s dates are on, every drink and bite counts toward it.</p>
   <button class="btn primary wide big" data-act="newtrip">➕ Start a trip</button>
   <h2>Current and upcoming</h2>${open.length ? `<ul class="list">${open.map(card).join('')}</ul>` : '<p class="empty">No trips planned.</p>'}
   <h2>📚 Trip Catalog</h2>${arch.length ? `<ul class="list catalog">${arch.map(card).join('')}</ul>` : '<p class="empty">Archived trips land here after the wrap-up.</p>'}`;
}
function viewMore() {
  const ps = people(), th = localStorage.getItem(LS.theme) || 'auto';
  return `<h2>Family</h2><ul class="list">${ps.map((p) => `<li><span>${esc(p.name)}${p.id === S.me ? ' <span class="small">(this phone)</span>' : ''}</span><button class="btn" data-act="crown" data-id="${esc(p.id)}" aria-label="Diet Coke title for ${esc(p.name)}">👑 ${esc(p.crown || 'Royalty')}</button></li>`).join('')}</ul>
   <div class="row2"><button class="btn" data-act="addperson">➕ Add a person</button><button class="btn" data-act="switchme">Switch who I am</button></div>
   <h2>Share</h2><p class="small">Send the private family link only to adults in the family. Anyone with it can see and add.</p><button class="btn wide" data-act="copylink">Copy family link</button>
   <h2>Look</h2><div class="chips seg" role="radiogroup" aria-label="Theme">${[['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(([k, l]) => `<button class="chip ${th === k ? 'sel' : ''}" role="radio" aria-checked="${th === k}" data-act="theme" data-k="${k}">${l}</button>`).join('')}</div>
   <h2>Help improve the app</h2><p class="small">Counts taps and screens only (never what you ate or wrote), stored encrypted in the family space.</p>
   <button class="chip big ${U.usageOn() ? 'sel' : ''}" role="switch" aria-checked="${U.usageOn()}" data-act="usage" id="usage-sw">${U.usageOn() ? '✓ On' : '○ Off'} · usage totals</button>
   <h2>Backup</h2><div class="row2"><button class="btn" data-act="export">Export backup</button><label class="btn" for="import">Restore backup</label></div><input id="import" type="file" accept="application/json" class="sr-only" tabindex="-1">
   <h2>Diagnostics</h2><p class="small">Version <span id="ver">${esc(VERSION)}</span> · Storage: <span id="stor">${S.persisted ? 'protected' : 'not protected'}</span> · Errors: ${errLog.length}</p>`;
}

// ---------- actions ----------
async function logDrink(k) {
  const t0 = performance.now();
  const t = activeTrip(trips());
  const r = await put({ id: uid('d'), t: 'drink', who: S.who || S.me, kind: k, at: Date.now(), by: S.me, ...(t ? { trip: t.id } : {}) });
  U.timing('log_drink', performance.now() - t0);
  render(); toast(`${kindInfo(k).icon} ${kindInfo(k).label} for ${nameOf(r.who)}`, () => db.remove(r.id));
}
function rateSheet(id) {
  const b = db.get(id); if (!b) return;
  const mine = all('rating').find((r) => r.bite === id && r.who === S.me);
  sheet(`Rate ${b.name}`, `<label for="notein">One-liner (optional)</label><input id="notein" name="note" maxlength="80" value="${esc(mine?.note || '')}" placeholder="e.g. Crunchy, needs salt">
   <p class="small">Tap a score to save:</p><div class="scores">${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => `<button type="submit" class="score-btn ${mine?.score === n ? 'sel' : ''}" name="score" value="${n}">${n}</button>`).join('')}</div>`, async (fd, sub) => {
    const score = Number(sub?.value || fd.get('score')); if (!(score >= 1 && score <= 10)) return false;
    const prev = mine ? { ...mine } : null;
    const r = await put({ id: `rt-${id}-${S.me}`, t: 'rating', bite: id, who: S.me, score, note: String(fd.get('note') || '').trim().slice(0, 80), at: Date.now() });
    toast(`Rated ${b.name} ${score}/10`, () => (prev ? put(prev) : db.remove(r.id)));
  });
}
const handlers = {
  drink: (b) => logDrink(b.dataset.k),
  who: (b) => { S.who = b.dataset.id; render(); },
  customdrink: () => sheet('Other drink', `<label for="dkin">Drink name</label><input id="dkin" name="label" maxlength="24" placeholder="e.g. Sweet tea"><button class="btn primary wide" type="submit">Add and log it</button>`, async (fd) => {
    const label = String(fd.get('label') || '').trim(); if (!label) return false;
    const ex = drinkKinds().find((d) => d.label.toLowerCase() === label.toLowerCase());
    const k = ex ? ex.k : (await put({ id: uid('dk'), t: 'dkind', label })).id;
    closeSheet(); await logDrink(k);
  }),
  addbite: () => sheet('Add a bite', `<label for="bitein">What is it?</label><input id="bitein" name="name" maxlength="60" placeholder="e.g. Shrimp tacos at the pier">
    <fieldset class="chips"><legend class="small">Kind</legend>${CATS.map((c, i) => `<label class="chip big"><input type="radio" name="cat" value="${c.k}" ${i === 0 ? 'checked' : ''}> ${c.icon} ${c.label}</label>`).join('')}</fieldset>
    <button class="btn primary wide" type="submit">Add, then rate it</button>`, async (fd) => {
    const name = String(fd.get('name') || '').trim(); if (!name) return false;
    const t = activeTrip(trips());
    const b = await put({ id: uid('b'), t: 'bite', name, cat: fd.get('cat') || 'meal', by: S.me, at: Date.now(), ...(t ? { trip: t.id } : {}) });
    closeSheet(); render(); toast(`Added ${name}`, () => db.remove(b.id)); rateSheet(b.id); return false;
  }),
  rate: (b) => rateSheet(b.dataset.id),
  scope: (b) => { S.scope = b.dataset.k; render(); },
  newtrip: () => { const d = dayKey(Date.now()); sheet('Start a trip', `<label for="tripname">Trip name</label><input id="tripname" name="name" maxlength="40" placeholder="e.g. Beach week 2027">
    <label for="tripstart">First day</label><input id="tripstart" name="start" type="date" value="${d}"><label for="tripend">Last day</label><input id="tripend" name="end" type="date" value="${d}">
    <button class="btn primary wide" type="submit">Start trip</button>`, async (fd) => {
    const name = String(fd.get('name') || '').trim(), start = fd.get('start'), end = fd.get('end');
    if (!name || !start || !end || end < start) { toast('Add a name and make the last day on or after the first.'); return false; }
    const t = await put({ id: uid('t'), t: 'trip', name, start, end, archived: false, by: S.me });
    S.viewTrip = t.id; toast(`Trip “${name}” is set`, () => db.remove(t.id));
  }); },
  opentrip: (b) => { S.tab = 'trips'; S.viewTrip = b.dataset.id; U.track('screen:trip'); render(); },
  closetrip: () => { S.viewTrip = null; render(); },
  wrap: (b) => { const t = db.get(b.dataset.id); if (!t) return; U.track('wrapup'); sheet(`🌅 ${t.name}: final-night wrap-up`, `<p class="small">${fmtDate(t.start)} – ${fmtDate(t.end)} · ${all('drink').filter((d) => d.trip === t.id).length} drinks · ${all('bite').filter((x) => x.trip === t.id).length} bites</p>${awardsHTML(t)}
    ${t.archived ? '' : '<p class="small">When the trip is done, save it to the Trip Catalog.</p><button class="btn primary wide" type="submit">Archive to the Trip Catalog</button>'}`, async () => { await archive(t.id); }); },
  archive: (b) => archive(b.dataset.id),
  crown: async (b) => { const p = db.get(b.dataset.id); const next = { Royalty: 'Queen', Queen: 'King', King: 'Royalty' }[p.crown || 'Royalty']; await put({ ...p, crown: next }); render(); },
  addperson: () => sheet('Add a person', `<label for="pin">Name</label><input id="pin" name="name" maxlength="30"><button class="btn primary wide" type="submit">Add</button>`, async (fd) => {
    const name = String(fd.get('name') || '').trim(); if (!name) return false; if (!people().some((p) => p.name.toLowerCase() === name.toLowerCase())) await put({ id: uid('p'), t: 'person', name }); }),
  switchme: () => whoSheet(false),
  copylink: async () => { try { await navigator.clipboard.writeText(location.origin + location.pathname + '#k=' + code); toast('Family link copied'); } catch { toast('Couldn’t copy. Copy the address from the browser bar instead.'); } },
  theme: (b) => { localStorage.setItem(LS.theme, b.dataset.k); applyTheme(); render(); },
  usage: () => { U.setUsage(!U.usageOn()); render(); },
  export: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([db.exportJSON()], { type: 'application/json' })); a.download = `taste-test-backup-${dayKey(Date.now())}.json`; a.click(); U.track('export'); },
};
async function archive(id) {
  const t = db.get(id); if (!t) return;
  await put({ ...t, archived: true }); S.viewTrip = null; S.tab = 'trips'; render();
  toast(`${t.name} saved to the Trip Catalog`, () => put({ ...db.get(id), archived: false }));
}
function applyTheme() { const t = localStorage.getItem(LS.theme) || 'auto'; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t; }
async function protectStorage() { try { if (navigator.storage?.persist) { S.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } } catch {} }

// ---------- boot ----------
function newCode() { const b = crypto.getRandomValues(new Uint8Array(24)); return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function readCode() { const m = location.hash.match(/k=([A-Za-z0-9_-]{20,})/); if (m) { localStorage.setItem(LS.code, m[1]); return m[1]; } return localStorage.getItem(LS.code); }
function landing() {
  $('#nav').hidden = true;
  $('#main').innerHTML = `<div class="landing"><h1>${esc(APP_NAME)}</h1><p>${esc(DRINK_SECTION)} + ${esc(FOOD_SECTION)}: the family’s private drink and food scoreboard. Open the family link you were sent, or paste it here.</p>
   <form id="pasteform"><label for="pastein">Family link</label><input id="pastein" class="bigin" autocomplete="off"><button class="btn primary wide" type="submit">Open</button></form>
   <details><summary>Start a brand-new family space</summary><p class="small">Only if nobody sent you a link.</p><button class="btn wide" id="newspace">Create new space</button></details></div>`;
  $('#pasteform').onsubmit = (e) => { e.preventDefault(); const m = $('#pastein').value.match(/k=([A-Za-z0-9_-]{20,})/); if (m) { location.hash = 'k=' + m[1]; location.reload(); } else toast('That doesn’t look like a family link.'); };
  $('#newspace').onclick = () => { location.hash = 'k=' + newCode(); location.reload(); };
}
let waitingSW = null;
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (w) => { if (!w) return; waitingSW = w; $('#update').hidden = false; };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => { const w = reg.installing; w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && waitingSW) { reloaded = true; location.reload(); } });
}
async function boot() {
  document.title = APP_NAME;
  applyTheme();
  $('#err-btn').onclick = () => location.reload();
  $('#update-btn').onclick = () => { if (waitingSW) { $('#update-btn').disabled = true; waitingSW.postMessage({ type: 'SKIP_WAITING' }); } };
  $('#nav').innerHTML = TABS.map(([k, i, l]) => `<button data-tab="${k}"><span aria-hidden="true">${i}</span>${l}</button>`).join('');
  $('#nav').onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; S.viewTrip = null; U.track('screen:' + S.tab); render(); scrollTo(0, 0); };
  registerSW();
  code = readCode();
  if (!code) return landing();
  if (!location.hash.includes('k=')) history.replaceState(null, '', '#k=' + code);
  db = await createSync(code, { onChange: () => { if (!$('#sheet').open) render(); }, onStatus: (s) => { S.status = s; const p = $('#syncpill'); if (p) p.outerHTML = syncPill(); } });
  $('#main').addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b || !handlers[b.dataset.act]) return; U.track('tap:' + b.dataset.act); handlers[b.dataset.act](b); });
  $('#main').addEventListener('change', async (e) => {
    if (e.target.id !== 'import' || !e.target.files[0]) return;
    try { const r = db.restoreJSON(await e.target.files[0].text()); render(); toast(`Restored ${r.added + r.updated} entries`); } catch { toast('That file isn’t a backup from this app. Nothing was changed.'); }
  });
  addEventListener('online', render); addEventListener('offline', render);
  $('#nav').hidden = false;
  S.persisted = await navigator.storage?.persisted?.().catch(() => false);
  if (S.me) S.who = S.me;
  render();
  if (!S.me) { const t0 = Date.now(); while (!people().length && !S.status.synced && Date.now() - t0 < 2500) await new Promise((r) => setTimeout(r, 100)); if (!S.me) whoSheet(true); }
  U.startUsage({ db, me: () => S.me, ver: VERSION }); U.timing('load_ready', performance.now()); U.track('open');
}
addEventListener('hashchange', () => { const m = location.hash.match(/k=([A-Za-z0-9_-]{20,})/); if (m && m[1] !== code) location.reload(); });
window.__app = { VERSION, errLog, get db() { return db; }, S };
boot();
