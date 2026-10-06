#!/usr/bin/env node
/**
 * Mobile performance under throttling (brief §11: "Performance is tested on
 * mobile network conditions"). Each page loads cold in a phone viewport over
 * the Lighthouse "Slow 4G" profile — 150 ms RTT, 1.6 Mbit/s down, 750 kbit/s
 * up — with the CPU slowed 4×, and is held to a budget:
 *
 *   LCP ≤ 4.0 s (Google's "needs improvement" ceiling; lab throttling is
 *   harsher than most real 4G), CLS ≤ 0.1, and a page weight that keeps
 *   booking pages light.
 *
 * Usage: SMOKE_BASE_URL=http://localhost:3000 node e2e/perf.mjs
 *        (or let it start `next start` like the smoke test: npm run perf)
 * Writes .smoke/perf.json.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, '.smoke');
const PORT = Number(process.env.PERF_PORT ?? 3211);
let base = process.env.SMOKE_BASE_URL;
let server;

const PAGES = [
  { path: '/', kb: 1600 },
  { path: '/music', kb: 1600 },
  { path: '/videos', kb: 1600 },
  { path: '/live', kb: 1400 },
  { path: '/architect', kb: 1600 },
  { path: '/story', kb: 1600 },
  { path: '/handover', kb: 1600 },
  { path: '/book', kb: 900 },
  { path: '/book/request', kb: 700 },
  { path: '/journal/what-an-archive-is-for', kb: 1400 },
];
const LCP_MS = 4000;
const CLS = 0.1;

async function startServer() {
  base = `http://localhost:${PORT}`;
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: 'production', APP_SECRET: 'perf-test-secret-that-is-long-enough-1234567', ALLOW_FILE_STORE: 'true', FILE_STORE_PATH: path.join(OUT, 'perf-store.json') },
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 120; i++) {
    if (await fetch(base).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('next start did not come up');
}

async function measure(browser, p) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength));
  await page.addInitScript(() => {
    window.__perf = { lcp: 0, cls: 0 };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__perf.lcp = e.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) window.__perf.cls += e.value;
    }).observe({ type: 'layout-shift', buffered: true });
  });
  const started = Date.now();
  await page.goto(base + p.path, { waitUntil: 'load', timeout: 90_000 });
  const loadMs = Date.now() - started;
  await page.waitForTimeout(2500); // let LCP settle and late shifts land
  const { lcp, cls, fcp } = await page.evaluate(() => ({ ...window.__perf, fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0 }));
  await context.close();
  return { path: p.path, fcp: Math.round(fcp), lcp: Math.round(lcp), cls: Number(cls.toFixed(3)), kb: Math.round(bytes / 1024), loadMs, budgetKb: p.kb };
}

mkdirSync(OUT, { recursive: true });
if (!base) await startServer();
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {});
const results = [];
let problems = 0;
try {
  console.log('Slow 4G (150 ms, 1.6 Mbit/s), 4× CPU, 390×844 @3x, cold cache\n');
  console.log('page'.padEnd(36) + 'FCP'.padStart(8) + 'LCP'.padStart(8) + 'CLS'.padStart(7) + 'weight'.padStart(10));
  for (const p of PAGES) {
    const r = await measure(browser, p);
    results.push(r);
    const bad = [r.lcp > LCP_MS && `LCP ${r.lcp} ms > ${LCP_MS}`, r.cls > CLS && `CLS ${r.cls} > ${CLS}`, r.kb > p.kb && `${r.kb} KB > ${p.kb} KB`].filter(Boolean);
    problems += bad.length;
    console.log(`${bad.length ? '✗' : '✓'} ${r.path.padEnd(34)}${`${r.fcp}ms`.padStart(8)}${`${r.lcp}ms`.padStart(8)}${String(r.cls).padStart(7)}${`${r.kb} KB`.padStart(10)}${bad.length ? `  ${bad.join('; ')}` : ''}`);
  }
} finally {
  await browser.close();
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      /* gone */
    }
  }
}
writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify({ profile: 'Slow 4G, 4x CPU, 390x844@3x, cold', budget: { lcpMs: LCP_MS, cls: CLS }, results }, null, 2));
console.log(problems ? `\n${problems} budget breach(es).` : '\nAll pages within budget.');
process.exit(problems ? 1 : 0);
