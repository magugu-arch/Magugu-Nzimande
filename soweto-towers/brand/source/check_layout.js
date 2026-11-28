/* eslint-disable no-console */
// Layout QA for the presentation: proves that nothing overlaps.
//   node check_layout.js path/to/index.html
// Every element tagged data-o (object) or data-t (text) is measured on every page:
//   1. text may not touch an object unless it sits inside that object
//   2. objects may not touch each other unless one contains the other
//   3. text blocks may not touch each other
//   4. everything stays on the page
//   5. nothing but header, footer and full-bleed fields enters the margin bands
// and, for every rendered line of text on the page (inside mockups too, tagged or not):
//   6. no line touches a line of another text element (lines of one heading may share leading)
//   7. no line is cut off by a container that clips its overflow
// Exits 1 and lists every violation, or prints a clean pass per page.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const file = path.resolve(process.argv[2]);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.emulateMedia({ media: 'print' });
  await page.goto('file://' + file);
  await page.evaluate(() => document.fonts.ready);
  const report = await page.evaluate(() => {
    const MM = 96 / 25.4, TOL = 0.6;
    const out = [];
    const pages = [...document.querySelectorAll('.page')];
    const hit = (a, b) => a.left < b.right - TOL && b.left < a.right - TOL && a.top < b.bottom - TOL && b.top < a.bottom - TOL;
    const name = (e) => (e.className && e.className.baseVal === undefined ? e.className : e.getAttribute('class') || e.tagName).toString().split(' ')[0]
      + (e.textContent.trim() ? ` "${e.textContent.trim().slice(0, 28)}"` : '');
    pages.forEach((pg, i) => {
      const P = pg.getBoundingClientRect();
      const objs = [...pg.querySelectorAll('[data-o]')];
      const txts = [...pg.querySelectorAll('[data-t]')];
      const r = (e) => e.getBoundingClientRect();
      const errs = [];
      txts.forEach((t) => objs.forEach((o) => { if (!o.contains(t) && hit(r(t), r(o))) errs.push(`text ${name(t)} overlaps object ${name(o)}`); }));
      objs.forEach((a, x) => objs.forEach((b, y) => { if (y > x && !a.contains(b) && !b.contains(a) && hit(r(a), r(b))) errs.push(`object ${name(a)} overlaps object ${name(b)}`); }));
      txts.forEach((a, x) => txts.forEach((b, y) => { if (y > x && !a.contains(b) && !b.contains(a) && hit(r(a), r(b))) errs.push(`text ${name(a)} overlaps text ${name(b)}`); }));
      [...objs, ...txts].forEach((e) => {
        const q = r(e);
        if (q.left < P.left - TOL || q.right > P.right + TOL || q.top < P.top - TOL || q.bottom > P.bottom + TOL) errs.push(`${name(e)} leaves the page`);
      });
      if (!pg.classList.contains('dark')) {
        const top = P.top + 20 * MM, bot = P.top + 192 * MM;
        [...objs, ...txts].forEach((e) => {
          if (e.classList.contains('field') || e.classList.contains('hd') || e.classList.contains('ft') || e.classList.contains('field-cap')) return;
          if (e.closest('.field')) return;
          const q = r(e);
          if (q.top < top - TOL || q.bottom > bot + TOL) errs.push(`${name(e)} enters a margin band`);
        });
      }
      // 6 and 7: every rendered line of text
      const lines = [];
      const walk = document.createTreeWalker(pg, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent.trim()) continue;
        const rg = document.createRange();
        rg.selectNodeContents(n);
        [...rg.getClientRects()].forEach((q) => { if (q.width > 0.5 && q.height > 0.5) lines.push({ q, el: n.parentElement, t: n.textContent.trim().slice(0, 28) }); });
      }
      // lines of one text block (a heading and its inline spans) may share leading; any other pair may not touch
      const block = (el) => {
        if (el instanceof SVGElement) return el;
        while (el.parentElement && getComputedStyle(el).display === 'inline') el = el.parentElement;
        return el;
      };
      lines.forEach((L) => { L.b = block(L.el); });
      lines.forEach((a, x) => lines.forEach((b, y) => {
        if (y > x && a.b !== b.b && hit(a.q, b.q)) errs.push(`line "${a.t}" overlaps line "${b.t}"`);
      }));
      const inside = (a, b) => a.left >= b.left - TOL && a.right <= b.right + TOL && a.top >= b.top - TOL && a.bottom <= b.bottom + TOL;
      lines.forEach((L) => {
        for (let p = L.el; p && p !== pg.parentElement; p = p.parentElement) {
          const cs = getComputedStyle(p);
          if ([cs.overflow, cs.overflowX, cs.overflowY].some((v) => v === 'hidden' || v === 'clip') && !inside(L.q, r(p))) { errs.push(`line "${L.t}" is cut off by ${name(p)}`); break; }
        }
      });
      out.push({ page: i + 1, objects: objs.length, texts: txts.length, errs });
    });
    return out;
  });
  let bad = 0;
  for (const p of report) {
    if (p.errs.length) { bad += p.errs.length; console.log(`page ${p.page}: ${p.errs.length} problem(s)`); p.errs.forEach((e) => console.log('   - ' + e)); }
    else console.log(`page ${p.page}: clean (${p.objects} objects, ${p.texts} text blocks, every text line)`);
  }
  await browser.close();
  console.log(bad ? `\n${bad} problem(s)` : '\nall pages clean');
  process.exit(bad ? 1 : 0);
})();
