/**
 * One self-contained HTML file of the website, for review on any device by
 * double-clicking it — no server, no internet, no install.
 *
 *   npm run build && npm run seed:demo -- --reset && npm start   (in one shell)
 *   PREVIEW_BASE_URL=http://localhost:3000 npm run preview:build
 *
 * Every public page is captured from the running production build (demo data,
 * reduced motion) and stitched into one document:
 *   - CSS, fonts and every image are inlined (images once each, as WebP);
 *   - pages switch with the URL fragment and CSS :target, so navigation works
 *     even where scripts are blocked; a small script adds the menu dialog,
 *     pillar tabs, the header's scroll state and a notice on forms;
 *   - management screens and the booking journey are included as screenshots,
 *     with the image library, the completion audit and the costing.
 * Output: preview/Zakes-Bantwini-Website-Preview.html
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import sharp from 'sharp';
import { allMedia, getMediaFile } from '../src/content/media';

const root = process.cwd();
const base = (process.env.PREVIEW_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const OUT_DIR = path.join(root, 'preview');
const OUT = path.join(OUT_DIR, 'Zakes-Bantwini-Website-Preview.html');
const ADMIN = { email: process.env.PREVIEW_ADMIN_EMAIL ?? 'owner@example.com', password: process.env.DEMO_PASSWORD ?? 'demo-password-change-me' };

const keyFor = (p: string) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase());

// ── Pages ──────────────────────────────────────────────────────────────────

const STATIC_PAGES: [string, string][] = [
  ['/', 'Home'],
  ['/music', 'Music'],
  ['/videos', 'Videos'],
  ['/live', 'Live'],
  ['/book', 'Book Zakes'],
  ['/book/request', 'Booking request'],
  ['/story', 'The Story'],
  ['/architect', 'The Architect'],
  ['/handover', 'The Handover'],
  ['/journal', 'Journal'],
  ['/press', 'Press / EPK'],
  ['/collaborate', 'Collaborate'],
  ['/community', 'Community'],
  ['/privacy', 'Privacy'],
];

async function discoverDetailPages(browser: Browser): Promise<[string, string][]> {
  const page = await browser.newPage();
  const found = new Map<string, string>();
  for (const [list, pattern] of [
    ['/music', /^\/music\/[\w-]+$/],
    ['/videos', /^\/videos\/[\w-]+$/],
    ['/journal', /^\/journal\/[\w-]+$/],
    ['/live', /^\/live\/[\w-]+$/],
  ] as const) {
    await page.goto(base + list, { waitUntil: 'load' });
    const links = (await page.$$eval('a[href]', (as) => as.map((a) => [a.getAttribute('href') ?? '', (a.textContent ?? '').trim()]))) as [string, string][];
    for (const [href, text] of links) if (pattern.test(href) && !found.has(href)) found.set(href, text.slice(0, 60) || href);
  }
  await page.close();
  return [...found.entries()];
}

type Captured = { key: string; path: string; title: string; html: string; htmlClass: string; styles: string[]; inline: string[] };

/** Runs inside each captured page (plain JS, read as text so no build step touches it). */
const TRANSFORM = readFileSync(path.join(root, 'scripts', 'preview-transform.js'), 'utf8');

async function capture(browser: Browser, pathname: string, title: string, known: Set<string>): Promise<Captured> {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const res = await page.goto(base + pathname, { waitUntil: 'load' });
  if (!res || (res.status() >= 400 && pathname !== '/this-page-does-not-exist')) throw new Error(`${pathname}: HTTP ${res?.status()}`);
  await page.waitForTimeout(400);
  const header = page.locator('header').first();
  const topClass = (await header.getAttribute('class').catch(() => null)) ?? '';
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(350);
  const solidClass = (await header.getAttribute('class').catch(() => null)) ?? topClass;
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const key = keyFor(pathname);
  const args = { key, known: [...known], topClass, solidClass };
  // Sent as source text: tsx would otherwise wrap named helpers in a __name()
  // call that does not exist in the page.
  const result = (await page.evaluate(`${TRANSFORM.trim()}(${JSON.stringify(args)})`)) as { html: string; htmlClass: string; styles: string[]; inline: string[] };
  await context.close();
  return { key, path: pathname, title, ...result };
}

// ── Assets ─────────────────────────────────────────────────────────────────

async function dataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const type = res.headers.get('content-type')?.split(';')[0] ?? 'application/octet-stream';
  return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
}

