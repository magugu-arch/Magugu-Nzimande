#!/usr/bin/env node
/**
 * Live mode, end to end: starts the reference BFF (bff/) and runs the pitch
 * journey against the app built in live mode (npm run export:live), so every
 * screen reads and writes through the HTTP contract, with real sessions and
 * the permission policy enforced on the server.
 *
 *   npm run export:live && npm run e2e:live
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './lib/web.mjs';

if (!existsSync(join(root, 'dist-live', 'index.html'))) {
  throw new Error('No live web build. Run `npm run export:live` first.');
}

const bff = spawn(process.execPath, [join(root, 'bff/dist/bff/src/server.js')], {
  env: { ...process.env, PORT: '8787', BFF_ORDER_READY_SECONDS: '5', BFF_LOG: '1' },
  stdio: ['ignore', 'pipe', 'inherit'],
});
const log = [];
bff.stdout.on('data', (d) => log.push(...String(d).trim().split('\n')));

async function ready() {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch('http://127.0.0.1:8787/healthz')).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('The BFF did not start');
}

const run = (script, env) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(root, 'e2e', script)], {
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });

let code = 1;
try {
  await ready();
  code = await run('pitch-journey.mjs', { JOURNEY_DIST: 'dist-live', JOURNEY_LIVE: '1' });
  const audited = log.filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));
  const actions = [...new Set(audited.map((a) => a.action))];
  console.log(`\nBFF audit log: ${audited.length} entries (${actions.join(' · ')})`);
} finally {
  bff.kill();
}
process.exit(code);
