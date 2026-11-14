/* eslint-disable no-console -- a command-line tool: printing is its output */
// Checks the built Sundowns One file in a real browser engine.
//
// Usage: node check.js <path-to-html-or-url> [screenshot-dir]
//
// Every screen at 320, 390 and 1280 px wide: renders without errors, no
// sideways scroll, every photo on it resolves. Then the main interactions:
// sheets open and close, the planner keeps its numbers, the quiz pays out
// once, consent starts off and records changes, Ask Sundowns cites a source
// and hands money questions to a person, low-data mode drops the photos, and
// the page still reads with JavaScript off.
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const target = process.argv[2];
const shots = process.argv[3];
const url = /^https?:/.test(target) ? target : 'file://' + path.resolve(target);
if (shots) fs.mkdirSync(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const routes = ['today', 'matches', 'live', 'matchday', 'planner', 'stadium', 'travel', 'food', 'access', 'passport', 'fanzone', 'watch', 'community', 'experiences', 'store', 'partners', 'impact', 'ask', 'help', 'profile', 'assets', 'about', 'more'];

  for (const [label, ctxOpts] of [
    ['iPhone 13 (390 px)', { ...devices['iPhone 13'] }],
    ['small Android (320 px)', { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
    ['desktop (1280 px)', { viewport: { width: 1280, height: 860 } }],
  ]) {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForTimeout(400);
    const bad = [];
    for (const r of routes) {
      await page.evaluate((x) => window.SundownsOne.navigate(x), r);
      await page.waitForTimeout(650);
      const info = await page.evaluate((x) => {
        const sec = document.getElementById(x);
        const over = document.documentElement.scrollWidth - window.innerWidth;
        const phs = Array.from(sec.querySelectorAll('.ph')).filter((e) => e.offsetParent !== null);
        const noImg = phs.filter((e) => { const b = getComputedStyle(e).backgroundImage; return !b || b === 'none'; }).map((e) => e.className);
        return { active: sec.classList.contains('active'), len: sec.innerText.trim().length, over, phs: phs.length, noImg, title: document.title };
      }, r);
      if (!info.active || info.len < 40 || info.over > 1 || info.noImg.length) bad.push(`${r}: active=${info.active} text=${info.len} overflow=${info.over} missing=${info.noImg.join('|')}`);
      if (shots && label.startsWith('iPhone')) await page.screenshot({ path: `${shots}/phone-${r}.png`, fullPage: true });
      if (shots && label.startsWith('desktop') && ['today', 'matchday', 'passport', 'assets'].includes(r)) await page.screenshot({ path: `${shots}/desktop-${r}.png` });
      if (shots && label.startsWith('small') && ['today', 'planner'].includes(r)) await page.screenshot({ path: `${shots}/small-${r}.png`, fullPage: true });
    }
    check(`${label}: ${routes.length} screens render, no sideways scroll, every photo resolves`, bad.length === 0, bad.join(' ; ') || `${routes.length} screens`);
    check(`${label}: no script errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // Interactions on a phone.
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + '#matchday');
  await page.waitForTimeout(400);
  check('Deep link opens the right screen', await page.evaluate(() => document.getElementById('matchday').classList.contains('active')));

  // Push and back.
  await page.click('#matchday [data-go="planner"]');
  await page.waitForTimeout(700);
  const backLabel = await page.textContent('#navBackLabel');
  check('Planner pushes with a back button naming Matchday', (await page.isVisible('#navBack')) && backLabel === 'Matchday', backLabel);
  await page.fill('#b_ticket', '250');
  await page.fill('#b_food', '120');
  await page.fill('#b_parking', '60');
  await page.click('[data-act="group"][data-arg="1"]');
  await page.click('[data-act="group"][data-arg="1"]');
  const each = await page.textContent('#bEach');
  const crew = await page.textContent('#bCrew');
  check('Budget: per person and crew totals follow the inputs (crew of 4, parking shared)', /385/.test(each.replace(/\s/g, '')) && /1540/.test(crew.replace(/\s/g, '')), `${each} · ${crew}`);
  await page.check('[data-change="planCheck"][data-arg="ticket"]');
  await page.click('[data-act="savePlan"]');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.SundownsOne.navigate('planner'));
  await page.waitForTimeout(600);
  check('Plan survives a reload (saved on the device)', (await page.inputValue('#b_ticket')) === '250' && (await page.isChecked('[data-arg="ticket"][data-change="planCheck"]')));
  await page.click('#navBack');
  await page.waitForTimeout(700);
  check('Back returns to Matchday', await page.evaluate(() => document.getElementById('matchday').classList.contains('active')));

  // Sheet: open, Escape closes, focus returns.
  await page.evaluate(() => window.SundownsOne.navigate('matches'));
  await page.waitForTimeout(600);
  await page.click('#matches [data-act="fixture"]');
  await page.waitForTimeout(600);
  const sheetOpen = await page.isVisible('.sheet');
  const inert = await page.evaluate(() => document.getElementById('stage').inert);
  check('Fixture sheet opens and makes the page behind inert', sheetOpen && inert);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  check('Escape closes the sheet and frees the page', !(await page.isVisible('.sheet')) && !(await page.evaluate(() => document.getElementById('stage').inert)));

  // Sheet drag: a downward flick dismisses it.
  await page.click('#matches [data-act="fixture"]');
  await page.waitForTimeout(600);
  const box = await page.locator('.sheet-top').boundingBox();
  const x = box.x + box.width / 2, y = box.y + 10;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(x, y + i * 22); await page.waitForTimeout(12); }
  await page.mouse.up();
  await page.waitForTimeout(800);
  check('A downward flick on the sheet dismisses it', !(await page.isVisible('.sheet')));

  // Quiz pays once.
  await page.evaluate(() => window.SundownsOne.navigate('fanzone'));
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => window.SundownsOne.state().ledger.length);
  for (const a of ['0:1', '1:1', '2:0']) { await page.click(`[data-act="quiz"][data-arg="${a}"]`); await page.waitForTimeout(80); }
  const after = await page.evaluate(() => window.SundownsOne.state().ledger.filter((e) => e.id === 'quiz').length);
  check('Club history quiz pays +20 once', after === 1 && before === 0);

  // Consent starts off and records each change.
  await page.evaluate(() => window.SundownsOne.navigate('profile'));
  await page.waitForTimeout(600);
  const allOff = await page.evaluate(() => Object.values(window.SundownsOne.state().consent).every((p) => Object.values(p).every((v) => v === false)));
  await page.click('[data-act="consent"][data-arg="partners"]');
  await page.waitForTimeout(500);
  const unticked = await page.evaluate(() => Array.from(document.querySelectorAll('.sheet input[type=checkbox]')).every((c) => !c.checked));
  await page.click('.sheet [data-arg="partners:email"]');
  const logged = await page.evaluate(() => window.SundownsOne.state().consentLog.length);
  check('Message choices start off, nothing pre-ticked, each change is recorded', allOff && unticked && logged === 1);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Ask Sundowns.
  await page.evaluate(() => window.SundownsOne.navigate('ask'));
  await page.waitForTimeout(600);
  await page.fill('#askInput', 'Where is the accessible entrance?');
  await page.press('#askInput', 'Enter');
  const a1 = await page.textContent('#chatLog .msg.bot:last-child');
  await page.fill('#askInput', 'Can I get a refund?');
  await page.press('#askInput', 'Enter');
  const a2 = await page.textContent('#chatLog .msg.bot:last-child');
  await page.fill('#askInput', 'Who will win the league?');
  await page.press('#askInput', 'Enter');
  const a3 = await page.textContent('#chatLog .msg.bot:last-child');
  check('Ask Sundowns answers with a source', /Source: Accessibility/.test(a1), a1.slice(0, 70));
  check('Ask Sundowns hands money questions to a person', /Talk to a person/.test(a2));
  check('Ask Sundowns says when it has no checked answer', /don’t have a checked answer/.test(a3));

  // Low-data mode drops the photos.
  await page.evaluate(() => window.SundownsOne.navigate('profile'));
  await page.waitForTimeout(600);
  await page.click('[data-change="lowData"]');
  await page.evaluate(() => window.SundownsOne.navigate('today'));
  await page.waitForTimeout(600);
  const lowImgs = await page.evaluate(() => Array.from(document.querySelectorAll('#today .pcard .ph')).filter((e) => getComputedStyle(e).backgroundImage !== 'none').length);
  check('Low-data mode hides photos', lowImgs === 0);
  check('Interactions: no script errors', errors.length === 0, errors.join(' | '));
  if (shots) {
    await page.evaluate(() => window.SundownsOne.navigate('profile'));
    await page.waitForTimeout(500);
    await page.click('[data-change="lowData"]');
    await page.evaluate(() => { window.SundownsOne.navigate('today'); });
    await page.waitForTimeout(600);
    await page.evaluate(() => window.SundownsOne.welcome());
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${shots}/phone-welcome.png` });
  }
  await ctx.close();

  // Parallax: the hero photo lags the page, card photos drift but always cover
  // their frames, and the tab lens sits under the active tab.
  const mctx = await browser.newContext({ ...devices['iPhone 13'] });
  const mp = await mctx.newPage();
  const merr = [];
  mp.on('pageerror', (e) => merr.push(e.message));
  await mp.goto(url);
  await mp.waitForTimeout(400);
  const gaps = [];
  let heroShift = 0;
  for (const r of ['today', 'matchday', 'passport', 'fanzone', 'community']) {
    await mp.evaluate((x) => window.SundownsOne.navigate(x), r);
    await mp.waitForTimeout(700);
    const H = await mp.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < H; y += 240) {
      await mp.evaluate((v) => window.scrollTo(0, v), y);
      await mp.waitForTimeout(60);
      const res = await mp.evaluate((sec) => {
        const out = [];
        const m = document.querySelector(`#${sec} .imm-media`);
        const shift = m ? new DOMMatrix(getComputedStyle(m).transform).m42 : 0;
        document.querySelectorAll(`#${sec} .pcard .ph, #${sec} .media .ph, #${sec} .step .ph, #${sec} .imm-media`).forEach((el) => {
          // the frame is where the photo sits before its parallax transform,
          // clipped to what can be seen: the viewport, and the rail for rail cards
          const keep = el.style.transform;
          el.style.transform = 'none';
          const f0 = el.getBoundingClientRect();
          el.style.transform = keep;
          const b = el.getBoundingClientRect();
          const f = { top: Math.max(f0.top, 0), bottom: Math.min(f0.bottom, innerHeight), left: f0.left, right: f0.right };
          const rail = el.closest('.rail');
          if (rail) { const rr = rail.getBoundingClientRect(); f.left = Math.max(f.left, rr.left); f.right = Math.min(f.right, rr.right); }
          if (f.bottom <= f.top || f.right <= f.left) return;
          if (b.left > f.left + 0.5 || b.right < f.right - 0.5 || b.top > f.top + 0.5 || b.bottom < f.bottom - 0.5) out.push(el.className);
        });
        return { out, shift };
      }, r);
      if (r === 'today' && y === 480) heroShift = res.shift;
      if (res.out.length) gaps.push(`${r}@${y}: ${res.out[0]}`);
    }
  }
  check('Parallax: the Today photo moves slower than the page', heroShift > 60, `${heroShift.toFixed(0)} px behind at 480 px scrolled`);
  check('Parallax: every photo still covers its frame at every scroll step (5 screens)', gaps.length === 0, gaps.slice(0, 3).join(' ; '));
  await mp.evaluate(() => window.SundownsOne.navigate('passport'));
  await mp.waitForTimeout(800);
  const lens = await mp.evaluate(() => { const l = document.querySelector('.tabbar .lens').getBoundingClientRect(); const a = document.querySelector('.tabbar a[aria-current="page"]').getBoundingClientRect(); return Math.abs(l.left - a.left) + Math.abs(l.width - a.width); });
  check('Tab bar lens settles under the active tab', lens < 2, `${lens.toFixed(1)} px off`);
  check('Parallax: no script errors', merr.length === 0, merr.join(' | '));
  await mctx.close();

  // Dark mode and reduced motion.
  const dctx = await browser.newContext({ ...devices['iPhone 13'], colorScheme: 'dark', reducedMotion: 'reduce' });
  const dp = await dctx.newPage();
  const derr = [];
  dp.on('pageerror', (e) => derr.push(e.message));
  await dp.goto(url);
  await dp.waitForTimeout(300);
  await dp.evaluate(() => window.SundownsOne.navigate('planner'));
  await dp.waitForTimeout(150);
  const instant = await dp.evaluate(() => getComputedStyle(document.getElementById('planner')).transform);
  await dp.evaluate(() => window.SundownsOne.navigate('today'));
  await dp.waitForTimeout(300);
  await dp.evaluate(() => window.scrollTo(0, 500));
  await dp.waitForTimeout(200);
  const still = await dp.evaluate(() => getComputedStyle(document.querySelector('#today .imm-media')).transform);
  check('Reduce Motion: parallax stays still', still === 'none', still);
  await dp.evaluate(() => window.scrollTo(0, 0));
  const bg = await dp.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('Dark mode follows the system', bg === 'rgb(4, 10, 7)', bg);
  check('Reduce Motion: screens change without sliding', instant === 'none' && derr.length === 0, instant);
  if (shots) { for (const r of ['today', 'passport', 'matchday']) { await dp.evaluate((x) => window.SundownsOne.navigate(x), r); await dp.waitForTimeout(300); await dp.screenshot({ path: `${shots}/dark-${r}.png` }); } }
  await dctx.close();

  // JavaScript off: the prerendered page still reads.
  const nctx = await browser.newContext({ ...devices['iPhone 13'], javaScriptEnabled: false });
  const np = await nctx.newPage();
  await np.goto(url);
  const nojs = await np.evaluate(() => ({ screens: Array.from(document.querySelectorAll('.screen')).filter((s) => s.innerText.trim().length > 40).length, total: document.querySelectorAll('.screen').length }));
  check('JavaScript off: every screen reads (needs prerender.js)', nojs.screens === nojs.total, `${nojs.screens}/${nojs.total}`);
  await nctx.close();

  // Hosted site only: install metadata and offline use after the first visit.
  if (/^https?:/.test(url)) {
    const pctx = await browser.newContext({ ...devices['Pixel 7'] });
    const pp = await pctx.newPage();
    await pp.goto(url);
    const man = await pp.evaluate(async () => { const r = await fetch('manifest.webmanifest'); const m = await r.json(); return { ok: r.ok, display: m.display, icons: m.icons.map((i) => i.sizes).join(',') }; });
    check('Install: manifest with home-screen icons', man.ok && man.display === 'standalone' && /192x192/.test(man.icons) && /512x512/.test(man.icons), JSON.stringify(man));
    await pp.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    await pp.reload();
    await pp.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    for (const r of ['matchday', 'passport']) { await pp.evaluate((x) => window.SundownsOne.navigate(x), r); await pp.waitForTimeout(900); }
    const controlled = await pp.evaluate(() => !!navigator.serviceWorker.controller);
    await pctx.setOffline(true);
    await pp.reload();
    await pp.waitForTimeout(600);
    const off = await pp.evaluate(() => ({ title: document.title, screen: document.querySelector('.screen.active') && document.querySelector('.screen.active').id }));
    await pp.evaluate(() => window.SundownsOne.navigate('passport'));
    await pp.waitForTimeout(800);
    const img = await pp.evaluate(async () => { const el = document.querySelector('#passport .imm-media .ph'); const u = getComputedStyle(el).backgroundImage.slice(5, -2); try { const r = await fetch(u); return r.ok; } catch { return false; } });
    check('Offline: the app and photos already seen still open with no connection', controlled && !!off.screen && img, `controlled=${controlled} · ${JSON.stringify(off)} · photo=${img}`);
    await pctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks pass`);
  if (shots) fs.writeFileSync(path.join(shots, 'results.json'), JSON.stringify(results, null, 1));
  process.exit(failed ? 1 : 0);
})();
