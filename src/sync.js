// Shared, end-to-end encrypted sync over public Nostr relays.
// The family code (in the URL #fragment) never leaves the device. From it we derive:
//   - a signing key (so all family devices write as one shared identity)
//   - an AES-256-GCM key (relays only ever see ciphertext)
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';

export const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://nostr.mom',
  'wss://relay.nostr.net',
  'wss://nostr.oxtr.dev',
  'wss://temp.iris.to', // open strfry; replaces offchain.pub + bitcoiner.social (WoT rejects sender pubkey)
];
const KIND = 30078; // NIP-78 application-specific data (parameterized replaceable)
const te = new TextEncoder();
const td = new TextDecoder();
const sha = async (s) => new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(s)));
const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
const b64 = (u8) => { let s = ''; for (const b of u8) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function createSync(code, { onChange, onStatus, storage = globalThis.localStorage, WS = globalThis.WebSocket, relays = RELAYS } = {}) {
  const sk = await sha('sipbite/v1/sign/' + code);
  const pk = getPublicKey(sk);
  const aes = await crypto.subtle.importKey('raw', await sha('sipbite/v1/enc/' + code), 'AES-GCM', false, ['encrypt', 'decrypt']);
  const dSalt = hex(await sha('sipbite/v1/d/' + code));
  const dtag = async (id) => hex(await sha(dSalt + ':' + id)).slice(0, 32);

  const CK = 'sb-cache-' + pk.slice(0, 16);
  let cache = { records: {}, pending: [], lastSeen: 0 };
  try { const c = JSON.parse(storage.getItem(CK) || 'null'); if (c && c.records) cache = { pending: [], lastSeen: 0, ...c }; } catch {}
  const pending = new Set(cache.pending);
  const dmap = {}; // dtag -> id
  for (const id of Object.keys(cache.records)) dmap[await dtag(id)] = id;

  // Durability: a local write (put/restore) is saved to storage synchronously, before the UI updates,
  // so the last tap survives an immediate reload or app kill. Bulk relay ingest (re-fetchable) is
  // batched, and any batched save is flushed when the app is backgrounded or closed.
  let saveT = null;
  const saveNow = () => {
    clearTimeout(saveT); saveT = null;
    cache.pending = [...pending];
    try { storage.setItem(CK, JSON.stringify(cache)); return true; } catch (e) { console.warn('cache save failed', e); return false; }
  };
  const save = () => { if (!saveT) saveT = setTimeout(saveNow, 150); };
  const flushIfDirty = () => { if (saveT) saveNow(); };
  if (typeof addEventListener === 'function') {
    addEventListener('visibilitychange', () => { if (typeof document !== 'undefined' && document.visibilityState === 'hidden') flushIfDirty(); });
    addEventListener('pagehide', flushIfDirty);
  }

  let changeT = null;
  const changed = () => { clearTimeout(changeT); changeT = setTimeout(() => onChange && onChange(), 30); };

  async function encrypt(rec) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, te.encode(JSON.stringify(rec))));
    const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
    return b64(out);
  }
  async function decrypt(s) {
    const u = unb64(s);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: u.slice(0, 12) }, aes, u.slice(12));
    return JSON.parse(td.decode(pt));
  }
  const newer = (a, b) => !b || a.ua > b.ua || (a.ua === b.ua && JSON.stringify(a) > JSON.stringify(b));

  async function buildEvent(rec) {
    const d = await dtag(rec.id); dmap[d] = rec.id;
    return finalizeEvent({ kind: KIND, created_at: Math.floor(rec.ua / 1000), tags: [['d', d]], content: await encrypt(rec) }, sk);
  }

  // ---- relay pool ----
  const conns = relays.map((url) => ({ url, ws: null, open: false, tries: 0, synced: false, inflight: new Map(), firstFull: true }));
  function status() {
    onStatus && onStatus({ connected: conns.filter((c) => c.open).length, total: conns.length, pending: pending.size, synced: conns.some((c) => c.synced) });
  }
  async function sendRecord(c, rec) {
    if (!c.open) return;
    const ev = await buildEvent(rec);
    c.inflight.set(ev.id, rec.id);
    try { c.ws.send(JSON.stringify(['EVENT', ev])); } catch {}
  }
  // raw (already-signed) events, e.g. push schedule/subscription. Kept until one relay accepts.
  const rawQ = new Map(); // key -> event
  function sendRawTo(c, ev) { if (!c.open) return; c.inflight.set(ev.id, 'raw:' + ev.id); try { c.ws.send(JSON.stringify(['EVENT', ev])); } catch {} }
  async function flush(c) { for (const id of [...pending]) if (cache.records[id]) await sendRecord(c, cache.records[id]); for (const ev of rawQ.values()) sendRawTo(c, ev); }

  async function ingest(ev, c, seen) {
    try {
      if (ev.pubkey !== pk || ev.kind !== KIND) return;
      const rec = await decrypt(ev.content);
      if (!rec || !rec.id) return;
      const d = (ev.tags.find((t) => t[0] === 'd') || [])[1];
      if (d) { dmap[d] = rec.id; seen && seen.add(rec.id); }
      if (ev.created_at > cache.lastSeen) cache.lastSeen = ev.created_at;
      if (newer(rec, cache.records[rec.id])) { cache.records[rec.id] = rec; save(); changed(); }
    } catch (e) { /* not ours / undecryptable: ignore */ }
  }

  function connect(c) {
    let ws;
    try { ws = new WS(c.url); } catch { return retry(c); }
    c.ws = ws;
    const seen = new Set();
    const evSeen = new Set();
    let histUntil = null, histCount = 0, histNew = 0;
    const reqHist = () => {
      const f = { kinds: [KIND], authors: [pk], limit: 500 };
      if (histUntil) f.until = histUntil;
      histCount = 0; histNew = 0;
      ws.send(JSON.stringify(['REQ', 'h', f]));
    };
    let oldest = Infinity;
    ws.onopen = () => {
      c.open = true; c.tries = 0; status();
      if (c.firstFull) reqHist();
      else ws.send(JSON.stringify(['REQ', 'h', { kinds: [KIND], authors: [pk], since: Math.max(0, cache.lastSeen - 3600) }]));
      ws.send(JSON.stringify(['REQ', 'live', { kinds: [KIND], authors: [pk], since: Math.floor(Date.now() / 1000) - 120 }]));
      flush(c);
    };
    ws.onmessage = async (m) => {
      let d; try { d = JSON.parse(m.data); } catch { return; }
      if (d[0] === 'EVENT') {
        const ev = d[2];
        if (d[1] === 'h') { histCount++; if (!evSeen.has(ev.id)) { histNew++; evSeen.add(ev.id); } if (ev.created_at < oldest) oldest = ev.created_at; }
        await ingest(ev, c, seen);
      } else if (d[0] === 'EOSE' && d[1] === 'h') {
        if (c.firstFull && histCount >= 400 && histNew > 0 && oldest !== Infinity) { histUntil = oldest; return reqHist(); }
        try { ws.send(JSON.stringify(['CLOSE', 'h'])); } catch {}
        c.synced = true; status();
        if (c.firstFull) {
          c.firstFull = false;
          // self-heal: give this relay anything it is missing
          for (const id of Object.keys(cache.records)) if (!seen.has(id)) sendRecord(c, cache.records[id]);
        }
        changed();
      } else if (d[0] === 'OK') {
        const id = c.inflight.get(d[1]); c.inflight.delete(d[1]);
        if (id && id.startsWith('raw:')) { if (d[2] === true || /duplicate/i.test(d[3] || '')) for (const [k, ev] of rawQ) if (ev.id === d[1]) rawQ.delete(k); return; }
        if (id && (d[2] === true || /duplicate/i.test(d[3] || ''))) { if (pending.delete(id)) { save(); status(); } }
      }
    };
    ws.onclose = () => { c.open = false; c.synced = false; status(); retry(c); };
    ws.onerror = () => { try { ws.close(); } catch {} };
  }
  function retry(c) {
    if (c.stopped) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(c.tries++, 5)) + Math.random() * 500;
    clearTimeout(c.t); c.t = setTimeout(() => connect(c), delay);
  }
  conns.forEach(connect);

  return {
    pk,
    all: () => Object.values(cache.records).filter((r) => !r.del),
    get: (id) => { const r = cache.records[id]; return r && !r.del ? r : null; },
    async put(rec) {
      const now = Date.now();
      const prev = cache.records[rec.id];
      const r = { ...rec, ua: Math.max(now, prev ? prev.ua + 1 : 0) };
      if (!r.ca) r.ca = now;
      cache.records[r.id] = r; pending.add(r.id); saveNow(); changed(); status();
      for (const c of conns) sendRecord(c, r);
      return r;
    },
    // Backup: every record, including delete markers, exactly as stored (plain JSON, no family code).
    exportJSON() {
      return JSON.stringify({ app: 'sip-and-bite', kind: 'backup', v: 1, exportedAt: new Date().toISOString(), records: Object.values(cache.records) });
    },
    // Restore: merge by `ua` (latest wins). Never deletes: delete markers in the file are skipped.
    // Restored records keep their original `ua` and are queued for sync like any local write.
    restoreJSON(text) {
      let d; try { d = JSON.parse(text); } catch { throw new Error('not-backup'); }
      const list = d && d.kind === 'backup' && (Array.isArray(d.records) ? d.records : d.records && typeof d.records === 'object' ? Object.values(d.records) : null);
      if (!list) throw new Error('not-backup');
      let added = 0, updated = 0, same = 0;
      const changedRecs = [];
      for (const r of list) {
        if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !r.id || typeof r.t !== 'string' || !Number.isFinite(r.ua)) continue;
        if (r.del) continue;
        const cur = cache.records[r.id];
        if (cur && !(r.ua > cur.ua)) { same++; continue; }
        if (cur) updated++; else added++;
        cache.records[r.id] = r; pending.add(r.id); changedRecs.push(r);
      }
      if (changedRecs.length) {
        if (!saveNow()) throw new Error('save-failed');
        changed(); status();
        for (const r of changedRecs) for (const c of conns) sendRecord(c, r);
      }
      return { added, updated, same };
    },
    async remove(id) {
      const prev = cache.records[id]; if (!prev) return;
      await this.put({ id, t: prev.t, del: true, ca: prev.ca });
    },
    sendRaw(key, ev) { rawQ.set(key, ev); for (const c of conns) sendRawTo(c, ev); },
    isSynced: () => conns.some((c) => c.synced) || conns.some((c) => !c.firstFull),
    reconnectNow() { for (const c of conns) if (!c.open) { clearTimeout(c.t); c.tries = 0; connect(c); } },
    close() { for (const c of conns) { c.stopped = true; clearTimeout(c.t); try { c.ws && c.ws.close(); } catch {} } },
    status,
  };
}
