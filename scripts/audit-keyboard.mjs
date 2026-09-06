#!/usr/bin/env node
/**
 * Order food without touching a mouse.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `audit:screens` checks that focusable elements draw a visible focus ring, and
 * it does that by calling `el.focus()` directly. That is the right check for
 * §32.6 and it answers a narrower question than it looks like: it proves a ring
 * appears *if* something is focused, not that anything can be focused by
 * pressing Tab, nor that a control does anything when Enter lands on it.
 *
 * The gap matters because React Native Web decides on its own which of its
 * `Pressable`s become tabbable, and because it is the kind of thing that breaks
 * quietly — nothing renders differently, no test fails, and a customer who
 * navigates by keyboard simply cannot buy anything.
 *
 * So this drives the journey rather than inspecting it. Every step below is a
 * key press: Tab to move, Enter to act, Escape to back out. No clicks at all,
 * with one exception that is stated where it happens.
 *
 * WCAG 2.1.1 (Keyboard) and 2.4.3 (Focus Order) are the standards; "can this
 * person order dinner" is the test.
 *
 * Needs Playwright's Chromium. Point CHROMIUM_PATH at an existing one.
 *
 * Run: npm run audit:keyboard
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-keyboard');
const PORT = 8131;

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      let file = path.resolve(OUT, '.' + pathname);
      if (file !== OUT && !file.startsWith(OUT + path.sep)) file = path.join(OUT, 'index.html');
      if (!path.extname(file) || !existsSync(file) || statSync(file).isDirectory()) {
        file = path.join(OUT, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
      createReadStream(file).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const findings = [];
const steps = [];
const step = (text) => {
  steps.push(text);
  console.log(`  ✓ ${text}`);
};

console.log('Building the web bundle…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '1' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  /** What has focus, as a person navigating by keyboard would understand it. */
  const focused = () =>
    page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 60);
    });

  /**
   * Tab until something matching lands, or give up.
   *
   * Returns the number of presses it took, so an unreasonable distance is
   * itself reportable — a control forty tab stops from the top of a screen is
   * reachable and not usable.
   */
  const tabTo = async (pattern, limit = 60) => {
    for (let i = 1; i <= limit; i += 1) {
      await page.keyboard.press('Tab');
      const label = await focused();
      if (label && pattern.test(label)) return { presses: i, label };
    }
    return null;
  };

  const press = async (key) => {
    await page.keyboard.press(key);
    await page.waitForTimeout(900);
  };

  // ── Sign in, by keyboard ────────────────────────────────────────────────
  await page.goto(`http://localhost:${PORT}/sign-in`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);

  const email = await tabTo(/email/i, 20);
  if (!email) {
    findings.push('Tab never reaches the email field on the sign-in screen');
  } else {
    await page.keyboard.type('loyal@example.co.za');
    await page.keyboard.press('Tab');
    await page.keyboard.type('chickenchicken');
    step(`reached the sign-in form in ${email.presses} tab stops and typed into it`);

    const submit = await tabTo(/sign in|log in/i, 12);
    if (!submit) {
      findings.push('Tab never reaches the sign-in button from the password field');
    } else {
      await press('Enter');
      await page.waitForTimeout(2500);
      const signedIn = !new URL(page.url()).pathname.endsWith('/sign-in');
      if (!signedIn) findings.push('Enter on the sign-in button did not submit the form');
      else step('signed in with Enter, no pointer involved');
    }
  }

  // The location sheet sits over everything; dismissing it is part of the
  // journey and has to be doable by keyboard too.
  await page.waitForTimeout(1200);
  const notNow = await tabTo(/not now/i, 25);
  if (notNow) {
    await press('Enter');
    step('dismissed the location prompt with Enter');
  }

  // ── Reach a product and add it, by keyboard ─────────────────────────────
  await page.goto(`http://localhost:${PORT}/product/golden-original`, {
    waitUntil: 'networkidle',
    timeout: 45000,
  });
  await page.waitForTimeout(2500);

  const addToCart = await tabTo(/add to cart|add to basket/i, 60);
  if (!addToCart) {
    findings.push('Tab never reaches "Add to cart" on a product screen');
  } else {
    if (addToCart.presses > 40) {
      findings.push(
        `"Add to cart" is ${addToCart.presses} tab stops from the top of the product screen — reachable, but not usably so`,
      );
    }
    await press('Enter');
    step(`added a product to the basket in ${addToCart.presses} tab stops, with Enter`);
  }

  // ── The cart, and the dialog it can raise ───────────────────────────────
  await page.goto(`http://localhost:${PORT}/cart`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);

  /**
   * The dialog is the part most likely to be wrong, because a modal that is
   * merely drawn over a page leaves the page behind it tabbable — and a
   * keyboard user then walks out of the question they were asked without
   * answering it.
   */
  const clear = await tabTo(/empty cart/i, 20);
  if (!clear) {
    findings.push('Tab never reaches the cart’s clear control');
  } else {
    await press('Enter');
    const dialogOpen = await page.evaluate(() =>
      Boolean(document.querySelector('[data-testid="dialog"]')),
    );
    if (!dialogOpen) {
      findings.push('Enter on the cart’s clear control did not open the confirmation');
    } else {
      step('opened the confirmation dialog with Enter');

      /*
        The first thing a keyboard user meets. The scrim used to be a focusable
        control called "Dismiss" sitting ahead of everything, so the tab cycle
        opened by offering to close the question before asking it.
      */
      await page.keyboard.press('Tab');
      const first = await focused();
      if (first && /dismiss/i.test(first)) {
        findings.push('the first tab stop inside the dialog is the scrim, announced as "Dismiss"');
      } else {
        step(`the first tab stop inside the dialog is ${first ?? '(nothing)'}`);
      }

      // Every tab stop while it is open must be inside the modal.
      const escaped = [];
      for (let i = 0; i < 8; i += 1) {
        await page.keyboard.press('Tab');
        const inModal = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return false;
          // The card, or the scrim that belongs to the same modal.
          return Boolean(
            el.closest('[data-testid="dialog"]') || el.closest('[data-testid="dialog-scrim"]'),
          );
        });
        if (!inModal) escaped.push((await focused()) ?? '(nothing)');
      }
      if (escaped.length > 0) {
        findings.push(
          `focus leaves the open dialog after ${8 - escaped.length} tab stops — reached ${escaped[0]}`,
        );
      } else {
        step('focus stayed inside the dialog across eight tab stops');
      }

      /**
       * What a keyboard user meets first. The scrim is a click convenience —
       * tapping outside dismisses — and putting it in the tab order means the
       * first thing announced is a control called "Dismiss" rather than the
       * question being asked.
       */
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const stillOpen = await page.evaluate(() =>
        Boolean(document.querySelector('[data-testid="dialog"]')),
      );
      if (stillOpen) findings.push('Escape did not close the dialog');
      else step('closed the dialog with Escape');

      const returned = await focused();
      if (!returned || !/empty cart/i.test(returned)) {
        findings.push(
          `focus did not return to the control that opened the dialog — it is on ${returned ?? '(nothing)'}`,
        );
      } else {
        step('focus returned to the control that opened it');
      }
    }
  }

  // ── Checkout, as far as the button that takes money ─────────────────────
  await page.goto(`http://localhost:${PORT}/checkout`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(3000);

  const placeOrder = await tabTo(/place order/i, 70);
  if (!placeOrder) {
    findings.push('Tab never reaches "Place order" on the checkout screen');
  } else {
    step(`reached "Place order" in ${placeOrder.presses} tab stops`);
    await press('Enter');
    await page.waitForTimeout(3500);
    const placed = /confirmation/.test(page.url());
    if (!placed) {
      const why = await page.evaluate(() => document.body.innerText.slice(0, 200));
      findings.push(`Enter on "Place order" did not place one. The screen says: ${why.trim()}`);
    } else {
      step('placed the order with Enter — the whole journey, no pointer');
    }
  }

  await context.close();
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${steps.length} step(s) completed by keyboard alone.`);

if (findings.length === 0) {
  console.log('A customer who never touches the screen can order dinner.');
  process.exit(0);
}

console.log(`\n${findings.length} finding(s):\n`);
for (const finding of findings) console.log(`  ✗ ${finding}`);
console.log(
  '\nWCAG 2.1.1: everything the pointer can do, the keyboard must be able to do too.',
);
process.exit(1);
