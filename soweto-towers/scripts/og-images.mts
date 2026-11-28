/**
 * Share images (1200 × 630 JPEG) for every page, rendered in Chromium with the
 * real Exo 2 font and the brand mark. Kept small (target < 300 KB) because
 * WhatsApp drops large preview images.
 *
 *   npx tsx scripts/og-images.mts
 */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { markSvg } from '../src/components/brand/mark-paths';

type Spec = { file: string; image: string; eyebrow: string; title: string; sub: string; badge?: string };

const specs: Spec[] = [
  {
    file: 'home',
    image: 'towers-mural-hero',
    eyebrow: 'Soweto Towers · Orlando Towers',
    title: 'Soweto, from the top.',
    sub: '100m bungee · SCAD freefall · zipline · 360° view',
    badge: 'From R630',
  },
  {
    file: 'book',
    image: 'bungee-pov-edge',
    eyebrow: 'Book your jump',
    title: 'Timed slots. No guesswork.',
    sub: 'Prices up front · group rates from 6 · tickets on WhatsApp',
  },
  {
    file: 'gift',
    image: 'gift-a-jump',
    eyebrow: 'Gift a Jump',
    title: 'Give someone a story.',
    sub: 'Vouchers by WhatsApp or email · valid for a year',
    badge: 'From R80',
  },
  {
    file: 'events',
    image: 'towers-twilight-reflection',
    eyebrow: 'What’s on',
    title: 'Events at the towers.',
    sub: 'Launch weekends · Scream of the Week · team days',
  },
  { file: 'find-my-jump', image: 'scream-clip-phone', eyebrow: '#100mClub', title: 'Find my jump.', sub: 'Your Scream Clip and full HD edit, in one place' },
  {
    file: 'adventures',
    image: 'towers-sunset-panorama',
    eyebrow: 'Seven ways up, one crew',
    title: 'Pick your drop.',
    sub: 'Bungee · straightjacket · SCAD · zipline · paintball · lift ride',
  },
  {
    file: 'bungee-jump',
    image: 'bungee-between-towers',
    eyebrow: 'Adventure',
    title: '100m Bungee Jump',
    sub: 'From the bridge between the painted towers',
    badge: 'R630',
  },
  {
    file: 'straightjacket-bungee',
    image: 'before-the-drop',
    eyebrow: 'Adventure',
    title: 'Straightjacket Bungee',
    sub: 'Same 100m drop. Arms strapped in. Video included.',
    badge: 'R1,030',
  },
  {
    file: 'scad-freefall',
    image: 'scad-freefall',
    eyebrow: 'Adventure',
    title: 'SCAD Freefall',
    sub: 'Inside the Western Cooling Tower. Video included.',
    badge: 'R400',
  },
  { file: 'zipline', image: 'zipline-orlando-dam', eyebrow: 'Adventure', title: '700m Zipline', sub: 'Across the Orlando Dam, free ride back', badge: 'R400' },
  {
    file: 'paintball',
    image: 'paintball-arena',
    eyebrow: 'Adventure',
    title: 'Paintball',
    sub: 'An arena inside the base of the cooling tower',
    badge: 'R200 each',
  },
  {
    file: 'lift-ride',
    image: 'lift-ride-view',
    eyebrow: 'No jump required',
    title: 'Lift Ride & View',
    sub: 'Up the outside of the tower to a 360° view',
    badge: 'R80',
  },
  { file: 'base-jump', image: 'towers-sunset-panorama', eyebrow: 'Adventure', title: 'Base Jump', sub: 'For skydivers with 100+ freefalls, by arrangement' },
  { file: 'groups', image: 'team-day', eyebrow: 'Groups', title: 'Bring the whole crew.', sub: 'Celebrations · team days · schools · tour groups' },
  { file: 'restaurant', image: 'shisanyama-platter', eyebrow: 'Chaf-Pozi, on site', title: 'Jump, then braai.', sub: 'Shisanyama at the foot of the towers' },
  { file: 'visit', image: 'soweto-street-tour', eyebrow: 'Plan your visit', title: 'Everything before the step.', sub: 'Hours · getting here · what to bring' },
  { file: 'safety', image: 'harness-check', eyebrow: 'Safe hands', title: 'Scared? Good.', sub: 'Weight checked twice · jump masters · weather first' },
  { file: 'faq', image: 'celebration-crowd', eyebrow: 'FAQ', title: 'Questions, answered.', sub: 'Prices, limits, weather, videos and groups' },
  {
    file: 'about',
    image: 'soweto-dusk-panorama',
    eyebrow: 'Our story',
    title: 'A landmark that belongs to Soweto.',
    sub: 'From power station to vertical adventure centre',
  },
  { file: 'journal', image: 'soweto-dusk-panorama', eyebrow: 'The journal', title: 'From the top.', sub: 'Guides, stories and plans for your visit' },
  {
    file: 'partners',
    image: 'soweto-street-tour',
    eyebrow: 'Partner with us',
    title: 'Sell Soweto from the top.',
    sub: 'Tour operators · hotels · schools · brands',
  },
  { file: 'contact', image: 'towers-mural-hero', eyebrow: 'Contact', title: 'Talk to the crew.', sub: 'WhatsApp · phone · email · Orlando East, Soweto' },
  {
    file: 'journal-soweto-towers-or-orlando-towers',
    image: 'towers-mural-hero',
    eyebrow: 'Journal',
    title: 'Soweto Towers or Orlando Towers?',
    sub: 'One landmark, two names',
  },
  {
    file: 'journal-first-bungee-jump-what-happens',
    image: 'harness-check',
    eyebrow: 'Journal',
    title: 'Your first bungee jump.',
    sub: 'What actually happens, step by step',
  },
  {
    file: 'journal-a-day-in-soweto-around-the-towers',
    image: 'soweto-street-tour',
    eyebrow: 'Journal',
    title: 'A day in Soweto.',
    sub: 'Planned around the towers',
  },
];

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'og');
await mkdir(outDir, { recursive: true });

