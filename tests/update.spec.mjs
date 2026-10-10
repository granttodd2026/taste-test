import { test, expect, throwawayCode, openSpace } from './fixtures.mjs';
import fs from 'fs';
test('SW cache is named for the version; a new SW shows the Update banner; tap reloads once', async ({ page, browserName }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await page.evaluate(() => navigator.serviceWorker.ready);
  const v = await page.evaluate(() => window.__app.VERSION);
  expect(await page.evaluate(() => caches.keys())).toContain('tt-' + v);
  const f = '.test-dist/sw.js', orig = fs.readFileSync(f, 'utf8');
  try {
    fs.writeFileSync(f, orig.replaceAll(v, v + 'b'));
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    await expect(page.locator('#update')).toBeVisible({ timeout: 15000 });
    await Promise.all([page.waitForEvent('load'), page.click('#update-btn')]);
    await expect.poll(() => page.evaluate(() => caches.keys())).toContain('tt-' + v + 'b');
  } finally { fs.writeFileSync(f, orig); }
});
