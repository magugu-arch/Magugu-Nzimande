#!/usr/bin/env node
/**
 * Captures screens from the static export for visual review.
 *
 *   npm run build && node scripts/capture-screens.mjs [--only home,welcome] [--device phone|desktop|both]
 *                                                     [--scale 2] [--slice 1500] [--out .shots]
 *
 * Signs in through the real mock sign-in screen (no shortcuts), so what is
 * captured is what a person would see. Output is git-ignored.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const only = flag('only', '')?.split(',').filter(Boolean) ?? [];
const device = flag('device', 'both');
const scale = Number(flag('scale', '1'));
const slice = Number(flag('slice', '0'));
const outDir = path.resolve(root, flag('out', '.shots'));
const port = Number(flag('port', '4188'));
const base = `http://127.0.0.1:${port}`;

/** The screen list is shared with the Playwright suites. `persona: null` is signed out. */
const SCREENS = JSON.parse(readFileSync(path.join(root, 'tests', 'routes.json'), 'utf8'));

const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 860 } },
};

async function signIn(page, persona) {
  if (persona.startsWith('staff:') || persona.startsWith('partner:')) {
    const [kind, name] = persona.split(':');
    await page.goto(`${base}/${kind}/`);
    await page
      .getByRole('button', { name: new RegExp(name.replace(/[()]/g, '\\$&')) })
      .first()
      .click();
    await page.waitForTimeout(600);
    return;
  }
  await page.goto(`${base}/sign-in/`);
  await page.getByRole('button', { name: new RegExp(persona) }).click();
  const passkey = page.getByRole('button', { name: 'Continue with passkey' });
  if (await passkey.count()) {
    await passkey.click();
  } else {
    await page.getByLabel('6-digit code').fill('123456');
    await page.getByRole('button', { name: 'Sign in with code' }).click();
  }
  await page.waitForURL('**/home/');
}

const server = spawn(
  'node',
  [path.join(root, 'scripts/serve-static.mjs'), path.join(root, 'apps/web/out'), String(port)],
  {
    stdio: 'ignore',
  },
);
await new Promise((resolve) => setTimeout(resolve, 500));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
});
const problems = [];
try {
  for (const [deviceName, options] of Object.entries(DEVICES)) {
    if (device !== 'both' && device !== deviceName) continue;
    const wanted = SCREENS.filter((screen) => only.length === 0 || only.includes(screen.name));
    // One browser context per persona, so each signs in once.
    const personas = [...new Set(wanted.map((screen) => screen.persona))];
    for (const persona of personas) {
      const context = await browser.newContext({
        // Still frames: no entrance animations or parallax, so every slice shows the settled layout.
        reducedMotion: 'reduce',
        ...options,
        deviceScaleFactor: scale,
        reducedMotion: 'reduce',
      });
      const page = await context.newPage();
      page.on('console', (message) => {
        if (message.type() === 'error')
          problems.push(`${deviceName} console: ${message.text().slice(0, 200)}`);
      });
      page.on('pageerror', (error) =>
        problems.push(`${deviceName} pageerror: ${error.message.slice(0, 200)}`),
      );
      try {
        if (persona) await signIn(page, persona);
      } catch (error) {
        problems.push(`${deviceName} sign-in as ${persona} failed: ${String(error).slice(0, 160)}`);
      }
      for (const screen of wanted.filter((item) => item.persona === persona)) {
        const response = await page
          .goto(base + screen.path, { waitUntil: 'networkidle' })
          .catch(() => null);
        if (!response || response.status() >= 400) {
          problems.push(`${deviceName} ${screen.name}: HTTP ${response?.status() ?? 'failed'}`);
          continue;
        }
        await page.waitForTimeout(700);
        // Walk the page once so lazily loaded photographs are in the picture.
        await page.evaluate(async () => {
          const step = window.innerHeight;
          for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
          window.scrollTo(0, 0);
          await Promise.all(
            [...document.images]
              .filter((img) => !img.complete)
              .map((img) => img.decode().catch(() => {})),
          );
        });
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        if (overflow > 1)
          problems.push(`${deviceName} ${screen.name}: horizontal overflow ${overflow}px`);
        const file = path.join(outDir, `${screen.name}.${deviceName}`);
        if (slice > 0) {
          const height = await page.evaluate(() => document.documentElement.scrollHeight);
          const width = options.viewport.width;
          for (let top = 0, part = 1; top < height; top += slice, part += 1) {
            await page.screenshot({
              path: `${file}.${part}.png`,
              fullPage: true,
              clip: { x: 0, y: top, width, height: Math.min(slice, height - top) },
            });
          }
        } else {
          await page.screenshot({ path: `${file}.png`, fullPage: true });
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`screens written to ${outDir}`);
if (problems.length)
  console.log(`problems (${problems.length}):\n  - ${[...new Set(problems)].join('\n  - ')}`);
