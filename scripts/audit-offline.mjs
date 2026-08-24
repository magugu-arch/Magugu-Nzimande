#!/usr/bin/env node
/**
 * What every screen says when it cannot reach the server.
 *
 * This is not a hypothetical. It is the state the app is in if the API is not
 * ready on opening day, during any outage, and on any phone that has walked
 * into a dead spot — which in South Africa is an ordinary Tuesday.
 *
 * The first run of this found eleven of fourteen screens claiming something
 * false rather than admitting they could not reach the server:
 *
 *     /offers                   "No offers right now · Nothing running"
 *     /orders                   "No orders on the go"
 *     /account/payment-methods  "No payment methods saved"
 *     /rewards/vouchers         "No vouchers yet"
 *
 * Every one of those is a statement about the world made by an app that had
 * just failed to look at the world. The rule this enforces: **an empty state
 * is a claim about the world, an error state is a claim about the app, and a
 * screen that has not fetched anything is only entitled to the second.**
 *
 * Run: npm run audit:offline
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.audit-nobackend');
const PORT = 8161;

/**
 * Screens whose whole job is to show fetched data. Each one, with no server,
 * must say so rather than describe an empty world.
 */
const ROUTES = [
  '/menu',
  '/offers',
  '/orders',
  '/rewards',
  '/rewards/vouchers',
  '/account/payment-methods',
  '/account/notifications',
  '/checkout/store',
  '/product/golden-original',
  '/order/order-4821',
];

/** Copy that admits the app could not reach the server. */
const HONEST = /Something went wrong|couldn't load|can't reach|You're offline|Try again/i;

/**
 * Copy that asserts a fact about the customer or the business. Harmless when
 * the data really did arrive and really was empty; a lie when it did not.
 */
const CLAIMS = [
  [/No offers right now|Nothing running/i, 'claims the business is running no offers'],
  [/No orders on the go|Nothing cooking/i, 'claims the customer has no orders'],
  [/No vouchers yet/i, 'claims the customer has no vouchers'],
  [/No payment methods saved/i, 'claims the customer has no saved cards'],
  [/came off the menu|can't find that item/i, 'blames the menu for a failed fetch'],
];

const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf',
  '.ico': 'image/x-icon', '.json': 'application/json', '.svg': 'image/svg+xml',
};

function serve() {
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(OUT, pathname);
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(OUT, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed.\n  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

console.log('Building with the mock layer off…');
execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', OUT, '--clear'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  // The point of this sweep: no mock, and a host that does not answer.
  env: { ...process.env, EXPO_PUBLIC_USE_MOCK_API: '0' },
});

const server = await serve();
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

const findings = [];
const rows = [];

try {
  for (const route of ROUTES) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await page.goto(`http://localhost:${PORT}${route}`, {
      waitUntil: 'networkidle',
      timeout: 45000,
    });
    // Long enough for the client timeout and its retries to run out.
    await page.waitForTimeout(14000);

    const text = (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, ' | ');
    const honest = HONEST.test(text);
    const lies = CLAIMS.filter(([pattern]) => pattern.test(text)).map(([, why]) => why);

    rows.push({ route, honest, lies });
    for (const why of lies) findings.push(`${route}: ${why}`);
    if (!honest && lies.length === 0) {
      // Not obviously lying, but not admitting anything either. Worth a look
      // rather than a failure — some screens are legitimately static.
      rows.push({ route, honest: false, lies: [], quiet: true });
    }

    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log('\nroute                          says it could not reach the server');
for (const row of rows.filter((r) => !r.quiet)) {
  const mark = row.honest ? '✓' : '✗';
  const note = row.lies.length > 0 ? `  — ${row.lies.join('; ')}` : '';
  console.log(`  ${mark} ${row.route.padEnd(28)}${note}`);
}

if (findings.length > 0) {
  console.log(`\n${findings.length} screen(s) state something they could not have known:\n`);
  for (const finding of findings) console.log(`  ✗ ${finding}`);
  console.log(
    '\nAn empty state is a claim about the world. A screen that has not fetched\n' +
      'anything is only entitled to say so about itself.',
  );
  process.exit(1);
}

console.log('\nNo screen claims a fact it could not have fetched.');
process.exit(0);
