// LHCI puppeteer step: give the throwaway Lighthouse space a phone identity so the MAIN screen (Home) renders,
// not the first-run sheet. Usage totals off so nothing is written to relays. Fake data only.
module.exports = async (browser, context) => {
  const page = await browser.newPage();
  await page.goto(new URL('/index.html', context.url).href);
  await page.evaluate(() => { localStorage.setItem('sb-me', 'p-lighthouse'); localStorage.setItem('sb-usage-off', '1'); });
  await page.close();
};
