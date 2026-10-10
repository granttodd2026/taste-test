import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import { test, expect, throwawayCode, openSpace, goTab } from './fixtures.mjs';
test('first run: name, then drink log is 1 tap, has Undo, survives immediate reload', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await expect(page.locator('h1')).toHaveText('Taste Test');
  await expect(page).toHaveTitle('Taste Test');
  await page.getByRole('button', { name: /Water/ }).click();
  await expect(page.locator('#toast')).toContainText('Water for Alex');
  await page.reload(); // no waiting: debounce loss would fail here (gate 10)
  await expect(page.getByRole('button', { name: /Water/ })).toContainText('1 today');
  await page.getByRole('button', { name: /Diet Coke/ }).click();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /Diet Coke/ })).not.toContainText('today');
  expect(await page.evaluate(() => window.__persistCalls)).toBeGreaterThan(0);
});
test('2 taps: log a drink for someone else; custom drink', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await goTab(page, 'more');
  await page.getByRole('button', { name: /Add a person/ }).click();
  await page.fill('#pin', 'Bo'); await page.click('#sheet button[type=submit]');
  await goTab(page, 'home');
  await page.getByRole('radio', { name: 'Bo' }).click();
  await page.getByRole('button', { name: /Margarita/ }).click();
  await expect(page.locator('#toast')).toContainText('Margarita for Bo');
  await page.getByRole('button', { name: /Other drink/ }).click();
  await page.fill('#dkin', 'Sweet tea'); await page.click('#sheet button[type=submit]');
  await expect(page.getByRole('button', { name: /Sweet tea/ })).toContainText('1 today');
  await goTab(page, 'boards');
  await expect(page.locator('#main')).toContainText('Marg Monarch');
  await expect(page.locator('#main')).toContainText('Sweet tea Legend');
});
test('No Bad Bites: add, rate with one-liner, boards', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await goTab(page, 'bites');
  await expect(page.getByText('No bites yet')).toBeVisible();
  await page.getByRole('button', { name: /Add a bite/ }).click();
  await page.fill('#bitein', 'Fish tacos'); await page.click('#sheet button[type=submit]');
  await page.fill('#notein', 'Crispy!');
  await page.locator('#sheet .score-btn', { hasText: /^9$/ }).click();
  await expect(page.locator('#sheet')).toBeHidden();
  await expect(page.locator('.bite')).toContainText('9.0');
  await expect(page.locator('.bite')).toContainText('Crispy!');
  await goTab(page, 'boards');
  await expect(page.locator('#main')).toContainText('Fish tacos · 9.0');
});
test('Trip Mode: start, logs tagged, awards, wrap-up, archive to catalog with Undo', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await goTab(page, 'trips');
  await page.getByRole('button', { name: /Start a trip/ }).click();
  await page.fill('#tripname', 'Test Beach');
  await page.click('#sheet button[type=submit]');
  await goTab(page, 'home');
  await expect(page.locator('.banner.trip')).toContainText('Test Beach');
  await page.getByRole('button', { name: /Coffee/ }).click();
  await page.locator('.banner.trip [data-act=wrap]').click(); // trip is 1 day, so today is the final night
  await expect(page.locator('#sheet')).toContainText('Caffeine Captain');
  await page.click('#sheet button[type=submit]');
  await expect(page.locator('.catalog')).toContainText('Test Beach');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.catalog')).toHaveCount(0);
});
const SEL = 'button, a[href], input:not([type=radio]):not(.sr-only), select, summary, label.btn, label.chip, .chip, [role=radio], [role=switch]';
const tooSmall = (page, root) => page.$$eval(`${root} :is(${SEL})`, (els) => els
  .filter((e) => e.offsetParent || e.closest('dialog[open]')).map((e) => { const r = e.getBoundingClientRect(); return { el: e.outerHTML.slice(0, 70), w: Math.round(r.width), h: Math.round(r.height) }; })
  .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44)));
test('every control (chips, switches, sheets included) is at least 44x44 CSS px', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  for (const tab of ['home', 'bites', 'boards', 'trips', 'more']) { await goTab(page, tab); expect(await tooSmall(page, 'body'), tab).toEqual([]); }
  expect(await page.locator('[data-act=theme]').count()).toBe(3);
  const sheets = [['home', '[data-act=customdrink]'], ['bites', '[data-act=addbite]'], ['trips', '[data-act=newtrip]'], ['more', '[data-act=addperson]'], ['more', '[data-act=switchme]']];
  for (const [tab, btn] of sheets) {
    await goTab(page, tab); await page.click(btn); await expect(page.locator('#sheet')).toBeVisible();
    expect(await tooSmall(page, '#sheet'), btn).toEqual([]);
    await page.click('#sheet [data-close]');
  }
  await goTab(page, 'bites'); await page.click('[data-act=addbite]'); await page.fill('#bitein', 'X'); await page.click('#sheet button[type=submit]');
  expect(await tooSmall(page, '#sheet'), 'rate sheet').toEqual([]);
});
test('export + restore round-trip through the real Export button and Restore input', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await page.getByRole('button', { name: /Beer/ }).click();
  await goTab(page, 'bites'); await page.click('[data-act=addbite]'); await page.fill('#bitein', 'Nachos'); await page.click('#sheet button[type=submit]');
  await page.locator('#sheet .score-btn[value="7"]').click();
  await goTab(page, 'more');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export backup' }).click()]);
  const file = await dl.path();
  const n = JSON.parse(require('fs').readFileSync(file, 'utf8')).records.filter((r) => !r.del).length;
  await page.evaluate(() => localStorage.clear());
  await openSpace(page, throwawayCode(), 'Alex');
  await goTab(page, 'more');
  await page.setInputFiles('#import', file);
  await expect(page.locator('#toast')).toContainText(`Restored ${n} entries`);
  await page.reload();
  await goTab(page, 'boards');
  await expect(page.locator('#main')).toContainText('Brew Boss');
  await expect(page.locator('#main')).toContainText('Nachos · 7.0');
});
test('plurals: 1 drink, 1 snack, 1 rating', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await page.getByRole('button', { name: /Water/ }).click();
  await expect(page.locator('#main')).toContainText('1 drink');
  await expect(page.locator('#main')).not.toContainText('1 drinks');
  await goTab(page, 'bites'); await page.click('[data-act=addbite]'); await page.fill('#bitein', 'Pretzels');
  await page.locator('#sheet label.chip', { hasText: 'Snack' }).click(); await page.click('#sheet button[type=submit]');
  await page.locator('#sheet .score-btn[value="5"]').click();
  await expect(page.locator('.bite')).toContainText('1 rating');
  await goTab(page, 'boards');
  await expect(page.locator('#main')).toContainText('1 snack added');
});
test('version is stamped and the landing page works without a link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open' })).toBeVisible();
  const v = await page.evaluate(() => window.__app.VERSION);
  expect(v).toMatch(/^\d+\.\d+\.\d+\+\d{12}$/);
});
