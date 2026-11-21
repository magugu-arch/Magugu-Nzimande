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
import { mkdirSync, rmSync } from 'node:fs';
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

/** persona: who to sign in as before visiting. `null` is signed out. */
const SCREENS = [
  { name: 'welcome', path: '/', persona: null },
  { name: 'sign-in', path: '/sign-in/', persona: null },
  { name: 'home', path: '/home/', persona: 'Thandi M.' },
  { name: 'home-visitor', path: '/home/', persona: 'Aisha K.' },
  { name: 'services', path: '/services/', persona: null },
  { name: 'service-smart-id', path: '/services/smart-id-replacement/', persona: null },
  { name: 'service-eta', path: '/services/eta/', persona: null },
  { name: 'service-resident', path: '/services/resident-services/', persona: null },
  { name: 'search', path: '/search/?q=passport', persona: 'Thandi M.' },
  { name: 'guide', path: '/guide/', persona: null },
  { name: 'apply', path: '/apply/?service=SMART_ID_REPLACEMENT', persona: 'Thandi M.' },
  { name: 'applications', path: '/applications/', persona: 'Thandi M.' },
  { name: 'case-action', path: '/applications/case/?id=CASE-DEMO-000041', persona: 'Thandi M.' },
  {
    name: 'case-production',
    path: '/applications/case/?id=CASE-DEMO-002481',
    persona: 'Thandi M.',
  },
  { name: 'appointments', path: '/appointments/?case=CASE-DEMO-000041', persona: 'Thandi M.' },
  { name: 'messages', path: '/messages/', persona: 'Thandi M.' },
  { name: 'messages-empty', path: '/messages/', persona: 'Aisha K.', method: 'passkey-or-code' },
  { name: 'message-prefs', path: '/messages/preferences/', persona: 'Thandi M.' },
  { name: 'whatsapp', path: '/messages/whatsapp/', persona: 'Thandi M.' },
  { name: 'help', path: '/help/', persona: null },
  { name: 'help-callback', path: '/help/callback/', persona: 'Thandi M.' },
  { name: 'official-channels', path: '/help/official-channels/', persona: null },
  { name: 'service-points', path: '/service-points/', persona: null },
  { name: 'service-point', path: '/service-points/point/?id=SP-DEMO-1001', persona: null },
  { name: 'abroad', path: '/abroad/', persona: 'Lerato N.' },
  { name: 'profile', path: '/profile/', persona: 'Thandi M.' },
  { name: 'profile-security', path: '/profile/security/', persona: 'Thandi M.' },
  { name: 'profile-family', path: '/profile/family/', persona: 'Sipho D.' },
  { name: 'profile-privacy', path: '/profile/privacy/', persona: 'Thandi M.' },
  { name: 'profile-accessibility', path: '/profile/accessibility/', persona: null },
  { name: 'prototype-controls', path: '/profile/prototype/', persona: 'Thandi M.' },
  { name: 'wallet', path: '/wallet/', persona: 'Thandi M.' },
  { name: 'more', path: '/more/', persona: 'Thandi M.' },
  { name: 'about', path: '/about/', persona: null },
  { name: 'staff-sign-in', path: '/staff/', persona: null },
  { name: 'staff-queue', path: '/staff/queue/', persona: 'staff:Nomsa P.' },
  { name: 'staff-case', path: '/staff/case/?id=CASE-DEMO-000063', persona: 'staff:Nomsa P.' },
  { name: 'staff-dashboard', path: '/staff/dashboard/', persona: 'staff:Nomsa P.' },
  { name: 'staff-audit', path: '/staff/audit/', persona: 'staff:Nomsa P.' },
  { name: 'partner', path: '/partner/', persona: 'partner:Sample Bank (demo)' },
];

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
