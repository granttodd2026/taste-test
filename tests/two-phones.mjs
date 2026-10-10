// Two phones on ONE throwaway space through a local in-test relay (never real relays). Used by the sync gate tests.
import { WebSocketServer } from 'ws';
export function startRelay() {
  const events = [], subs = new Set();
  const match = (f, e) => (!f.kinds || f.kinds.includes(e.kind)) && (!f.authors || f.authors.includes(e.pubkey)) && (!f.since || e.created_at >= f.since) && (!f.ids || f.ids.includes(e.id))
    && Object.keys(f).filter((k) => k[0] === '#').every((k) => e.tags.some((t) => t[0] === k.slice(1) && f[k].includes(t[1])));
  const wss = new WebSocketServer({ port: 0 });
  wss.on('connection', (ws) => {
    const mine = new Map();
    ws.on('message', (m) => { const d = JSON.parse(m);
      if (d[0] === 'EVENT') { const e = d[1]; if (e.kind >= 30000 && e.kind < 40000) { const dt = (e.tags.find((t) => t[0] === 'd') || [])[1]; const i = events.findIndex((x) => x.kind === e.kind && x.pubkey === e.pubkey && (x.tags.find((t) => t[0] === 'd') || [])[1] === dt); if (i >= 0) events.splice(i, 1); } events.push(e); ws.send(JSON.stringify(['OK', e.id, true, '']));
        for (const s of subs) for (const [sid, fs] of s.mine) if (fs.some((f) => match({ ...f, since: 0 }, e))) s.ws.send(JSON.stringify(['EVENT', sid, e])); }
      else if (d[0] === 'REQ') { const fs = d.slice(2); mine.set(d[1], fs); for (const e of events) if (fs.some((f) => match(f, e))) ws.send(JSON.stringify(['EVENT', d[1], e])); ws.send(JSON.stringify(['EOSE', d[1]])); }
      else if (d[0] === 'CLOSE') mine.delete(d[1]); });
    const s = { ws, mine }; subs.add(s); ws.on('close', () => subs.delete(s));
  });
  return new Promise((r) => wss.on('listening', () => r({ port: wss.address().port, events, close: () => wss.close() })));
}

export async function phone(browser, info, port, code, name, when = '2026-10-10T02:00:00') {
  const ctx = await browser.newContext({ ...info.project.use });
  const p = await ctx.newPage();
  await p.route(/^(?!(http|ws):\/\/localhost)/, (r) => r.abort());
  await p.addInitScript(([port, t]) => {
    const off = new Date(t).getTime() - Date.now(); const R = Date; const N = R.now.bind(R);
    class D extends R { constructor(...a) { if (a.length) super(...a); else super(N() + off); } static now() { return N() + off; } } globalThis.Date = D;
    const W = window.WebSocket; window.WebSocket = class extends W { constructor() { super('ws://localhost:' + port); } }; // every relay URL -> local relay
  }, [port, when]);
  await p.goto('/#k=' + code, { timeout: 30000 });
  await p.fill('#mein', name, { timeout: 30000 }); await p.click('#sheet button[type=submit]', { timeout: 30000 });
  await p.waitForSelector('#nav:not([hidden])', { timeout: 30000 });
  return { p, ctx };
}


// A fresh phone (new profile) pointed at the local relay, opened at a given hash, no auto-naming.
export async function freshPhone(browser, info, port, hash = '', when = '2026-10-10T14:00:00') {
  const ctx = await browser.newContext({ ...info.project.use });
  const p = await ctx.newPage();
  await p.route(/^(?!(http|ws):\/\/localhost)/, (r) => r.abort());
  await p.addInitScript(([port, t]) => {
    const off = new Date(t).getTime() - Date.now(); const R = Date; const N = R.now.bind(R);
    class D extends R { constructor(...a) { if (a.length) super(...a); else super(N() + off); } static now() { return N() + off; } } globalThis.Date = D;
    const W = window.WebSocket; window.WebSocket = class extends W { constructor() { super('ws://localhost:' + port); } };
  }, [port, when]);
  await p.goto('/' + hash, { timeout: 30000 });
  return { p, ctx };
}
