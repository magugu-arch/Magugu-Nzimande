// Screenshot every slide at half size for review: node review.js <deck.html> <out_dir>
const { chromium } = require('playwright');
const [html, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 0.5 })).newPage();
  await p.goto('file://' + html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  const n = await p.evaluate(() => document.querySelectorAll('.slide').length);
  for (let i = 0; i < n; i++) {
    const el = (await p.$$('.slide'))[i];
    await el.screenshot({ path: `${out}/s${String(i + 1).padStart(2, '0')}.png` });
  }
  await b.close();
})();
