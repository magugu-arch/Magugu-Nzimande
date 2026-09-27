#!/usr/bin/env node
/**
 * npm run check:launch [-- --env-file=.env.production]
 * Prints every launch setting with ✓ / ✗ and how to fix it. Exits 1 if a
 * required setting is missing, so it can gate a deploy.
 */
import { readFileSync } from 'node:fs';
import { checkLaunchConfig, launchReady } from '../server/launch.ts';

const fileArg = process.argv.find((a) => a.startsWith('--env-file='));
const env = { ...process.env };
if (fileArg) {
  for (const line of readFileSync(fileArg.split('=')[1], 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}

const checks = checkLaunchConfig(env);
console.log('\nGrateful — launch readiness\n');
for (const c of checks) {
  console.log(`  ${c.ok ? '✓' : c.level === 'required' ? '✗' : '!'} ${c.label}`);
  if (!c.ok) console.log(`      ${c.fix}`);
}
const ready = launchReady(checks);
console.log(`\n${ready ? 'Ready to launch.' : 'Not ready: fix the ✗ items above.'} (${checks.filter((c) => c.ok).length}/${checks.length} checks pass)\n`);
process.exit(ready ? 0 : 1);
