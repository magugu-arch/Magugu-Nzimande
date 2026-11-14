/* eslint-disable no-console -- a command-line tool: printing is its output */
// Write each screen's first render into the built HTML, so the page reads in
// full when JavaScript is off (iPhone Files, WhatsApp document previews).
// With JavaScript on, the app re-renders a screen each time it's shown.
//
// Usage: node prerender.js <built.html>   (run on a fresh build.py output)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const file = path.resolve(process.argv[2]);

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + file);
  await page.waitForTimeout(300);
  const routes = await page.evaluate(() => window.SundownsOne.routes);
  const out = {};
  for (const r of routes) {
    await page.evaluate((x) => window.SundownsOne.navigate(x), r);
    await page.waitForTimeout(120);
    out[r] = await page.$eval('#' + r, (el) => el.innerHTML);
  }
  await browser.close();
  if (errors.length) { console.error('page errors:', errors); process.exit(1); }

  let html = fs.readFileSync(file, 'utf8');
  for (const [id, inner] of Object.entries(out)) {
    const re = new RegExp(`(<section class="screen" id="${id}"[^>]*>)(</section>)`);
    if (!re.test(html)) { console.error('empty screen container not found (already prerendered?):', id); process.exit(1); }
    html = html.replace(re, (m, open, close) => open + inner + close);
  }
  fs.writeFileSync(file, html);
  console.log(`prerendered ${Object.keys(out).length} screens into ${file}`);
})();
