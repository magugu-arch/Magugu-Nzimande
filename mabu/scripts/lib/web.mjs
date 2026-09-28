/** Serves the web export and launches Chromium — shared by screens.mjs and journeys.mjs. */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dist = path.join(root, 'dist-web');

const TYPES = {
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

export async function startWeb() {
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('No web export found. Run `npm run export:web` first.');
    process.exit(1);
  }
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    let file = path.join(dist, url);
    if (!file.startsWith(dist) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(dist, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium
    .launch(
      fs.existsSync('/opt/pw-browsers/chromium')
        ? { executablePath: '/opt/pw-browsers/chromium' }
        : {},
    )
    .catch(() => chromium.launch());
  return {
    base,
    browser,
    async stop() {
      await browser.close();
      server.close();
    },
  };
}

/** Signs in through the real screen with the mock one-time code. */
export async function signIn(page, base, email, name) {
  await page.goto(`${base}/sign-in`, { waitUntil: 'networkidle' });
  await fillSignIn(page, email, name);
}

export async function fillSignIn(page, email, name) {
  // By test id: the sign-in modal can sit over a screen with its own Email field.
  await page.getByTestId('signin-email').fill(email);
  if (name) await page.getByLabel('Your name (new guests)').fill(name);
  await page.getByTestId('signin-send').click();
  await page.getByTestId('signin-code').fill('123456');
  await page.getByTestId('signin-verify').click();
  await page.waitForTimeout(1200);
}
