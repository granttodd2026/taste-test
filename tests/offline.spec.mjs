import { test, expect, throwawayCode, openSpace } from './fixtures.mjs';
test('cold reload offline shows the app and saves locally', async ({ page, context, browserName }) => {
  await openSpace(page, throwawayCode(), 'Alex');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: /Water/ }).click();
  await expect(page.locator('#syncpill')).toContainText('Saved on this phone');
  await expect(page.getByRole('button', { name: /Water/ })).toContainText('1 today');
  await context.setOffline(false);
});
