import { existsSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PRODUCTS } from '@bbq/seed';
import { beforeEach, describe, expect, it } from 'vitest';
import { mutateState, pushAudit, readState, writeState } from '@/lib/demo-state';
import { blankState, stateFile, withStateFile, writeRawState } from './fixtures';

/**
 * The file that stands in for Postgres.
 *
 * Every suite in this project leans on it and none of them tested it. That is
 * backwards: it is the layer that decides whether the console and the
 * storefront see the same orders, and its failure mode is not an exception but
 * a worker quietly disagreeing with another one.
 *
 * The interesting behaviour is all in what it does when something is wrong —
 * a file it did not write, a directory it cannot write to, a shape from an
 * older deployment — and none of that is reachable through its own API, which
 * is why it stayed uncovered.
 */

beforeEach(blankState);

describe('a state file that is not there', () => {
  it('reads as a fresh deployment rather than throwing', async () => {
    await withStateFile((file) => {
      expect(existsSync(file)).toBe(false);

      const state = readState();
      expect(state.orders).toEqual([]);
      expect(state.soldOut).toEqual([]);
      expect(state.sequence).toBe(0);
    });
  });

  /**
   * The opening line an operator reads in the console. It was written by hand
   * and said sixteen products for as long as there were sixteen; the menu has
   * grown twice since. A generated log with one typed number in it is worse
   * than no number, because the rest of the log has earned the reader's trust.
   */
  it('opens its audit log with the number of products actually on the menu', async () => {
    await withStateFile(() => {
      const [first] = readState().audit;

      expect(first?.who).toBe('system');
      expect(first?.what).toContain(`${PRODUCTS.length} products`);
    });
  });
});

describe('a state file that is there', () => {
  it('survives being read back, which is the whole point of the file', () => {
    mutateState((state) => {
      state.soldOut = ['golden-original'];
      state.sequence = 41;
    });

    // A second reader, standing in for the other worker process. Reading
    // through the module rather than the returned object is the point: the
    // first version of this held its state in a module-level Map and passed
    // every test that never left the process.
    const seen = readState();
    expect(seen.soldOut).toEqual(['golden-original']);
    expect(seen.sequence).toBe(41);
  });

  it('is written as one file, not left half-written beside itself', () => {
    mutateState((state) => {
      state.hidden = ['french-fries'];
    });

    const directory = path.dirname(stateFile());
    const stem = path.basename(stateFile());
    const leftovers = readdirSync(directory).filter(
      (name) => name.startsWith(stem) && name !== stem,
    );

    expect(leftovers, 'a .tmp file survived the rename').toEqual([]);
    expect(JSON.parse(readFileSync(stateFile(), 'utf8')).hidden).toEqual(['french-fries']);
  });

  it('hands mutateState’s own return value back to the caller', () => {
    const returned = mutateState((state) => {
      state.sequence = 7;
      return `sequence is ${state.sequence}`;
    });

    expect(returned).toBe('sequence is 7');
    expect(readState().sequence).toBe(7);
  });
});

describe('a state file written by something else', () => {
  it('falls back to a fresh deployment rather than throwing on nonsense', () => {
    writeRawState('this is not JSON {{{');
    expect(() => readState()).not.toThrow();
    expect(readState().orders).toEqual([]);
  });

  it('falls back on an empty file, which is what a full disk leaves behind', () => {
    writeRawState('');
    expect(readState().sequence).toBe(0);
  });

  /**
   * The upgrade path. A field added to DemoState after a deployment is already
   * running is absent from the file that deployment wrote, and the console
   * reads it on the next request — so the merge has to fill it in rather than
   * hand back undefined for a caller to trip over.
   */
  it('fills in a field an older shape never wrote', () => {
    writeRawState(JSON.stringify({ soldOut: ['golden-original'] }));

    const state = readState();
    expect(state.soldOut, 'what the old file did carry').toEqual(['golden-original']);
    expect(state.consoleLock, 'what it did not').toEqual({ failures: 0, lockedUntil: null });
    expect(state.audit.length).toBeGreaterThan(0);
    expect(state.orders).toEqual([]);
  });
});

describe('a state file that cannot be written', () => {
  /**
   * A read-only filesystem costs the console its writes. It must not cost the
   * storefront its ability to take an order, so the write swallows rather than
   * throws — and a swallowed error is exactly the kind nobody notices has
   * stopped working.
   */
  it('loses the write instead of the request', async () => {
    await withStateFile(async () => {
      process.env.BBQ_STATE_FILE = path.join(
        os.tmpdir(),
        'bbq-no-such-directory',
        'nested',
        'state.json',
      );

      expect(() => mutateState((state) => (state.sequence = 99))).not.toThrow();
      expect(readState().sequence, 'the write was lost, as designed').toBe(0);
    });
  });

  /** Restoring the variable has to actually restore it, or the next test lies. */
  it('leaves the real state file in place afterwards', () => {
    expect(existsSync(stateFile())).toBe(true);
  });
});

describe('the audit log', () => {
  it('reads newest first, because that is the end an operator looks at', () => {
    const state = readState();
    pushAudit(state, 'kitchen', 'first');
    pushAudit(state, 'kitchen', 'second');

    expect(state.audit.map((entry) => entry.what)).toEqual(['second', 'first']);
  });

  it('records who did it as well as what was done', () => {
    const state = readState();
    pushAudit(state, 'operations', 'switched delivery off');

    expect(state.audit[0]).toMatchObject({ who: 'operations', what: 'switched delivery off' });
    expect(Date.parse(state.audit[0]?.at ?? '')).not.toBeNaN();
  });

  /**
   * Bounded on purpose: this process is long-lived and nothing else trims the
   * log. Pushed well past the limit rather than exactly to it, so an off-by-one
   * in the trim shows up as a number rather than as nothing.
   */
  it('stops growing at two hundred entries', () => {
    const state = readState();
    for (let index = 0; index < 260; index += 1) pushAudit(state, 'kitchen', `entry ${index}`);

    expect(state.audit).toHaveLength(200);
    expect(state.audit[0]?.what, 'the newest is kept').toBe('entry 259');
    expect(state.audit.at(-1)?.what, 'the oldest are dropped').toBe('entry 60');
  });

  it('keeps the trim through a write and a read, not just in memory', () => {
    mutateState((state) => {
      for (let index = 0; index < 260; index += 1) pushAudit(state, 'kitchen', `entry ${index}`);
    });

    expect(readState().audit).toHaveLength(200);
  });
});

describe('where the state file lives', () => {
  /**
   * Read on every call rather than captured at import. It was a module
   * constant, so a variable set after this module first loaded was silently
   * ignored — which is why two suites sharing one temp file could not be
   * separated, and would have done the same to any process that reconfigured
   * itself at runtime.
   */
  it('follows the environment variable when it moves mid-run', async () => {
    mutateState((state) => {
      state.sequence = 5;
    });

    await withStateFile(() => {
      expect(readState().sequence, 'the new file is its own').toBe(0);
      writeState({ ...readState(), sequence: 88 });
      expect(readState().sequence).toBe(88);
    });

    expect(readState().sequence, 'and the original was untouched').toBe(5);
  });
});
