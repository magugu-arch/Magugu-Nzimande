#!/usr/bin/env node
/**
 * Pixel-level text contrast on every screen that uses photography, for every
 * role, at three phone sizes. CSS colours can't tell you whether text over a
 * photograph is readable, so this measures what is actually drawn: each line
 * is hidden, the screen is captured, and the text colour is compared with the
 * 95th-percentile brightest (or darkest) pixel behind it. Every photo is
 * scrolled into view so text on cards further down is measured too.
 *
 * WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text (24px, or 18.66px bold).
 *
 *   npm run export:web && npm run e2e:contrast
 */
import { launch, serve, tap, visible } from './lib/web.mjs';

const PAGES = {
  'signed-out': ['/sign-in'],
  student: [
    '/home',
    '/campus',
    '/events',
    '/events/spring-sounds',
    '/dining',
    '/library',
    '/transport',
    '/residence',
    '/wellbeing',
    '/graduation',
  ],
  staff: ['/home', '/events'],
  parent: ['/home', '/guardian'],
  alumni: [
    '/home',
    '/alumni',
    '/alumni/giving',
    '/alumni/give/alumni-bursary',
    '/alumni/mentoring',
  ],
};
const SIZES = [
  [320, 568],
  [360, 740],
  [390, 844],
];

const server = await serve();
const failures = [];
let measured = 0;

async function settle(page) {
  let calm = 0;
  for (let i = 0; i < 40 && calm < 3; i++) {
    await page.waitForTimeout(250);
    const ready = await page.evaluate(
      () =>
        document.body.innerText.trim().length > 0 &&
        !document.querySelector('[data-testid="skeleton"]'),
    );
    calm = ready ? calm + 1 : 0;
  }
  await page.waitForTimeout(500); // photo fade-in
  // Pop-up banners and toasts come and go over whatever is beneath them; the
  // screen is judged without them (their own text is navy on white).
  await page.addStyleTag({
    content: '[data-testid="in-app-banner"],[data-testid="toast"]{display:none!important}',
  });
}

/** Measures every visible line of text in the viewport, or only those over `region`. */
async function measure(page, region) {
  const targets = await page.evaluate((region) => {
    document.querySelectorAll('[data-measure]').forEach((el) => el.removeAttribute('data-measure'));
    const out = [];
    // Content scrolling under the tab bar passes through its top shadow;
    // that band is a scroll position, not a place text is meant to be read.
    const bars = [...document.querySelectorAll('[role="tablist"]')]
      .map((b) => b.getBoundingClientRect())
      .filter((b) => b.height > 0 && b.bottom >= innerHeight - 40);
    const barTop = bars.length ? Math.min(...bars.map((b) => b.top)) - 16 : innerHeight;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent.trim();
      if (!text || !el || el.hasAttribute('data-measure')) continue;
      if (/ionicons|material|fontawesome/i.test(getComputedStyle(el).fontFamily)) continue; // icon glyphs
      if (
        el.checkVisibility &&
        !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      )
        continue;
      const r = el.getBoundingClientRect();
      if (
        r.width < 4 ||
        r.height < 4 ||
        r.top < 0 ||
        r.bottom > innerHeight ||
        r.left < 0 ||
        r.right > innerWidth
      )
        continue;
      if (r.bottom > barTop && !el.closest('[role="tablist"]')) continue;
      if (
        region &&
        (r.bottom < region.top ||
          r.top > region.bottom ||
          r.right < region.left ||
          r.left > region.right)
      )
        continue;
      // Text under the tab bar or a header isn't seen; judge only what's on top.
      const hit = (x, y) => {
        const e = document.elementFromPoint(x, y);
        return e && (e === el || el.contains(e) || e.contains(el));
      };
      if (
        !hit(r.left + r.width / 2, r.top + r.height / 2) ||
        !hit(r.left + 2, r.top + r.height / 2) ||
        !hit(r.right - 2, r.top + r.height / 2)
      )
        continue;
      const cs = getComputedStyle(el);
      const svg = el instanceof SVGElement;
      el.setAttribute('data-measure', String(out.length));
      out.push({
        text: text.slice(0, 48),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        color: svg ? cs.fill : cs.color,
        size: parseFloat(cs.fontSize),
        family: cs.fontFamily + ' ' + cs.fontWeight,
      });
    }
    return out;
  }, region ?? null);
  if (!targets.length) return [];
  const style = await page.addStyleTag({
    content:
      '[data-measure]{color:transparent!important;fill:transparent!important;stroke:transparent!important;text-shadow:none!important}',
  });
  const png = (await page.screenshot()).toString('base64');
  await style.evaluate((el) => el.remove());
  return page.evaluate(
    async ({ png, targets }) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + png;
      await img.decode();
      const dpr = img.width / innerWidth;
      const cv = document.createElement('canvas');
      cv.width = img.width;
      cv.height = img.height;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const lin = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
      return targets.map((t) => {
        const [r, g, b, a = 1] = t.color.match(/[\d.]+/g).map(Number);
        const d = ctx.getImageData(
          t.x * dpr,
          t.y * dpr,
          Math.max(1, t.w * dpr),
          Math.max(1, t.h * dpr),
        ).data;
        const ls = [];
        let sr = 0,
          sg = 0,
          sb = 0;
        for (let i = 0; i < d.length; i += 4) {
          ls.push(lum(d[i], d[i + 1], d[i + 2]));
          sr += d[i];
          sg += d[i + 1];
          sb += d[i + 2];
        }
        ls.sort((x, y) => x - y);
        const n = d.length / 4;
        // Semi-transparent text: blend it over the average background.
        const mix = (c, bg) => c * a + bg * (1 - a);
        const lt = lum(mix(r, sr / n), mix(g, sg / n), mix(b, sb / n));
        const median = ls[Math.floor(ls.length / 2)];
        const worst =
          lt > median ? ls[Math.floor(ls.length * 0.95)] : ls[Math.floor(ls.length * 0.05)];
        const ratio = (Math.max(lt, worst) + 0.05) / (Math.min(lt, worst) + 0.05);
        const bold = /Bold|ExtraBold|SemiBold| (6|7|8|9)00$/.test(t.family);
        const large = t.size >= 24 || (t.size >= 18.66 && bold);
        return {
          text: t.text,
          ratio: Math.round(ratio * 100) / 100,
          need: large ? 3 : 4.5,
          y: Math.round(t.y),
          dark: Math.round(worst * 1000) / 1000,
        };
      });
    },
    { png, targets },
  );
}

