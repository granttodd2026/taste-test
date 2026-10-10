// v1.9 (usage analytics). Privacy: event NAMES and simple timings only, never entry contents or note text.
// Stored only as hourly rollup records (one per phone per hour) in the family's own encrypted space.
// Never on the logging path: track() is an in-memory counter bump; writes happen later, off the click.
const OFFK = 'sb-usage-off', DEVK = 'sb-udev';
const MAXKEYS = 80, MAXERR = 5;
export const usageOn = () => { try { return localStorage.getItem(OFFK) !== '1'; } catch { return false; } };
export const setUsage = (on) => { try { if (on) localStorage.removeItem(OFFK); else localStorage.setItem(OFFK, '1'); } catch {} };
const dev = () => { try { let d = localStorage.getItem(DEVK); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem(DEVK, d); } return d; } catch { return 'unknown'; } };
let C = {}, T = {}, E = [], dirty = false, ctx = null, timer = null;
const safe = (k) => String(k).replace(/[^a-z0-9:_.-]/gi, '').slice(0, 40);
export function track(name, n = 1) {
  try { if (!usageOn()) return; const k = safe(name); if (!(k in C) && Object.keys(C).length >= MAXKEYS) return; C[k] = (C[k] || 0) + n; dirty = true; } catch {}
}
export function timing(name, ms) {
  try { if (!usageOn() || !(ms >= 0) || ms > 864e5) return; const k = safe(name); const t = (T[k] ||= { n: 0, sum: 0, max: 0 }); if (!t.n && Object.keys(T).length >= 30) return; t.n++; t.sum += Math.round(ms); t.max = Math.max(t.max, Math.round(ms)); dirty = true; } catch {}
}
export function error(msg) { try { if (!usageOn()) return; track('err'); const m = String(msg || '').replace(/\s+/g, ' ').slice(0, 80); if (E.length < MAXERR && !E.includes(m)) E.push(m); } catch {} }
const hourKey = (t) => { const d = new Date(t); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}`; };
// ctx: { db, me: () => name, ver }
export function startUsage(c) {
  ctx = c;
  clearInterval(timer); timer = setInterval(() => flushSoon(), 10 * 60e3);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSoon(0); });
}
export function flushSoon(delay = 2000) { setTimeout(() => { flush().catch(() => {}); }, delay); }
async function pushCounts() {
  try { if (!('caches' in self)) return; const c = await caches.open('sb-usage'); const r = await c.match('push'); if (!r) return; const o = await r.json(); await c.delete('push');
    for (const [k, v] of Object.entries(o || {})) if (typeof v === 'number') track('push:' + k, v); } catch {}
}
export async function flush() {
  if (!ctx || !ctx.db || !usageOn()) { C = {}; T = {}; E = []; dirty = false; return null; }
  await pushCounts();
  if (!dirty) return null;
  const now = Date.now(), d = dev(), id = `use-${d}-${hourKey(now)}`;
  const prev = ctx.db.get(id) || { c: {}, tm: {}, err: [] };
  const c = { ...prev.c }; for (const [k, v] of Object.entries(C)) if (k in c || Object.keys(c).length < MAXKEYS) c[k] = (c[k] || 0) + v;
  const tm = { ...prev.tm }; for (const [k, v] of Object.entries(T)) { const p = tm[k] || { n: 0, sum: 0, max: 0 }; tm[k] = { n: p.n + v.n, sum: p.sum + v.sum, max: Math.max(p.max, v.max) }; }
  const err = [...new Set([...(prev.err || []), ...E])].slice(0, MAXERR);
  C = {}; T = {}; E = []; dirty = false;
  const rec = { id, t: 'usage', dev: d, who: ctx.me() || 'Someone', by: ctx.me() || 'Someone', ver: ctx.ver, hour: hourKey(now), at: now, c, tm, err };
  if (JSON.stringify(rec).length > 6000) return null; // hard size cap
  ctx.db.put(rec);
  return rec;
}
export const _peek = () => ({ C, T, E });
