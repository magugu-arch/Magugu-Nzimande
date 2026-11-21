// Runs the Next.js CLI with its usage telemetry switched off, so that nothing
// leaves the machine at build time or while developing. `next dev` reports a
// session event from a process that never reads next.config.mjs, so the
// switch has to be in the environment before the CLI starts.
//
//   node scripts/next.mjs dev --port 3100
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = require.resolve('next/dist/bin/next');

const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
});

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 0);
});
