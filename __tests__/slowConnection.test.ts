import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ApiRequestError, timedOut, worthRetrying } from '@/services/apiClient';
import { config } from '@/constants/config';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  A connection that is not gone, only slow.

  Every network sweep in this repository cuts it dead: `audit:offline` kills
  the host, `audit:writes` drops the socket, `audit:wire` answers wrongly but
  instantly. None of them is the ordinary congested cell, where every request
  arrives — eventually.

  The client gave a request fifteen seconds and aborted it, and the query
  client retried that timeout twice on a fresh budget each time. So a
  connection that would have delivered in eighteen seconds produced three full
  requests, three payloads, about forty-five seconds of spinner, and then an
  error — for a connection that works. On a prepaid bundle those two extra
  payloads are money.

  `npm run audit:slow` answers correctly at four speeds and counts:

      fast (0.2s)     1 request, screen fills      ← control
      slow (8s)       1 request, screen fills      ← control
      slow (18s)      3 requests, never arrives
      never answers   3 requests

  Two changes, and they are only jointly observable — which the sweep is
  written to expose rather than hide:

    1. a timeout is not retried. Re-asking on the same budget is asking the
       same question the same way.
    2. the budget is thirty seconds, not fifteen. With no retry, one attempt
       has to cover the band the three attempts were burning.

  Put the timeout back into the retry set and the 18s case *still* passes,
  because the wider budget carries it alone. Only the never-answers case
  isolates the retry half — which is why it is there and why its window is cut
  short of the tracking screen's own poll.
  ───────────────────────────────────────────────────────────────────────────
*/

const failure = (code_: string) => new ApiRequestError({ code: code_, message: 'no' });

/**
 * FIXTURE 1 — the app's own deadline is not the server's answer.
 */
describe('1 — a timeout is not re-asked', () => {
  it('recognises the abort the client itself made', () => {
    expect(timedOut(failure('timeout'))).toBe(true);
    expect(worthRetrying(failure('timeout'))).toBe(false);
  });

  it('still retries a socket that died, which is a different event', () => {
    // `network` is a connection that dropped mid-flight. Another go genuinely
    // might work, and the client already labels the two apart.
    expect(timedOut(failure('network'))).toBe(false);
    expect(worthRetrying(failure('network'))).toBe(true);
  });

  it('still retries a server that broke', () => {
    expect(worthRetrying(new ApiRequestError({ code: 'x', message: 'no', status: 500 }))).toBe(
      true,
    );
  });

  it('reads the code rather than the sentence', () => {
    // The message is customer-facing copy and will be reworded; the code is
    // the fact.
    expect(timedOut(new Error('That took too long. Check your connection.'))).toBe(false);
  });
});

/**
 * FIXTURE 2 — the budget, and why it moved with the retry rather than alone.
 */
describe('2 — thirty seconds, once', () => {
  it('gives a request long enough to cover the band the retries were burning', () => {
    expect(config.apiTimeoutMs).toBe(30_000);
  });

  it('is still overridable, because how long to wait is not a constant of nature', () => {
    expect(code('src/constants/config.ts')).toMatch(
      /apiTimeoutMs: num\(process\.env\.EXPO_PUBLIC_API_TIMEOUT_MS, 30_000\)/,
    );
  });

  it('says why the number is the number', () => {
    // Thirty is chosen so nobody waits longer than they used to — the old
    // policy spent roughly that before its second attempt finished. What
    // changes is who succeeds.
    const constants = read('src/constants/config.ts');

    expect(constants).toMatch(/nobody waits longer than they used to/);
    expect(constants).toMatch(/audit:slow/);
  });

  it('leaves one attempt to do the whole job', () => {
    // The two halves are one decision: no retry without the wider budget would
    // have made a bad connection worse, not better.
    expect(worthRetrying(failure('timeout'))).toBe(false);
    expect(config.apiTimeoutMs).toBeGreaterThan(15_000);
  });
});

/**
 * FIXTURE 3 — the sweep, and the case that isolates the half the other cases
 * cannot see.
 */
describe('3 — audit:slow', () => {
  const audit = read('scripts/audit-slow.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:slow']).toBe('node scripts/audit-slow.mjs');
  });

  it('answers correctly rather than badly, which is the whole point', () => {
    // Every other network sweep here breaks the connection. This one serves a
    // real order, late.
    expect(audit).toMatch(/const ARRIVED = \/BBQ-5150\/;/);
    expect(audit).toMatch(/latency: 18_000/);
  });

  it('carries two speeds that must not change behaviour', () => {
    expect(audit).toMatch(/name: 'a fast connection'/);
    expect(audit).toMatch(/name: 'slow, but inside the budget \(8s\)'/);
    expect(audit).toMatch(/a slow connection that works must not be asked again/);
  });

  it('measures when the order arrived, not only whether', () => {
    // "Eventually" is the difference between this sweep and `audit:offline`.
    expect(audit).toMatch(/arrivedAfterMs/);
  });

  it('stops watching the hopeless case before the tracking poll can fire', () => {
    /*
      The correction that matters. The first run reported two requests as a
      finding; the second was the tracking screen's own fifteen-second poll,
      and a live screen that stopped asking would be the defect rather than
      this. The window now ends before that poll is due.
    */
    expect(audit).toMatch(/watchMs: 34_000/);
    expect(audit).toMatch(/the tracking screen's own fifteen-second\s+poll/);
  });

  it('does not settle for network idle, which this sweep can never reach', () => {
    // A case whose point is a request that never settles would never reach
    // network idle, and the navigation would time out before anything was
    // measured.
    expect(audit).toMatch(/waitUntil: 'domcontentloaded'/);
  });
});
