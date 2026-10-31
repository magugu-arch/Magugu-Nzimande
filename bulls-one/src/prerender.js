// Fill the app's script-rendered containers with their first render, written
// back into the HTML, so the page reads fully when JavaScript is off (iPhone
// Files, WhatsApp document previews). With JavaScript on, the app re-renders
// every one of these containers at startup.
//
// Usage: node prerender.js <Bulls_One_Loftus_Experience.html>
const { chromium } = require('playwright');
const fs = require('fs');

const file = process.argv[2];
const CONTAINERS = {
  home: ['nextHome'],
  fixtures: ['upcomingList', 'resultsList'],
  live: ['eventList', 'statsList', 'lineupList', 'potmOptions', 'feedStatus'],
  matchday: ['mdChecklist'],
  'fan-cam': ['fcPanel', 'fanGallery'],
  rewards: ['badgeGrid', 'ledgerList', 'pointsBal'],
  profile: ['prefList', 'consentList'],
  assets: ['assetGrid', 'assetSummary'],
};

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('file://' + file);
  await page.waitForTimeout(300);
  const out = {};
  for (const [route, ids] of Object.entries(CONTAINERS)) {
    await page.evaluate((r) => { location.hash = r; }, route);
    await page.waitForTimeout(250);
    for (const id of ids) out[id] = await page.$eval('#' + id, (el) => el.innerHTML);
  }
  await browser.close();
  if (errors.length) { console.error('page errors:', errors); process.exit(1); }

  let html = fs.readFileSync(file, 'utf8');
  for (const [id, inner] of Object.entries(out)) {
    const re = new RegExp(`(<(\\w+)[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)(</\\2>)`);
    if (!re.test(html)) { console.error('container not found:', id); process.exit(1); }
    html = html.replace(re, (m, open, tag, old, close) => open + inner + close);
  }
  fs.writeFileSync(file, html);
  console.log(`prerendered ${Object.keys(out).length} containers into ${file}`);
})();
