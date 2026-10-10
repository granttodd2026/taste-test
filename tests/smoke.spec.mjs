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
test('every control is at least 44x44 CSS px on every tab', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  for (const tab of ['home', 'bites', 'boards', 'trips', 'more']) {
    await goTab(page, tab);
    const small = await page.$$eval('button, a[href], input:not([type=radio]):not(.sr-only), select, summary, label.btn', (els) => els
      .filter((e) => e.offsetParent).map((e) => { const r = e.getBoundingClientRect(); return { el: e.outerHTML.slice(0, 60), w: r.width, h: r.height }; })
      .filter((x) => x.w < 44 || x.h < 44));
    expect(small, tab).toEqual([]);
  }
});
test('export + restore round-trip restores all records', async ({ page }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await page.getByRole('button', { name: /Beer/ }).click();
  const json = await page.evaluate(() => window.__app.db.exportJSON());
  const n = JSON.parse(json).records.length;
  await page.evaluate(() => { localStorage.clear(); });
  await openSpace(page, 'test' + 'x'.repeat(24) + Date.now(), 'Alex');
  const r = await page.evaluate((j) => window.__app.db.restoreJSON(j), json);
  expect(r.added).toBe(n);
  await page.reload();
  await goTab(page, 'boards');
  await expect(page.locator('#main')).toContainText('Brew Boss');
});
test('version is stamped and the landing page works without a link', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open' })).toBeVisible();
  const v = await page.evaluate(() => window.__app.VERSION);
  expect(v).toMatch(/^\d+\.\d+\.\d+\+\d{12}$/);
});
