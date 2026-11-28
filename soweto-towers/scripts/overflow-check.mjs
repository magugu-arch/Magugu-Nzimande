import { chromium, devices } from 'playwright';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 15'] });
const page = await ctx.newPage();
await page.goto(process.argv[2] ?? 'http://localhost:3000/', { waitUntil: 'load' });
await page.waitForTimeout(1500);
const res = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 0) {
      let p = el.parentElement,
        clipped = false;
      while (p) {
        const s = getComputedStyle(p);
        if (/(hidden|auto|scroll|clip)/.test(s.overflowX)) {
          clipped = true;
          break;
        }
        p = p.parentElement;
      }
      if (!clipped)
        out.push(
          `${el.tagName.toLowerCase()}.${(el.className && typeof el.className === 'string' ? el.className : '').split(' ').slice(0, 2).join('.')} right=${Math.round(r.right)} w=${Math.round(r.width)}`,
        );
    }
  }
  return { vw, scrollW: document.documentElement.scrollWidth, out: out.slice(0, 25) };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