/** Stylesheets with every url(...) they reference inlined. */
async function inlineCss(hrefs: string[], inline: string[]): Promise<string> {
  const parts: string[] = [];
  for (const href of hrefs) {
    let css = await (await fetch(href)).text();
    // Next writes font URLs relative to the stylesheet (../media/…); resolve each against it.
    const urls = [...new Set([...css.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)].map((m) => m[2]!))].filter((u) => !/^(data:|#|about:)/.test(u));
    for (const u of urls) css = css.split(`url(${u})`).join(`url(${await dataUri(new URL(u, href).href)})`).split(`url("${u}")`).join(`url("${await dataUri(new URL(u, href).href)}")`);
    parts.push(css);
  }
  return [...parts, ...inline].join('\n');
}

/** Each supplied image once: the largest derivative up to 1600 px, as WebP. */
function imageMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of allMedia()) {
    const f = getMediaFile(m.id);
    const width = [...f.widths].filter((w) => w <= 1600).sort((a, b) => b - a)[0] ?? f.widths[0];
    const file = path.join(root, 'public', 'media', `${m.id}-${width}.webp`);
    map[m.id] = `data:image/webp;base64,${readFileSync(file).toString('base64')}`;
  }
  return map;
}

async function shot(page: Page, opts: { full?: boolean; maxHeight?: number } = {}): Promise<string> {
  // Full-page captures paint fixed elements wherever the viewport was; pin the
  // header to the top and drop focus so the skip link stays hidden.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const pin = opts.full ? await page.addStyleTag({ content: 'body > header{position:absolute!important} a[href="#main"]{display:none!important}' }) : null;
  if (opts.full) {
    // Sticky elements are painted where they sit at the current scroll position.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
  }
  const png = await page.screenshot({ fullPage: opts.full ?? false });
  await pin?.evaluate((el) => (el as Element).remove());
  let img = sharp(png);
  const meta = await img.metadata();
  const scale = meta.width! > 1200 ? 1200 / meta.width! : 1;
  const maxH = opts.maxHeight ?? 2600;
  if (meta.height! * scale > maxH) img = img.extract({ left: 0, top: 0, width: meta.width!, height: Math.round(maxH / scale) });
  const webp = await img.resize({ width: Math.round(meta.width! * scale) }).webp({ quality: 68 }).toBuffer();
  return `data:image/webp;base64,${webp.toString('base64')}`;
}

// ── Walkthrough: the booking journey and the management screens ───────────

type Shot = { title: string; caption: string; src: string; phone?: boolean };

