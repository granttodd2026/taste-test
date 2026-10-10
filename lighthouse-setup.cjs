// LHCI puppeteer step (fake data only):
// 1) Give the throwaway Lighthouse space a phone identity so the MAIN screen (Home) renders; usage totals off.
// 2) No relay traffic during Lighthouse: Chrome resolves only localhost (lighthouserc --host-resolver-rules),
//    and every page Lighthouse opens gets a quiet offline WebSocket stub, so scores don't depend on public relays.
const STUB = () => { window.WebSocket = class { constructor() { setTimeout(() => { this.onclose && this.onclose(); }, 0); } send() {} close() {} }; };
module.exports = async (browser, context) => {
  const hook = async (t) => { try { const p = await t.page(); if (p) await p.evaluateOnNewDocument(STUB); } catch {} };
  if (!browser.__ttHooked) { browser.__ttHooked = true; browser.on('targetcreated', hook); }
  for (const t of browser.targets()) await hook(t);
  const page = await browser.newPage();
  await page.goto(new URL('/index.html', context.url).href);
  await page.evaluate(() => { localStorage.setItem('sb-me', 'p-lighthouse'); localStorage.setItem('sb-usage-off', '1'); });
  await page.close();
};
