import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';

/**
 * One state file per test file.
 *
 * The demo state stands in for Postgres and defaults to a single path in the
 * temp directory. Vitest runs test files in parallel, so two suites that both
 * write it — one marking an item sold out, another counting failed sign-ins —
 * were racing on the same JSON and failing each other in ways neither showed
 * when run alone.
 *
 * Set before any suite imports the module, which is why this is a setup file
 * rather than a `beforeEach`.
 */
const file = path.join(os.tmpdir(), `bbq-test-state-${randomBytes(8).toString('hex')}.json`);
process.env.BBQ_STATE_FILE = file;

afterAll(() => {
  rmSync(file, { force: true });
});
