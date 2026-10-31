const { chromium } = require('playwright');
const [html, pdf] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('requestfailed', (r) => errs.push('failed: ' + r.url()));
  await p.goto('file://' + html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const report = await p.evaluate(() => {
    const out = [];
    const fam = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.weight + f.style).join(',');
    document.querySelectorAll('.slide').forEach((s, i) => {
      const sr = s.getBoundingClientRect();
      s.querySelectorAll('.card').forEach((c) => {
        const cr = c.getBoundingClientRect();
        c.querySelectorAll('*').forEach((el) => {
          if (el.closest('svg.arrow')) return;
          const r = el.getBoundingClientRect();
          if (!r.width || !r.height) return;
          if (r.bottom > cr.bottom - 1 || r.right > cr.right - 1 || r.left < cr.left + 1 || r.top < cr.top + 1) out.push(`slide ${i + 1}: overflows card <${el.tagName.toLowerCase()}> by ${Math.round(Math.max(r.bottom - cr.bottom, r.right - cr.right, cr.left - r.left, cr.top - r.top))}px "${(el.textContent || '').trim().slice(0, 36)}"`);
        });
        // content crowding: text block that sits on top of the heading (margin-top:auto collapsed)
        const h = c.querySelector('h3'), t = c.querySelector('.txt, .bul, .meta, dl.gw, .who');
        if (h && t) { const g = t.getBoundingClientRect().top - h.getBoundingClientRect().bottom; if (g < 14) out.push(`slide ${i + 1}: tight gap ${Math.round(g)}px under "${h.textContent.trim().slice(0, 30)}"`); }
      });
      s.querySelectorAll('*').forEach((el) => {
        if (el.closest('.frame') || el.tagName === 'svg' || el.closest('svg')) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (r.bottom > sr.bottom + 0.5 || r.right > sr.right + 0.5 || r.left < sr.left - 0.5) out.push(`slide ${i + 1}: out of slide <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(r.bottom - sr.top)} "${(el.textContent || '').trim().slice(0, 30)}"`);
      });
      // title block colliding with the content below it
      const hd = s.querySelector('.head');
      if (hd) { const hb = hd.getBoundingClientRect().bottom; s.querySelectorAll('.card, .banner').forEach((c) => { const t = c.getBoundingClientRect().top; if (t < hb + 14) out.push(`slide ${i + 1}: content starts ${Math.round(t - hb)}px from the title block`); }); }
      // text that runs past the footnote line
      const fn = s.querySelector('.fn');
      if (fn) { const fr = fn.getBoundingClientRect(); s.querySelectorAll('.card').forEach((c) => { const r = c.getBoundingClientRect(); if (r.bottom > fr.top - 4) out.push(`slide ${i + 1}: card reaches footnote (${Math.round(r.bottom - sr.top)} vs ${Math.round(fr.top - sr.top)})`); }); }
    });
    return { fonts: fam, issues: out, slides: document.querySelectorAll('.slide').length };
  });
  console.log(JSON.stringify(report, null, 1));
  if (errs.length) console.log('ERRORS', errs);
  await p.pdf({ path: pdf, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  await b.close();
})();
