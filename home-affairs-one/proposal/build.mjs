#!/usr/bin/env node
/**
 * Builds the proposal deck as a PDF.
 *
 *   npm run build && node proposal/build.mjs
 *
 * 1. Photographs: the chosen masters are resized to JPEG (masters are never changed).
 * 2. Screens: real screens are captured from the built app, signed in through
 *    the mock sign-in, so the deck shows the product as it is.
 * 3. The deck (proposal/src/deck.html) is rendered to
 *    share/Home_Affairs_One_Proposal.pdf, one 1440 × 810 page per slide, and
 *    anything that spills out of a slide or a card is reported.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium, devices } from 'playwright';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const build = path.join(import.meta.dirname, '.build');
const out = path.join(root, 'share', 'Home_Affairs_One_Proposal.pdf');
const site = path.join(root, 'apps', 'web', 'out');
if (!existsSync(path.join(site, 'index.html'))) {
  console.error('Build the app first: npm run build');
  process.exit(1);
}
mkdirSync(path.join(build, 'img'), { recursive: true });
mkdirSync(path.join(build, 'screens'), { recursive: true });

/* 1. Photographs --------------------------------------------------- */
const manifest = JSON.parse(readFileSync(path.join(root, 'assets', 'manifest.json'), 'utf8'));
const assets = new Map((manifest.assets ?? manifest).map((asset) => [asset.id, asset]));
// Full-bleed photographs are wide; the rest sit in cards and strips.
const WIDE = ['A12', 'A07', 'A45', 'A39', 'A60', 'A53'];
const SMALL = ['A19', 'A09', 'A23', 'A15', 'A40', 'A47', 'A14', 'A34', 'A55', 'A41'];
for (const [ids, width] of [
  [WIDE, 1920],
  [SMALL, 900],
]) {
  for (const id of ids) {
    const asset = assets.get(id);
    if (!asset) throw new Error(`unknown asset ${id}`);
    if (asset.review?.status === 'check' || asset.review === 'check')
      throw new Error(`${id} is flagged for review and must not be used in the deck`);
    await sharp(path.join(root, 'assets', 'masters', asset.source))
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toFile(path.join(build, 'img', `${id}.jpg`));
  }
}

/* 2. Screens from the running app ---------------------------------- */
const port = 4391;
const base = `http://127.0.0.1:${port}`;
const server = spawn('node', [path.join(root, 'scripts', 'serve-static.mjs'), site, String(port)], {
  stdio: 'ignore',
});
const routes = JSON.parse(readFileSync(path.join(root, 'tests', 'routes.json'), 'utf8'));
const route = (name) => {
  const found = routes.find((item) => item.name === name);
  if (!found) throw new Error(`no screen called ${name}`);
  return found.path;
};
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
try {
  await new Promise((resolve) => setTimeout(resolve, 700));
  const shoot = async (page, name, file) => {
    await page.goto(base + route(name), { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const png = await page.screenshot();
    await sharp(png)
      .resize({ width: file.startsWith('staff') ? 1500 : 640 })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(path.join(build, 'screens', `${file}.jpg`));
  };

  const phone = await browser.newContext({ ...devices['iPhone 14'], reducedMotion: 'reduce' });
  const page = await phone.newPage();
  await shoot(page, 'welcome', 'welcome');
  await shoot(page, 'service-smart-id', 'service');
  await page.goto(`${base}/sign-in/`);
  await page.getByRole('button', { name: /Thandi M\./ }).click();
  await page.getByRole('button', { name: 'Continue with passkey' }).click();
  await page.waitForURL('**/home/');
  for (const [name, file] of [
    ['home', 'home'],
    ['apply', 'apply'],
    ['case-action', 'track'],
    ['messages', 'messages'],
    ['appointments-case', 'appointments'],
  ]) {
    await shoot(page, name, file);
  }
  await phone.close();

  const desktop = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  const staff = await desktop.newPage();
  await staff.goto(`${base}/staff/`);
  await staff
    .getByRole('button', { name: /Nomsa P\./ })
    .first()
    .click();
  await staff.waitForTimeout(600);
  await shoot(staff, 'staff-queue', 'staff-queue');
  await desktop.close();

  /* 3. Render the deck --------------------------------------------- */
  const deck = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const problems = [];
  deck.on('pageerror', (error) => problems.push(`script error: ${error.message}`));
  deck.on('requestfailed', (request) => problems.push(`failed to load ${request.url()}`));
  await deck.goto(pathToFileURL(path.join(import.meta.dirname, 'src', 'deck.html')).href, {
    waitUntil: 'load',
  });
  await deck.evaluate(() => document.fonts.ready);
  await deck.waitForTimeout(300);
  const report = await deck.evaluate(() => {
    const issues = [];
    const label = (el) => (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34);
    document.querySelectorAll('.page').forEach((slide, index) => {
      const n = index + 1;
      const bounds = slide.getBoundingClientRect();
      slide.querySelectorAll('*').forEach((el) => {
        if (el.closest('svg') || el.classList.contains('bg') || el.classList.contains('shade'))
          return;
        const box = el.getBoundingClientRect();
        if (!box.width || !box.height) return;
        if (box.bottom > bounds.bottom + 0.5 || box.right > bounds.right + 0.5)
          issues.push(
            `slide ${n}: <${el.tagName.toLowerCase()} class="${el.className}"> leaves the slide — "${label(el)}"`,
          );
      });
      slide.querySelectorAll('.card, .cell').forEach((card) => {
        const edge = card.getBoundingClientRect();
        card.querySelectorAll('h3, p, li, b, span, td').forEach((el) => {
          const box = el.getBoundingClientRect();
          if (!box.width || !box.height) return;
          if (box.bottom > edge.bottom + 0.5 || box.right > edge.right + 0.5)
            issues.push(
              `slide ${n}: text spills out of its card by ${Math.round(Math.max(box.bottom - edge.bottom, box.right - edge.right))}px — "${label(el)}"`,
            );
        });
      });
    });
    return { slides: document.querySelectorAll('.page').length, issues: [...new Set(issues)] };
  });
  mkdirSync(path.dirname(out), { recursive: true });
  await deck.pdf({
    path: out,
    width: '1440px',
    height: '810px',
    printBackground: true,
    preferCSSPageSize: true,
  });
  const size = (statSync(out).size / 1024 / 1024).toFixed(1);
  console.log(`proposal: ${path.relative(root, out)} — ${report.slides} slides, ${size} MB`);
  for (const issue of [...problems, ...report.issues]) console.log(`  ! ${issue}`);
  if (problems.length + report.issues.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
