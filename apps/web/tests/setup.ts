import { randomBytes } from 'node:crypto';
import { rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, vi } from 'vitest';
import { setSink } from '@/lib/observability/log';

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

/**
 * Nothing anywhere in the suite may log a customer's details.
 *
 * A standing guard rather than a test, because the question is not "does this
 * one call site redact" but "did any of the nine hundred tests, driving every
 * route in the application, put a person's address into a log line". The
 * redactor works on the names it knows, and the defect it was carrying was a
 * field called `recipient` that nobody had thought of — the bounce webhook
 * wrote `{"event":"email.suppressed","recipient":"thandi@example.com"}` to
 * stdout, once per bounce.
 *
 * Worth catching here rather than in a suite of its own because a log line is
 * the one leak that cannot be taken back. Erasure can rewrite the state file;
 * it can never reach a log aggregator, so whatever goes out goes out for good.
 *
 * The fixture customer's own details are what it looks for, since those are the
 * values the suite actually drives through the application. Kept as literals
 * rather than imported from the fixtures, because this file is loaded before
 * them and importing it here would pull the whole seed catalogue into setup.
 */
const NEVER_LOGGED = ['thandi@example.com', '0821234567', 'Thandi Mokoena'];

setSink((line) => {
  for (const detail of NEVER_LOGGED) {
    if (line.includes(detail)) {
      throw new Error(
        `a log line carried ${detail}, which must never leave the process:\n  ${line}`,
      );
    }
  }
});
