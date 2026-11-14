/* eslint-disable no-console -- a command-line tool: printing is its output */
// Screenshots of the working Sundowns One app for the deck's proof slide.
// Usage: node app_shots.js <Sundowns_One_Fan_App.html> <out_dir>
const { chromium, devices } = require('playwright');
const path = require('path');
const [file, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const ctx = await b.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.resolve(file));
  await p.waitForTimeout(500);
  const go = async (r, y = 0) => { await p.evaluate((x) => window.SundownsOne.navigate(x), r); await p.waitForTimeout(500); await p.evaluate((v) => window.scrollTo(0, v), y); await p.waitForTimeout(350); };
  const shot = (n) => p.screenshot({ path: `${out}/app-${n}.jpg`, type: 'jpeg', quality: 86 });
  await go('today'); await shot('today');
  await go('matchday'); await p.click('[data-act="linkTicket"]'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const el = document.querySelector('#matchday .pass'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(350); await shot('pass');
  await go('planner'); await p.fill('#b_ticket', '80'); await p.fill('#b_travel', '60'); await p.fill('#b_food', '120'); await p.fill('#b_parking', '50');
  await p.click('[data-act="group"][data-arg="1"]'); await p.click('[data-act="group"][data-arg="1"]');
  await p.evaluate(() => { const el = document.querySelector('#planner #b_ticket').closest('ul'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 150); }); await p.waitForTimeout(350); await shot('planner');
  await go('passport'); await p.evaluate(() => { const el = document.querySelector('#passport .mcard'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(350); await shot('passport');
  await go('fanzone'); await p.evaluate(() => { const el = document.querySelector('#fanzone .sec-head'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(350); await shot('fanzone');
  await p.evaluate(() => { const s = window.SundownsOne.state(); s.segs.community = 'global'; });
  await go('community'); await p.evaluate(() => { const el = document.querySelector('#community [data-panel="global"] .pcard'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(350); await shot('global');
  console.log('errors:', errs.length ? errs : 'none');
  await b.close();
})();
