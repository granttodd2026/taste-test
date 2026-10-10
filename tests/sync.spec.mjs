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
import { freshPhone } from './two-phones.mjs';
test('fresh profile: opening the share link joins the SAME space and sees the family names', async ({ browser }, info) => {
  const relay = await startRelay();
  const A = await freshPhone(browser, info, relay.port);
  await A.p.locator('summary').click(); await A.p.click('#newspace');
  await A.p.fill('#mein', 'Alex'); await A.p.locator('#sheet button[type=submit]').dispatchEvent('click');
  await A.p.locator('[data-act=drink][data-k=water]').dispatchEvent('click');
  const link = await A.p.evaluate(() => location.hash);
  const B = await freshPhone(browser, info, relay.port, link);
  await expect(B.p.locator('#sheet [data-pick]', { hasText: 'Alex' })).toBeVisible(T); // A's name offered in the picker
  expect(await B.p.evaluate(() => location.hash)).toBe(link);
  await B.p.fill('#mein', 'Bo'); await B.p.locator('#sheet button[type=submit]').dispatchEvent('click');
  await tab(B.p, 'boards'); await expect(B.p.locator('#main')).toContainText('Water Champ', T); await expect(B.p.locator('#main')).toContainText('Alex', T);
  await expect(A.p.getByRole('radio', { name: 'Bo' })).toBeVisible(T);
  await A.ctx.close(); await B.ctx.close(); relay.close();
});
test('typing survives sync redraws (name picker and bite fields)', async ({ browser }, info) => {
  const relay = await startRelay(), code = throwawayCode();
  const A = await phone(browser, info, relay.port, code, 'Alex', '2026-10-10T14:00:00');
  const B = await freshPhone(browser, info, relay.port, '#k=' + code);
  await expect(B.p.locator('#sheet [data-pick]')).toHaveCount(1, T);
  await B.p.locator('#mein').click();
  const spam = setInterval(() => { A.p.locator('[data-act=drink][data-k=water]').dispatchEvent('click').catch(() => {}); }, 120);
  await tab(A.p, 'more').catch(() => {});
  await A.p.evaluate(() => window.__app.db.put({ id: 'p-extra', t: 'person', name: 'Cy' })); // forces the first-run picker to redraw mid-typing
  await B.p.locator('#mein').pressSequentially('Bobby Lee', { delay: 90 });
  await expect(B.p.locator('#sheet [data-pick]')).toHaveCount(2, T);
  await expect(B.p.locator('#mein')).toHaveValue('Bobby Lee');
  await B.p.locator('#sheet button[type=submit]').dispatchEvent('click');
  await tab(A.p, 'home');
  await tab(B.p, 'bites'); await B.p.locator('[data-act=addbite]').dispatchEvent('click');
  await B.p.locator('#bitein').pressSequentially('Test Tacos', { delay: 90 });
  await B.p.locator('#sheet button[type=submit]').dispatchEvent('click');
  await B.p.locator('#notein').pressSequentially('Crunchy and good', { delay: 90 });
  await expect(B.p.locator('#notein')).toHaveValue('Crunchy and good');
  await B.p.locator('#sheet .score-btn[value="8"]').dispatchEvent('click');
  clearInterval(spam);
  await expect(A.p.locator('#main')).toBeVisible();
  await tab(A.p, 'bites'); await expect(A.p.locator('.bite')).toContainText('Test Tacos', T); await expect(A.p.locator('.bite')).toContainText('Crunchy and good', T);
  await A.ctx.close(); await B.ctx.close(); relay.close();
});
test('Boards card order is identical on both phones', async ({ browser }, info) => {
  const { A, B, done } = await pair(browser, info);
  await A.locator('[data-act=drink][data-k=margarita]').dispatchEvent('click');
  await B.locator('[data-act=drink][data-k=coffee]').dispatchEvent('click');
  await A.locator('[data-act=drink][data-k=water]').dispatchEvent('click');
  await B.locator('[data-act=customdrink]').dispatchEvent('click'); await B.fill('#dkin', 'Zest'); await B.locator('#sheet button[type=submit]').dispatchEvent('click');
  await A.locator('[data-act=customdrink]').dispatchEvent('click'); await A.fill('#dkin', 'Apple cider'); await A.locator('#sheet button[type=submit]').dispatchEvent('click');
  await tab(A, 'boards'); await tab(B, 'boards');
  const order = (p) => p.locator('.card.board > .small:first-child').allTextContents();
  await expect.poll(async () => (await order(A)).length, T).toBe(5);
  await expect.poll(async () => (await order(B)).join('|'), T).toBe((await order(A)).join('|'));
  expect((await order(A)).slice(0, 3).map((x) => x.replace(/\W+/u, '').trim())).toEqual(['Water Champ', 'Caffeine Captain', 'Marg Monarch']);
  await done();
});
test('usage totals from one phone reach the other (two phones)', async ({ browser }, info) => {
  const { A, B, done } = await pair(browser, info);
  await A.locator('[data-act=drink][data-k=water]').dispatchEvent('click');
  const rec = await A.evaluate(() => window.__app.flushUsage());
  expect(rec && rec.t).toBe('usage');
  await expect.poll(() => B.evaluate((id) => { const r = window.__app.db.get(id); return r ? r.c['tap:drink'] || 0 : 0; }, rec.id), T).toBeGreaterThan(0);
  const r = await B.evaluate((id) => JSON.stringify(window.__app.db.get(id)), rec.id);
  expect(r).not.toContain('Water for');
  await done();
});
