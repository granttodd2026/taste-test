import { test, expect, throwawayCode, openSpace, goTab } from './fixtures.mjs';
import AxeBuilder from '@axe-core/playwright';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const check = async (page, label) => {
  await page.waitForTimeout(250); // let sheet/toast transitions settle
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${label}: ${v.impact} ${v.id}: ${v.nodes[0].target}`)).toEqual([]);
};
test('axe on landing', async ({ page }) => { await page.goto('/'); await check(page, 'landing'); });
test('axe on every screen, empty and with data, plus sheets', async ({ page }) => {
  await page.goto('/#k=' + throwawayCode()); await page.waitForSelector('#mein'); await check(page, 'who-sheet');
  await page.fill('#mein', 'Alex'); await page.click('#sheet button[type=submit]');
  for (const t of ['home', 'bites', 'boards', 'trips', 'more']) { await goTab(page, t); await check(page, t + '-empty'); }
  await goTab(page, 'home'); await page.getByRole('button', { name: /Water/ }).click(); await check(page, 'home-toast');
  await goTab(page, 'bites'); await page.getByRole('button', { name: /Add a bite/ }).click(); await check(page, 'add-bite');
  await page.fill('#bitein', 'Chips'); await page.click('#sheet button[type=submit]'); await check(page, 'rate');
  await page.locator('#sheet .score-btn', { hasText: /^3$/ }).click(); await check(page, 'bites-data');
  await goTab(page, 'trips'); await page.getByRole('button', { name: /Start a trip/ }).click(); await check(page, 'new-trip');
  await page.fill('#tripname', 'Trip'); await page.click('#sheet button[type=submit]'); await check(page, 'trip-view');
  await page.locator('[data-act=wrap]').first().click(); await check(page, 'wrap-up');
  await page.click('#sheet button[type=submit]'); await check(page, 'catalog');
  await goTab(page, 'boards'); await check(page, 'boards-data');
  await page.evaluate(() => { document.querySelector('#update').hidden = false; document.querySelector('#err').hidden = false; }); await check(page, 'banners');
});
