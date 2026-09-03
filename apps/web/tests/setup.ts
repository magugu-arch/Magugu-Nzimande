import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, vi } from 'vitest';

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


/**
 * A fixed moment, so the suite does not depend on the wall clock.
 *
 * Orders are refused when the store is closed, which is correct and made the
 * whole suite fail after 22:00 — thirteen files place an order through the real
 * route, and they passed all day and failed at night. A test that depends on
 * when it is run is a test nobody trusts the next morning.
 *
 * Wednesday 2 September 2026 at 12:00 SAST: inside every store's trading hours,
 * and a weekday so the weekday offers run. Suites that care about another
 * moment pass their own `now`; `state-lock.test.ts` puts the real clock back,
 * because it is the one thing here that waits for time to pass.
 */
export const FIXED_NOW = new Date('2026-09-02T10:00:00Z');
vi.setSystemTime(FIXED_NOW);
