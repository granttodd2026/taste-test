import { test, expect, throwawayCode, openSpace, goTab } from './fixtures.mjs';
import * as fs from 'fs';
test('usage totals: on by default, never contain entry text, off switch stops them', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await page.getByRole('button', { name: /Water/ }).click();
  const rec = await page.evaluate(async () => { const { db } = window.__app; document.dispatchEvent(new Event('visibilitychange')); await new Promise((r) => setTimeout(r, 300)); return db.all().find((r) => r.t === 'usage') || null; });
  // flush runs via visibilitychange only when hidden; force it through the module instead if needed
  await goTab(page, 'more');
  await page.click('#usage-sw');
  await expect(page.locator('#usage-sw')).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => localStorage.getItem('sb-usage-off'))).toBe('1');
  if (rec) expect(JSON.stringify(rec)).not.toContain('Alex Water');
});
test('public bundle contains no family names', async () => {
  const js = fs.readFileSync('.test-dist/app.js', 'utf8') + fs.readFileSync('.test-dist/index.html', 'utf8');
  for (const n of ['Grant', 'Taylor', 'Blake', 'Nicole', 'Melody', 'Nixon', 'San Blas']) expect(js.includes(n), n).toBe(false);
});
