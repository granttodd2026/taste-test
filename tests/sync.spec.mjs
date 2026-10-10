// Gate 19: every family-relevant state syncs between two phones on ONE throwaway space via a local relay.
import { test, expect, throwawayCode } from './fixtures.mjs';
import { startRelay, phone } from './two-phones.mjs';
test.describe.configure({ timeout: 120000 });
const T = { timeout: 15000 };
async function pair(browser, info) {
  const relay = await startRelay(), code = throwawayCode(), when = '2026-10-10T14:00:00';
  const A = await phone(browser, info, relay.port, code, 'Alex', when);
  const B = await phone(browser, info, relay.port, code, 'Bo', when);
  return { A: A.p, B: B.p, done: async () => { await A.ctx.close(); await B.ctx.close(); relay.close(); } };
}
const tab = (p, t) => p.locator(`#nav [data-tab=${t}]`).dispatchEvent('click');
test('people, drinks, custom drinks, undo, and crowns sync both ways', async ({ browser }, info) => {
  const { A, B, done } = await pair(browser, info);
  await expect(A.getByRole('radio', { name: 'Bo' })).toBeVisible(T);
  await A.locator('[data-act=drink][data-k=water]').dispatchEvent('click');
  await tab(B, 'boards'); await expect(B.locator('#main')).toContainText('Water Champ', T); await expect(B.locator('#main')).toContainText('Alex', T);
  await tab(B, 'home'); await B.locator('[data-act=customdrink]').dispatchEvent('click'); await B.fill('#dkin', 'Kombucha'); await B.locator('#sheet button[type=submit]').dispatchEvent('click');
  await expect(A.locator('[data-act=drink]', { hasText: 'Kombucha' })).toBeVisible(T);
  await A.locator('[data-act=drink][data-k=beer]').dispatchEvent('click'); await A.locator('#undo').dispatchEvent('click');
  await tab(B, 'boards'); await expect(B.locator('#main')).not.toContainText('Brew Boss', T);
  await tab(A, 'more'); await A.locator('[data-act=crown]').first().dispatchEvent('click');
  await tab(B, 'more'); await expect(B.locator('[data-act=crown]').first()).toContainText('Queen', T);
  await done();
});
test('bites and ratings sync; averages and critics match on both phones', async ({ browser }, info) => {
  const { A, B, done } = await pair(browser, info);
  await tab(A, 'bites'); await A.locator('[data-act=addbite]').dispatchEvent('click'); await A.fill('#bitein', 'Gumbo'); await A.locator('#sheet button[type=submit]').dispatchEvent('click');
  await A.fill('#notein', 'Rich'); await A.locator('#sheet .score-btn[value="8"]').dispatchEvent('click');
  await tab(B, 'bites'); await expect(B.locator('.bite')).toContainText('Gumbo', T); await expect(B.locator('.bite')).toContainText('Rich', T);
  await B.locator('[data-act=rate]').dispatchEvent('click'); await B.locator('#sheet .score-btn[value="4"]').dispatchEvent('click');
  await expect(A.locator('.bite .score')).toHaveText('6.0', T); await expect(B.locator('.bite .score')).toHaveText('6.0', T);
  await done();
});
test('trip start, tagging, and archive to the catalog sync', async ({ browser }, info) => {
  const { A, B, done } = await pair(browser, info);
  await tab(A, 'trips'); await A.locator('[data-act=newtrip]').dispatchEvent('click'); await A.fill('#tripname', 'Lake Week'); await A.locator('#sheet button[type=submit]').dispatchEvent('click');
  await expect(B.locator('.banner.trip')).toContainText('Lake Week', T);
  await B.locator('[data-act=drink][data-k=coffee]').dispatchEvent('click');
  await expect(A.locator('.awards')).toContainText('Caffeine Captain', T);
  await A.locator('[data-act=archive]').dispatchEvent('click');
  await expect(B.locator('.banner.trip')).toHaveCount(0, T);
  await tab(B, 'trips'); await expect(B.locator('.catalog')).toContainText('Lake Week', T);
  await done();
});