const only = process.env.CONTRAST_PATHS?.split(',');
for (const [w, h] of SIZES) {
  for (const [role, all] of Object.entries(PAGES)) {
    const paths = only ? all.filter((p) => only.includes(p)) : all;
    if (!paths.length) continue;
    const { browser, page } = await launch({ width: w, height: h });
    try {
      await page.goto(`${server.url}/`);
      if (role !== 'signed-out') {
        await tap(page, `persona-${role}`);
        await tap(page, 'sso-sign-in');
        await visible(page, 'home').waitFor();
      }
      for (const path of paths) {
        await page.goto(`${server.url}${path}`);
        await settle(page);
        const results = new Map();
        const keep = (rs) =>
          rs.forEach((r) => {
            const k = r.text;
            if (!results.has(k) || results.get(k).ratio > r.ratio) results.set(k, r);
          });
        keep(await measure(page));
        const photos = await page.locator('img').filter({ visible: true }).count();
        for (let i = 0; i < photos; i++) {
          const img = page.locator('img').filter({ visible: true }).nth(i);
          await img.evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(400);
          const box = await img.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
          });
          keep(await measure(page, box));
        }
        for (const r of results.values()) {
          measured += 1;
          if (r.ratio < r.need)
            failures.push(
              `${role}@${w}×${h} ${path}: ${r.ratio}:1 (needs ${r.need}) “${r.text}”${process.env.CONTRAST_DEBUG ? ` at y=${r.y}, background L=${r.dark}` : ''}`,
            );
        }
      }
    } catch (e) {
      failures.push(`${role}@${w}×${h}: ${e.message.split('\n')[0]}`);
    } finally {
      await browser.close();
    }
  }
}
await server.close();
if (failures.length) {
  console.log(
    `✗ ${failures.length} of ${measured} measured lines fall short:\n  ${failures.join('\n  ')}`,
  );
  process.exit(1);
}
console.log(
  `✓ ${measured} lines of text on photo screens meet WCAG AA contrast at 320, 360 and 390pt.`,
);