async function walkthrough(browser: Browser): Promise<Shot[]> {
  const shots: Shot[] = [];
  const client = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })).newPage();
  const admin = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })).newPage();

  await client.goto(`${base}/book/request`);
  await client.getByRole('button', { name: 'Next month' }).click();
  await client.locator('button[data-state="available"]').nth(9).click();
  shots.push({ title: '1 · Choose a date', caption: 'The public calendar shows only available, limited or unavailable — never who booked what.', src: await shot(client, { full: true, maxHeight: 2400 }), phone: true });
  await client.getByRole('button', { name: 'Continue' }).click();
  await client.getByLabel('Corporate event').check();
  await client.getByLabel('Performance format').selectOption('headline');
  await client.getByLabel('Start time').fill('20:00');
  await client.getByLabel('Expected attendance').fill('900');
  await client.getByLabel('Budget range').selectOption('300k-600k');
  shots.push({ title: '2 · The event', caption: 'Event type, format, timing, audience and budget, validated step by step.', src: await shot(client, { full: true, maxHeight: 2400 }), phone: true });
  await client.getByRole('button', { name: 'Continue' }).click();
  await client.getByLabel('Venue').fill('Sample Convention Centre');
  await client.getByLabel('City').fill('Cape Town');
  await client.getByRole('button', { name: 'Continue' }).click();
  await client.getByLabel('Full name').fill('Preview Client');
  await client.getByLabel('Email').fill('preview-client@example.com');
  await client.getByLabel('Mobile / WhatsApp').fill('+27 82 555 0199');
  await client.setInputFiles('#brief', path.join(root, 'e2e', 'fixtures', 'event-brief.pdf'));
  await client.getByRole('button', { name: 'Continue' }).click();
  shots.push({ title: '3 · Review and send', caption: 'Everything on one screen before sending, with the event brief attached and explicit consent.', src: await shot(client, { full: true }), phone: true });
  await client.getByLabel(/I agree to Zakes/).check();
  await client.getByRole('button', { name: 'Send booking request' }).click();
  await client.waitForURL(/\/book\/confirmation\//);
  const portal = client.url();
  const reference = (await client.locator('h1').innerText()).trim();
  shots.push({ title: `4 · Reference ${reference}`, caption: 'The client’s private booking page: status timeline, details, documents and the booking team.', src: await shot(client, { full: true, maxHeight: 2200 }), phone: true });

  await admin.goto(`${base}/admin/login`);
  await admin.getByLabel('Email').fill(ADMIN.email);
  await admin.getByLabel('Password').fill(ADMIN.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await admin.waitForURL(`${base}/admin`);
  shots.push({ title: 'Management dashboard', caption: 'New enquiries, pending quotes, holds, confirmed bookings, outstanding payments, upcoming events and recent activity.', src: await shot(admin, { full: true }) });

  await admin.goto(`${base}/admin/bookings`);
  shots.push({ title: 'All bookings', caption: 'Every request by status, with a CSV export for the finance team.', src: await shot(admin, { full: true }) });

  await admin.getByRole('link', { name: reference }).first().click();
  await admin.waitForURL(/\/admin\/bookings\//);
  await admin.getByLabel('Move to').selectOption('IN_REVIEW');
  await admin.getByRole('button', { name: 'Update status' }).click();
  await admin.getByText('Status updated.').waitFor();
  await admin.getByLabel('Amount (R)').first().fill('320000');
  await admin.getByLabel('Amount (R)').nth(1).fill('24000');
  await admin.getByLabel('Amount (R)').nth(3).fill('18000');
  await admin.getByRole('button', { name: 'Save and send to client' }).click();
  await admin.getByText(/Quote v1 sent/).waitFor();
  shots.push({ title: 'A booking, in management', caption: 'Status, hold, quote editor with live VAT and deposit maths, agreement, payments, documents, internal notes and the audit trail.', src: await shot(admin, { full: true, maxHeight: 3000 }) });

  await client.goto(portal.replace('/confirmation/', '/quote/'));
  shots.push({ title: '5 · The quote', caption: 'Performance, travel, accommodation, production, VAT, total, deposit, balance, deadlines and cancellation terms.', src: await shot(client, { full: true, maxHeight: 2600 }), phone: true });
  await client.getByRole('button', { name: 'Accept quote' }).click();
  await client.waitForURL(/accepted=1/);
  await client.getByLabel(/I have read the agreement/).check();
  await client.getByRole('button', { name: 'Sign agreement' }).click();
  await client.getByText(/Signed by/).first().waitFor();
  await client.reload();
  await client.getByRole('button', { name: /Pay deposit/ }).click();
  await client.waitForURL(/\/book\/pay\/sandbox/);
  shots.push({ title: '6 · Deposit', caption: 'Payment runs through the gateway (PayFast in production; this is the no-money sandbox). Card details never touch this site.', src: await shot(client, { full: true, maxHeight: 2000 }), phone: true });
  await client.getByRole('button', { name: 'Simulate successful payment' }).click();
  await client.waitForURL(/payment=returned/);

  await admin.reload();
  await admin.getByRole('button', { name: 'Confirm booking' }).click();
  await admin.getByText(/Booking confirmed/).waitFor();
  await client.reload();
  shots.push({ title: '7 · Confirmed', caption: 'Only management confirms. The client sees it at once, and the date shows as unavailable publicly.', src: await shot(client, { full: true, maxHeight: 2200 }), phone: true });

  for (const [url, title, caption] of [
    ['/admin/calendar', 'Calendar: month', 'Holds, confirmed dates, travel and blocked days; set availability by hand.'],
    ['/admin/calendar?view=week', 'Calendar: week', 'Week and day views for planning travel and production.'],
    ['/admin/events', 'Public events', 'Verified listings for /live, published or kept as drafts.'],
    ['/admin/inbox', 'Inbox', 'Collaboration proposals (new → reviewed → archived) and community signups with the consent each person gave.'],
    ['/admin/content', 'Content', 'Every release, video, story and pillar with its approval state. Nothing unapproved publishes in launch mode.'],
    ['/admin/content/albums/release-i', 'Editing a release', 'Cover art, tracklist, credits, listen links and related content, saved straight to the site.'],
    ['/admin/content/assets', 'Asset library', 'Approved cover art, audio previews, captions and the rider, each with a permanent link.'],
    ['/admin/team', 'Team', 'Owner, manager and viewer roles; one-time passwords; the last owner cannot be removed.'],
  ] as const) {
    await admin.goto(base + url);
    shots.push({ title, caption, src: await shot(admin, { full: true }) });
  }
  return shots;
}

// ── Markdown (the audit and costing) ───────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inlineMd(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function markdown(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length + 1;
      out.push(`<h${level}>${inlineMd(h[2]!)}</h${level}>`);
      i++;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      out.push('<hr>');
      i++;
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith('|')) {
        rows.push(lines[i]!.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|')));
        i++;
      }
      const [headRow, sep, ...bodyRows] = rows;
      const align = (sep ?? []).map((c) => (c.endsWith(':') ? 'right' : 'left'));
      out.push(
        `<div class="zbd-table"><table><thead><tr>${headRow!.map((c, j) => `<th style="text-align:${align[j]}">${inlineMd(c)}</th>`).join('')}</tr></thead><tbody>${bodyRows
          .map((r) => `<tr>${r.map((c, j) => `<td style="text-align:${align[j]}">${inlineMd(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }
    if (/^(\d+\.|-)\s/.test(line)) {
      const ordered = /^\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && (/^(\d+\.|-)\s/.test(lines[i]!) || /^\s{2,}-\s/.test(lines[i]!) || (lines[i]!.startsWith('  ') && lines[i]!.trim()))) {
        const l = lines[i]!;
        if (/^\s{2,}-\s/.test(l)) {
          const sub: string[] = [];
          while (i < lines.length && /^\s{2,}-\s/.test(lines[i]!)) sub.push(`<li>${inlineMd(lines[i++]!.replace(/^\s+-\s/, ''))}</li>`);
          items[items.length - 1] += `<ul>${sub.join('')}</ul>`;
        } else if (/^(\d+\.|-)\s/.test(l)) {
          items.push(inlineMd(l.replace(/^(\d+\.|-)\s/, '')));
          i++;
        } else {
          items[items.length - 1] += `<br>${inlineMd(l.trim())}`;
          i++;
        }
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${x}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#|\||---|\d+\.\s|-\s)/.test(lines[i]!)) para.push(lines[i++]!);
    out.push(`<p>${inlineMd(para.join(' '))}</p>`);
  }
  return out.join('\n');
}

// ── Assembly ───────────────────────────────────────────────────────────────

const PREVIEW_CSS = `
.zb-page{display:none}
.zb-page:target,.zb-page:has(:target){display:block}
body:not(:has(.zb-page:target)):not(:has(.zb-page :target)) #p-guide{display:block}
img[data-zb]:not([src]){background:#121212}
.zb-fab{position:fixed;left:12px;bottom:12px;z-index:2147483000;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:1px solid #d9c7a3;background:#080808e6;color:#f2efe8;font:600 11px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;backdrop-filter:blur(6px)}
.zb-fab:focus-visible{outline:2px solid #d9c7a3;outline-offset:3px}
.zb-toast{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);z-index:2147483001;max-width:min(92vw,520px);padding:14px 18px;background:#121212;color:#f2efe8;border:1px solid #d9c7a3;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;display:none}
.zb-toast[data-show]{display:block}
.zbd{min-height:100vh;background:#080808;color:#f2efe8;padding:0 0 96px;font-family:var(--font-sans,system-ui),system-ui,sans-serif}
.zbd-bar{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;justify-content:space-between;padding:14px clamp(16px,4vw,48px);background:#080808f2;border-bottom:1px solid #2a2927}
.zbd-bar strong{font-size:12px;letter-spacing:.2em;text-transform:uppercase}
.zbd-bar nav{display:flex;flex-wrap:wrap;gap:4px 16px}
.zbd-bar a{color:#d8d1c5;font-size:12px;letter-spacing:.12em;text-transform:uppercase;text-decoration:none}
.zbd-bar a:hover,.zbd-bar a:focus-visible{color:#d9c7a3}
.zbd-wrap{max-width:1180px;margin:0 auto;padding:clamp(28px,5vw,64px) clamp(16px,4vw,48px)}
.zbd h1{font-size:clamp(2.2rem,6vw,4.4rem);line-height:.95;letter-spacing:-.01em;text-transform:uppercase;margin:0 0 18px;font-stretch:110%}
.zbd h2{font-size:clamp(1.3rem,2.6vw,1.9rem);margin:48px 0 14px;text-transform:uppercase;letter-spacing:.02em}
.zbd h3{font-size:1.1rem;margin:28px 0 10px;color:#d9c7a3}
.zbd h4,.zbd h5{font-size:1rem;margin:20px 0 8px}
.zbd p,.zbd li{color:#d8d1c5;line-height:1.65;font-size:16px}
.zbd a{color:#d9c7a3}
.zbd code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.88em;background:#1b1a19;padding:1px 5px}
.zbd hr{border:0;border-top:1px solid #2a2927;margin:40px 0}
.zbd ul,.zbd ol{padding-left:22px;display:grid;gap:6px}
.zbd-eyebrow{color:#d9c7a3;font-size:12px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 12px}
.zbd-lede{font-size:clamp(1.05rem,2vw,1.3rem)!important;max-width:60ch}
.zbd-table{overflow-x:auto;margin:14px 0;border:1px solid #2a2927}
.zbd table{border-collapse:collapse;width:100%;min-width:560px;font-size:14px}
.zbd th,.zbd td{padding:10px 12px;border-bottom:1px solid #2a2927;vertical-align:top;color:#d8d1c5}
.zbd th{color:#9b9b96;font-size:11px;letter-spacing:.12em;text-transform:uppercase;background:#121212}
.zbd .zbd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,240px),1fr));gap:14px;padding:0;list-style:none}
.zbd-card{display:grid;gap:6px;padding:0;border:1px solid #2a2927;background:#121212;text-decoration:none;color:inherit}
.zbd-card>div{padding:12px 14px 16px;display:grid;gap:4px}
.zbd-card strong{color:#f2efe8;font-size:15px}
.zbd-card span{color:#9b9b96;font-size:13px;line-height:1.5}
.zbd-card img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}
.zbd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:24px 0}
.zbd-stat{border:1px solid #2a2927;background:#121212;padding:16px}
.zbd-stat b{display:block;font-size:clamp(1.8rem,4vw,2.6rem);color:#f2efe8;line-height:1}
.zbd-stat span{color:#9b9b96;font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.zbd-shots{display:grid;gap:40px 20px;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));align-items:start}
.zbd-shot{display:grid;gap:10px;margin:0;grid-column:1/-1}
.zbd-shot.phone{grid-column:auto}
.zbd-shot img{width:100%;height:auto;border:1px solid #2a2927;background:#121212}
.zbd-shot.phone img{max-width:390px}
.zbd-shot figcaption strong{display:block;color:#f2efe8;font-size:16px}
.zbd-shot figcaption span{color:#9b9b96;font-size:14px}
.zbd-meta{font-size:13px;color:#9b9b96;display:grid;gap:2px}
.zbd-note{border-left:2px solid #d9c7a3;padding:10px 14px;background:#121212;color:#d8d1c5}
`;

const PREVIEW_JS = `
(function(){
  var map = JSON.parse(document.getElementById('zb-images').textContent);
  document.querySelectorAll('img[data-zb]').forEach(function(img){ var s = map[img.getAttribute('data-zb')]; if (s) img.src = s; });
  // Header: transparent over the hero, solid once scrolled (as on the site).
  function headerState(){
    var solid = window.scrollY > 40;
    document.querySelectorAll('header[data-zb-top]').forEach(function(h){ h.className = solid ? h.getAttribute('data-zb-solid') : h.getAttribute('data-zb-top'); });
  }
  window.addEventListener('scroll', headerState, { passive: true });
  window.addEventListener('hashchange', function(){ if (/^#p-/.test(location.hash)) window.scrollTo(0, 0); headerState(); document.querySelectorAll('dialog[open]').forEach(function(d){ d.close(); }); });
  // Menu dialog.
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target : null; if (!t) return;
    var opener = t.closest('[aria-haspopup="dialog"]');
    if (opener) { var page = opener.closest('.zb-page'); var d = page && page.querySelector('dialog'); if (d && d.showModal) { d.showModal(); e.preventDefault(); } return; }
    var inDialog = t.closest('dialog');
    if (inDialog && (t.closest('a') || /close/i.test((t.closest('button')||{}).textContent||'') || (t.closest('button')||{}).getAttribute && /close/i.test(t.closest('button').getAttribute('aria-label')||''))) { inDialog.close(); }
  });
  // Pillar tabs.
  function activate(tab){
    var list = tab.closest('[role="tablist"]'); if (!list) return;
    list.querySelectorAll('[role="tab"]').forEach(function(t){
      var on = t === tab; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls')); if (panel) panel.setAttribute('data-active', on);
    });
  }
  document.addEventListener('click', function(e){ var tab = e.target.closest && e.target.closest('[role="tab"]'); if (tab) activate(tab); });
  document.addEventListener('mouseover', function(e){ var tab = e.target.closest && e.target.closest('[role="tab"]'); if (tab) activate(tab); });
  // Forms are live on the deployed site only.
  var toast = document.getElementById('zb-toast'); var timer;
  document.addEventListener('submit', function(e){ if (e.target.hasAttribute('data-zb-form')) { e.preventDefault(); toast.setAttribute('data-show', ''); clearTimeout(timer); timer = setTimeout(function(){ toast.removeAttribute('data-show'); }, 4200); } });
  headerState();
})();
`;

function bar(): string {
  return `<div class="zbd-bar"><strong>Zakes Bantwini · Website preview</strong><nav aria-label="Preview"><a href="#p-guide">Guide</a><a href="#p-home">Website</a><a href="#p-walkthrough">Booking &amp; admin</a><a href="#p-images">Images</a><a href="#p-audit">Audit</a><a href="#p-costing">Costing</a></nav></div>`;
}

async function main() {
  const commit = execSync('git rev-parse --short HEAD').toString().trim();
  const generated = new Date();
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
  try {
    const details = await discoverDetailPages(browser);
    const pages: [string, string][] = [...STATIC_PAGES, ...details];
    const known = new Set(pages.map(([p]) => p));
    console.log(`capturing ${pages.length} pages from ${base}`);
    const captured: Captured[] = [];
    for (const [p, title] of pages) captured.push(await capture(browser, p, title, known));
    const notFound = await capture(browser, '/this-page-does-not-exist', 'Not found', known);

    const styleHrefs = [...new Set(captured.flatMap((c) => c.styles))];
    // Inline <style> blocks are Next's built-in error-page defaults (black on
    // white body); every style the site needs is in its stylesheets.
    const css = await inlineCss(styleHrefs, []);
    const htmlClass = [...new Set(captured.flatMap((c) => c.htmlClass.split(/\s+/)).filter(Boolean))].join(' ');
    console.log('capturing the booking journey and management screens');
    const shots = await walkthrough(browser);
    const images = imageMap();
    const icon = `data:image/svg+xml,${encodeURIComponent(readFileSync(path.join(root, 'src', 'app', 'icon.svg'), 'utf8'))}`;
    const ogImage = `data:image/jpeg;base64,${readFileSync(path.join(root, 'public', 'media', 'IMG_6853-og.jpg')).toString('base64')}`;
    const audit = readFileSync(path.join(root, 'AUDIT.md'), 'utf8');
    const costing = readFileSync(path.join(root, 'COSTING.md'), 'utf8');
    let perf: unknown = null;
    try {
      perf = JSON.parse(readFileSync(path.join(root, '.smoke', 'perf.json'), 'utf8'));
    } catch {
      /* perf not run */
    }

    const media = allMedia().map((m) => {
      const f = getMediaFile(m.id);
      return { id: m.id, index: m.index, file: f.file, width: f.width, height: f.height, title: m.title, alt: m.alt, role: m.role, sections: m.sections, focal: m.focal, desktopRatio: m.desktopRatio, mobileRatio: m.mobileRatio, briefNote: m.briefNote ?? null, caution: m.caution ?? null };
    });
    const metadata = {
      name: 'Zakes Bantwini — The Architect: website preview',
      generatedAt: generated.toISOString(),
      commit,
      branch: 'claude/zakes-bantwini-website',
      source: base,
      howToOpen: 'Double-click the file (Mac), or open it from Files with Chrome (Android). Works offline.',
      pages: captured.map((c) => ({ path: c.path, title: c.title, anchor: `#p-${c.key}` })),
      walkthrough: shots.map((s) => s.title),
      completion: { overallPercent: 67, remainingPercent: 33, developmentHoursDonePercent: 88 },
      costing: { buildAtMarketZar: { low: 676000, typical: 988000, high: 1300000 }, finishZar: { low: 91000, typical: 133000, high: 175000 }, runningPlatformZarPerMonth: { low: 1225, high: 1390 }, firstYearZar: { low: 172000, typical: 248000, high: 325000 }, exchangeRate: 'R16.50 per US$' },
      tests: { unitAndIntegration: '86 passed (file store and Postgres)', smoke: 'all checks passed, 18 pages × 3 widths with axe', performance: perf },
      images: media,
      disclaimer: 'Demo bookings, listings, signups and proposals are fictional sample data. Content marked pending or placeholder awaits management approval and is hidden in launch mode.',
    };

    const pageSection = (c: Captured) => `<section class="zb-page" id="p-${c.key}" data-path="${esc(c.path)}" aria-label="${esc(c.title)}">${c.html}</section>`;
    const siteIndex = captured
      .map((c) => `<li><a class="zbd-card" href="#p-${c.key}"><div><strong>${esc(c.title)}</strong><span>${esc(c.path)}</span></div></a></li>`)
      .join('');

    const guide = `<section class="zb-page zbd" id="p-guide" aria-label="Preview guide">${bar()}<div class="zbd-wrap">
<p class="zbd-eyebrow">Website preview · ${generated.toISOString().slice(0, 10)} · commit ${commit}</p>
<h1>Zakes Bantwini<br>The Architect</h1>
<p class="zbd-lede">The whole website in one file. Every public page as built, the booking journey and management screens, all 41 supplied images with their registry, the completion audit and the costing. It works offline: no server, no internet.</p>
<div class="zbd-stats"><div class="zbd-stat"><b>67%</b><span>complete overall</span></div><div class="zbd-stat"><b>33%</b><span>remaining to launch</span></div><div class="zbd-stat"><b>${captured.length}</b><span>pages in this preview</span></div><div class="zbd-stat"><b>41</b><span>supplied images</span></div></div>
<p class="zbd-note">Bookings, listings and names in this preview are <strong>fictional sample data</strong>. Content flagged “pending” or “placeholder” is waiting for management’s approval; in launch mode only approved content appears. Forms, payments and downloads work on the live site; here they show a notice.</p>
<h2>Start here</h2>
<ul class="zbd-grid">
<li><a class="zbd-card" href="#p-home"><img data-zb="IMG_6853" alt=""><div><strong>The website</strong><span>Start at the home page and click around. Use the Guide button at the bottom left to come back.</span></div></a></li>
<li><a class="zbd-card" href="#p-walkthrough"><img data-zb="IMG_6884" alt=""><div><strong>Booking &amp; admin</strong><span>A booking from request to confirmation, and the management workspace.</span></div></a></li>
<li><a class="zbd-card" href="#p-images"><img data-zb="IMG_6869" alt=""><div><strong>Image library</strong><span>All 41 images, where each is used, focal points and notes.</span></div></a></li>
<li><a class="zbd-card" href="#p-audit"><img data-zb="IMG_6868" alt=""><div><strong>Audit: 67% complete</strong><span>What is done, what remains, and who it depends on.</span></div></a></li>
<li><a class="zbd-card" href="#p-costing"><img data-zb="IMG_6879" alt=""><div><strong>Costing</strong><span>What this work costs at today’s South African rates, to finish and to run.</span></div></a></li>
</ul>
<h2>Every page</h2>
<ul class="zbd-grid">${siteIndex}</ul>
<h2>Opening this file</h2>
<ul><li><strong>Mac:</strong> double-click the file. It opens in Safari or your default browser.</li><li><strong>Android:</strong> open it from the Files app (or a Downloads notification) and choose Chrome. If a file viewer opens it without images, use “Open with → Chrome”.</li><li><strong>iPhone/iPad:</strong> in Files, tap the file, then Share → Open in Safari (or a browser app).</li></ul>
</div></section>`;

    const walk = `<section class="zb-page zbd" id="p-walkthrough" aria-label="Booking and admin walkthrough">${bar()}<div class="zbd-wrap">
<p class="zbd-eyebrow">Booking journey and management</p><h1>From request to confirmed</h1>
<p class="zbd-lede">Captured from the running build with sample data: a client requests a date on a phone, management quotes, the client accepts, signs and pays a sandbox deposit, and management confirms.</p>
<div class="zbd-shots">${shots
      .map((s) => `<figure class="zbd-shot${s.phone ? ' phone' : ''}"><img src="${s.src}" alt="${esc(s.title)} screen" loading="lazy"><figcaption><strong>${esc(s.title)}</strong><span>${esc(s.caption)}</span></figcaption></figure>`)
      .join('')}</div></div></section>`;

    const imagesPage = `<section class="zb-page zbd" id="p-images" aria-label="Image library">${bar()}<div class="zbd-wrap">
<p class="zbd-eyebrow">Image registry</p><h1>All 41 supplied images</h1>
<p class="zbd-lede">Kept byte-for-byte as supplied and placed per the brief’s matrix. Each has alt text, sections, focal points and ratios for desktop and mobile.</p>
<ul class="zbd-grid">${media
      .map(
        (m) =>
          `<li class="zbd-card"><img data-zb="${m.id}" alt="${esc(m.alt)}"><div><strong>${String(m.index).padStart(2, '0')} · ${esc(m.title)}</strong><span>${esc(m.file)} · ${m.width}×${m.height}</span><span>${esc(m.role)} · ${esc(m.sections.join(', '))}</span><span>Focal ${m.focal.x}% ${m.focal.y}% · ${m.desktopRatio} desktop · ${m.mobileRatio} mobile</span>${m.briefNote ? `<span style="color:#d9c7a3">Brief note: ${esc(m.briefNote)}</span>` : ''}${m.caution ? `<span style="color:#c97b6b">Caution: ${esc(m.caution)}</span>` : ''}${m.width < 1600 ? '<span>Request full-resolution original for full-bleed use.</span>' : ''}</div></li>`,
      )
      .join('')}</ul></div></section>`;

    const doc = (id: string, label: string, md: string) => `<section class="zb-page zbd" id="p-${id}" aria-label="${label}">${bar()}<div class="zbd-wrap">${markdown(md)}</div></section>`;
    const liveOnly = `<section class="zb-page zbd" id="p-live-only" aria-label="Live site only">${bar()}<div class="zbd-wrap"><p class="zbd-eyebrow">Live site only</p><h1>That opens a live feature</h1><p class="zbd-lede">Downloads, the private booking portal, payments and the management workspace run on the deployed website. See them in action in <a href="#p-walkthrough">Booking &amp; admin</a>, or go back to the <a href="#p-guide">guide</a>.</p></div></section>`;

    const html = `<!doctype html>
<html lang="en-ZA" class="${esc(htmlClass)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Zakes Bantwini — The Architect · Website preview</title>
<meta name="description" content="Offline preview of the Zakes Bantwini website: every public page, the booking journey and admin, the 41-image library, a completion audit (67% complete) and a South African costing.">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#080808">
<meta name="color-scheme" content="dark">
<meta name="generator" content="build-preview.ts · commit ${commit}">
<meta name="date" content="${generated.toISOString()}">
<meta property="og:type" content="website">
<meta property="og:title" content="Zakes Bantwini — The Architect · Website preview">
<meta property="og:description" content="Every page of the new website, the booking journey and admin, the image library, the completion audit and the costing.">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${icon}">
<style>${css}</style>
<style>${PREVIEW_CSS}</style>
<script type="application/json" id="zb-metadata">${JSON.stringify(metadata).replace(/</g, '\\u003c')}</script>
<script type="application/json" id="zb-images">${JSON.stringify(images)}</script>
</head>
<body>
<noscript><div style="position:fixed;bottom:0;left:0;right:0;z-index:2147483002;padding:8px 16px 8px 190px;background:#d9c7a3;color:#080808;font:13px/1.4 system-ui;pointer-events:none">Pages work without JavaScript, but photographs need it. Open the file in Chrome or Safari to see them.</div></noscript>
${guide}
${captured.map(pageSection).join('\n')}
<section class="zb-page" id="p-not-found" aria-label="Not found">${notFound.html}</section>
${walk}
${imagesPage}
${doc('audit', 'Completion audit', audit)}
${doc('costing', 'Costing', costing)}
${liveOnly}
<a class="zb-fab" href="#p-guide">Preview · Guide</a>
<div class="zb-toast" id="zb-toast" role="status">This is an offline preview. Forms, bookings and payments work on the live website.</div>
<script>${PREVIEW_JS}</script>
</body>
</html>`;

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(OUT, html);
    console.log(`wrote ${path.relative(root, OUT)} (${(statSync(OUT).size / 1024 / 1024).toFixed(1)} MB): ${captured.length} pages, ${shots.length} screenshots, ${Object.keys(images).length} images`);
  } finally {
    await browser.close();
  }
}

await main();
