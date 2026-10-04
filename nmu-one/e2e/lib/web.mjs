/**
 * Shared harness for the browser journeys: serves the static web export with
 * an SPA fallback and launches Chromium at phone size.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const root = resolve(fileURLToPath(import.meta.url), '../../..');
export const distDir = join(root, 'dist-web');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
};

export function serve(dir = distDir, port = 0) {
  if (!existsSync(join(dir, 'index.html'))) {
    throw new Error(`No web export at ${dir}. Run \`npm run export:web\` first.`);
  }
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = join(dir, url);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(dir, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => {
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = server.address();
      ok({ url: `http://127.0.0.1:${p}`, close: () => new Promise((c) => server.close(c)) });
    });
  });
}

export async function launch({ width = 390, height = 844 } = {}) {
  // CHROMIUM_PATH, then a preinstalled Chromium, then Playwright's own download.
  const executablePath =
    process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
    locale: 'en-ZA',
    timezoneId: 'Africa/Johannesburg',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return { browser, context, page, errors };
}

/** Taps the element with this testID (React Native web renders it as data-testid). */
export async function tap(page, testID, opts = {}) {
  const el = page.getByTestId(testID).first();
  await el.waitFor({ state: 'visible', timeout: opts.timeout ?? 15_000 });
  await el.click();
}

export async function see(page, text, timeout = 15_000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}

export async function shot(page, dir, name) {
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: false });
}
