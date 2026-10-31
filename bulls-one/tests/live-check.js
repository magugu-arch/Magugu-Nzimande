// Checks the public Bulls One site from outside: plain HTTP, WhatsApp's
// link-preview fetch, an iPhone in WebKit (Safari's engine), an Android
// phone in Chromium (install + offline) and the Android in-app browser that
// WhatsApp opens links in.
//
// Usage: node live-check.js <public site URL> [screenshot dir]
const { webkit, chromium, devices } = require('playwright');
const fs = require('fs');

const URL_ = process.argv[2];
const SHOTS = process.argv[3] || 'shots';
fs.mkdirSync(SHOTS, { recursive: true });
const ROUTES = ['home', 'fixtures', 'live', 'matchday', 'fan-cam', 'stadium', 'rewards', 'club', 'profile', 'privacy', 'operator', 'assets'];
const WA_UA = 'WhatsApp/2.24.6.77 A';
const WEBVIEW_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.71 Mobile Safari/537.36';
const rows = [];
const row = (where, check, ok, detail = '') => { rows.push({ where, check, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${where} | ${check} | ${detail}`); };

async function routes(page) {
  const bad = [];
  for (const r of ROUTES) {
    await page.evaluate((h) => { location.hash = h; }, r);
    await page.waitForTimeout(300);
    const v = await page.evaluate(() => {
      const a = document.querySelector('.view.active');
      const pics = [...a.querySelectorAll('.pic')];
      return { id: a.id, pics: pics.length, shown: pics.filter((x) => getComputedStyle(x).backgroundImage.startsWith('url("data:')).length, ov: document.documentElement.scrollWidth - innerWidth };
    });
    if (v.id !== r || v.pics !== v.shown || v.ov > 0) bad.push(`${r}:${JSON.stringify(v)}`);
  }
  return bad;
}
async function parallax(page) {
  await page.evaluate(() => { location.hash = 'home'; });
  await page.waitForTimeout(400);
  await page.evaluate(() => scrollTo(0, 600));
  await page.waitForTimeout(300);
  return page.evaluate(() => ({ on: document.documentElement.classList.contains('px'), t: getComputedStyle(document.querySelector('#home .hero-img')).translate }));
}

(async () => {
  // 1. Plain HTTP: page, manifest, service worker, icons, preview image, root redirect
  {
    const res = await fetch(URL_);
    const html = await res.text();
    row('HTTP', 'App page is public', res.status === 200 && /text\/html/.test(res.headers.get('content-type')) && html.includes('<title>Bulls One'), `${res.status} · ${res.headers.get('content-type')} · ${(html.length / 1048576).toFixed(2)} MB`);
    for (const [f, type] of [['manifest.webmanifest', /json|manifest/], ['sw.js', /javascript/], ['icon-192.png', /image\/png/], ['icon-512.png', /image\/png/], ['og-image.jpg', /image\/jpeg/]]) {
      const r = await fetch(new URL(f, URL_));
      row('HTTP', `${f} served`, r.status === 200 && type.test(r.headers.get('content-type') || ''), `${r.status} · ${r.headers.get('content-type')}`);
    }
    const root = await fetch(new URL('../../', URL_));
    const rootHtml = await root.text();
    row('HTTP', 'Site root redirects to the app', root.status === 200 && rootHtml.includes('url=bulls-one/site/'), `${root.status}`);
  }

  // 2. WhatsApp link preview: what WhatsApp's fetcher reads
  {
    const res = await fetch(URL_, { headers: { 'User-Agent': WA_UA } });
    const html = await res.text();
    const og = (p) => (new RegExp(`<meta property="og:${p}" content="([^"]*)"`).exec(html) || [])[1] || '';
    const img = og('image');
    const ir = img ? await fetch(img, { headers: { 'User-Agent': WA_UA } }) : null;
    const bytes = ir ? (await ir.arrayBuffer()).byteLength : 0;
    row('WhatsApp · link preview', 'Title, description and image tags', res.status === 200 && !!og('title') && !!og('description') && !!img, `${og('title')}`);
    row('WhatsApp · link preview', 'Preview image loads (JPEG, under 300 KB)', !!ir && ir.status === 200 && /image\/jpeg/.test(ir.headers.get('content-type')) && bytes < 300 * 1024, `${img} · ${ir && ir.status} · ${(bytes / 1024).toFixed(0)} KB`);
  }

  // 3. iPhone · Safari engine (WebKit)
  {
    const b = await webkit.launch();
    const ctx = await b.newContext({ ...devices['iPhone 14'] });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL_, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${SHOTS}/iphone-webkit-home.png` });
    const bad = await routes(p);
    row('iPhone · WebKit (Safari engine)', '12 screens route, all images show, no sideways scroll', bad.length === 0 && errs.length === 0, bad.join(' ') || `${errs.length} errors ${errs.join(' | ')}`);
    const px = await parallax(p);
    await p.screenshot({ path: `${SHOTS}/iphone-webkit-home-scrolled.png` });
    row('iPhone · WebKit (Safari engine)', 'Parallax runs', px.on && px.t !== 'none', `hero translate ${px.t}`);
    const meta = await p.evaluate(() => ({ title: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content, icon: !!document.querySelector('link[rel="apple-touch-icon"]') }));
    row('iPhone · WebKit (Safari engine)', 'Add to Home Screen metadata', meta.title === 'Bulls One' && meta.icon, JSON.stringify(meta));
    await b.close();
  }

  // 4. Android · Chrome: routes, install manifest, offline after first visit
  {
    const b = await chromium.launch();
    const ctx = await b.newContext({ ...devices['Pixel 7'] });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL_, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${SHOTS}/android-chrome-home.png` });
    const bad = await routes(p);
    row('Android · Chrome', '12 screens route, all images show, no sideways scroll', bad.length === 0 && errs.length === 0, bad.join(' ') || `${errs.length} errors ${errs.join(' | ')}`);
    const px = await parallax(p);
    row('Android · Chrome', 'Parallax runs', px.on && px.t !== 'none', `hero translate ${px.t}`);
    const man = await p.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); if (!l) return null; const m = await (await fetch(l.href)).json(); return { name: m.short_name, display: m.display, icons: m.icons.map((i) => i.sizes).join(',') }; });
    row('Android · Chrome', 'Install manifest with home-screen icons', !!man && man.display === 'standalone', JSON.stringify(man));
    await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
    await p.reload({ waitUntil: 'load' });
    await p.waitForTimeout(800);
    const controlled = await p.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
    await ctx.setOffline(true);
    let offline = '';
    try { await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(500); offline = await p.title(); } catch (e) { offline = 'reload failed: ' + e.message; }
    await ctx.setOffline(false);
    row('Android · Chrome', 'Works offline after first visit', controlled && /Bulls One/.test(offline), `controlled=${controlled} · offline title "${offline}"`);
    await b.close();
  }

  // 5. WhatsApp in-app browser (Android WebView)
  {
    const b = await chromium.launch();
    const ctx = await b.newContext({ ...devices['Pixel 7'], userAgent: WEBVIEW_UA });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(URL_, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const bad = await routes(p);
    row('WhatsApp · in-app browser (Android WebView)', '12 screens route, all images show', bad.length === 0 && errs.length === 0, bad.join(' ') || `${errs.length} errors`);
    await p.screenshot({ path: `${SHOTS}/whatsapp-webview-assets.png` });
    await b.close();
  }

  const failed = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - failed}/${rows.length} passed`);
  fs.writeFileSync(`${SHOTS}/results.json`, JSON.stringify(rows, null, 2));
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