const font = (await readFile(path.join(root, 'src', 'fonts', 'exo-2-latin-wght-normal.woff2'))).toString('base64');
const mark = markSvg({ size: 64, background: 'none' });

const html = async (s: Spec) => {
  const bg = (
    await sharp(path.join(root, 'public', 'images', `${s.image}.jpg`))
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 80 })
      .toBuffer()
  ).toString('base64');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'Exo 2';src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:100 900}
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:'Exo 2',sans-serif;background:#1f1f21}
.bg{position:absolute;inset:0;background:url(data:image/jpeg;base64,${bg}) center/cover}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,rgba(18,18,20,.9) 0%,rgba(18,18,20,.66) 42%,rgba(18,18,20,.08) 78%),linear-gradient(0deg,rgba(18,18,20,.55),transparent 40%)}
.c{position:absolute;left:64px;top:54px;bottom:52px;width:700px;display:flex;flex-direction:column;justify-content:space-between;color:#F4F3EF}
.brand{display:flex;align-items:center;gap:14px}.brand svg{width:58px;height:58px}
.name{font-weight:600;letter-spacing:.16em;font-size:22px;text-transform:uppercase;line-height:1}.line{margin-top:6px;font-size:13px;letter-spacing:.28em;color:#A9AAA6;text-transform:uppercase}
.eyebrow{color:#F3A07E;font-weight:600;letter-spacing:.2em;font-size:19px;text-transform:uppercase}
h1{font-weight:300;font-size:${s.title.length > 26 ? 66 : 82}px;line-height:.95;text-transform:uppercase;margin:16px 0 0;letter-spacing:-.005em}
.sub{font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:25px;color:#D3D4D0;margin-top:20px;line-height:1.3}
.foot{display:flex;gap:10px;align-items:center}
.pill{padding:10px 18px;border-radius:999px;background:rgba(52,52,54,.92);font-size:16px;font-weight:500;letter-spacing:.12em;text-transform:uppercase}
.badge{position:absolute;right:54px;top:54px;padding:12px 24px;border-radius:999px;background:linear-gradient(#EE6A34,#E3501C);color:#121212;font-weight:700;font-size:30px;letter-spacing:.02em}
</style></head><body><div class="bg"></div><div class="shade"></div>
${s.badge ? `<div class="badge">${s.badge}</div>` : ''}
<div class="c"><div class="brand">${mark}<div><div class="name">Soweto Towers</div><div class="line">From the top</div></div></div>
<div><div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1><div class="sub">${s.sub}</div></div>
<div class="foot"><span class="pill">sowetotowers.co.za</span><span class="pill">Orlando East, Soweto</span></div></div></body></html>`;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const s of specs) {
  await page.setContent(await html(s), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });
  let q = 82;
  let out = await sharp(png).jpeg({ quality: q, mozjpeg: true, progressive: true }).toBuffer();
  while (out.length > 290_000 && q > 55) {
    q -= 7;
    out = await sharp(png).jpeg({ quality: q, mozjpeg: true, progressive: true }).toBuffer();
  }
  const file = path.join(outDir, `${s.file}.jpg`);
  await writeFile(file, out);
  console.log(`${s.file}.jpg  ${((await stat(file)).size / 1024).toFixed(0)} KB  q${q}`);
}
await browser.close();
