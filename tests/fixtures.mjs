// Every test runs on FAKE data in a fresh browser context with a random throwaway code.
// Never point tests at a real family space. No screenshots.
import { test as base, expect } from '@playwright/test';

export const throwawayCode = () => 'test' + Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 28);

export const test = base.extend({
  allowErrors: [null, { option: true }], // regex for errors a test triggers on purpose
  page: async ({ page, allowErrors }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    // Block all non-local network so a test can never touch real relays/servers.
    await page.route(/^(?!http:\/\/localhost)/, (r) => r.abort());
    await page.addInitScript(() => {
      // Relay stub: sockets "fail" immediately, so the app runs in offline mode. Count attempts only.
      window.__ws = 0;
      window.WebSocket = class { constructor() { window.__ws++; setTimeout(() => { this.onerror && this.onerror(); this.onclose && this.onclose(); }, 10); } send() {} close() {} };
      // Storage-protection spy: records persist() calls; the answer is configurable per test.
      window.__persistCalls = 0;
      const answer = () => sessionStorage.getItem('__persistAnswer') !== 'false';
      const st = navigator.storage || {};
      let granted = false;
      const fake = { ...st, estimate: st.estimate && st.estimate.bind(st), getDirectory: st.getDirectory && st.getDirectory.bind(st),
        persisted: async () => granted,
        persist: async () => { window.__persistCalls++; granted = answer(); return granted; } };
      Object.defineProperty(navigator, 'storage', { value: fake, configurable: true });
    });
    await use(page);
    expect(errors.filter((e) => !(allowErrors && allowErrors.test(e))), 'no console/page errors').toEqual([]);
  },
// Fake names only (never family names in tests).
});
export async function openSpace(page, code, name = 'Tester') {
  await page.goto('/#k=' + code);
  await page.waitForSelector('#mein', { timeout: 15_000 });
  await page.fill('#mein', name);
  await page.click('#sheet button[type=submit]');
  await expect(page.locator('#sheet')).toBeHidden();
  await page.waitForSelector('#nav:not([hidden])');
}
export async function goTab(page, tab) { await page.click(`#nav [data-tab=${tab}]`); await expect(page.locator(`#nav [data-tab=${tab}]`)).toHaveAttribute('aria-current', 'page'); }
export { expect };
