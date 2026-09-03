import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOCK_STALE_MS,
  lockPathFor,
  releaseLock,
  takeLock,
  withLock,
} from '@/lib/state-lock';

/**
 * The real clock, back.
 *
 * The setup file pins the date so that trading hours do not make the rest of
 * the suite depend on what time it is run. This file is the exception: the lock
 * spins until `Date.now()` passes a deadline, and a clock that never advances
 * is a deadline that never arrives.
 */
vi.useRealTimers();


/**
 * The lock that closes the read-modify-write race.
 *
 * The interesting property cannot be tested in one process: JavaScript will not
 * interleave two synchronous functions, so an in-process test of mutual
 * exclusion passes whether or not the lock exists. The last block here spawns
 * real child processes and has them fight over one file, which is the only way
 * to make the claim honestly — and it fails when the lock is removed.
 */

const temporary: string[] = [];

function aFile(): string {
  const file = path.join(os.tmpdir(), `bbq-lock-${randomBytes(8).toString('hex')}.json`);
  temporary.push(file);
  return file;
}

afterEach(() => {
  for (const file of temporary.splice(0)) {
    rmSync(file, { force: true });
    rmSync(lockPathFor(file), { force: true });
  }
});

describe('taking the lock', () => {
  it('succeeds when nobody holds it, and leaves the lock file behind', () => {
    const file = aFile();
    const handle = takeLock(file);

    expect(handle).not.toBeNull();
    expect(existsSync(lockPathFor(file))).toBe(true);
    releaseLock(file, handle as number);
  });

  it('gives the file back on release', () => {
    const file = aFile();
    releaseLock(file, takeLock(file) as number);

    expect(existsSync(lockPathFor(file))).toBe(false);
    expect(takeLock(file), 'and can be taken again').not.toBeNull();
  });

  it('gives up rather than waiting for ever', () => {
    const file = aFile();
    const held = takeLock(file);

    const started = Date.now();
    // A deadline already in the past: one attempt, then null.
    expect(takeLock(file, Date.now() - 1)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1_000);

    releaseLock(file, held as number);
  });

  /**
   * A worker killed between taking and releasing would otherwise wedge every
   * other worker for good, and a restart would not clear it — the lock file is
   * on disk.
   */
  it('reaps a lock left behind by something that died', () => {
    const file = aFile();
    takeLock(file); // taken and never released, as a crash would leave it

    const old = (Date.now() - LOCK_STALE_MS - 1_000) / 1_000;
    utimesSync(lockPathFor(file), old, old);

    const handle = takeLock(file, Date.now() + 200);
    expect(handle, 'the stale lock was cleared').not.toBeNull();
  });

  it('does not reap one that is merely busy', () => {
    const file = aFile();
    const held = takeLock(file);

    expect(takeLock(file, Date.now() + 50)).toBeNull();
    releaseLock(file, held as number);
  });

  /**
   * The bug this went in with, and the reason the loop distinguishes EEXIST
   * from every other error.
   *
   * A lock whose directory does not exist can never be created: the open fails
   * and so does the stat. The first version treated that as "it vanished, go
   * round again" and retried without consulting the deadline, which hung the
   * whole process — on a state file path that is explicitly supported, because
   * a read-only filesystem is meant to cost the console its writes rather than
   * wedge the storefront.
   *
   * Returning promptly matters as much as returning: two seconds of waiting to
   * discover an unwritable path, on every write, is its own outage.
   */
  it('gives up at once when the lock could never be created', () => {
    const nowhere = path.join(os.tmpdir(), 'bbq-no-such-directory', 'nested', 'state.json');

    const started = Date.now();
    expect(takeLock(nowhere)).toBeNull();
    expect(Date.now() - started, 'did not sit out the full deadline').toBeLessThan(200);
  });

  it('still runs the work when the lock could never be created', () => {
    const nowhere = path.join(os.tmpdir(), 'bbq-no-such-directory', 'nested', 'state.json');
    expect(withLock(nowhere, () => 'ran')).toBe('ran');
  });
});

describe('withLock', () => {
  it('returns what the work returned', () => {
    expect(withLock(aFile(), () => 'done')).toBe('done');
  });

  /**
   * Released on the way out even when the work threw. Without the `finally`, one
   * bug in one route handler locks the shop for everyone until the stale
   * timeout — five seconds of a kitchen unable to take an order.
   */
  it('releases the lock when the work throws', () => {
    const file = aFile();

    expect(() =>
      withLock(file, () => {
        throw new Error('the change failed');
      }),
    ).toThrow('the change failed');

    expect(existsSync(lockPathFor(file))).toBe(false);
    expect(takeLock(file)).not.toBeNull();
  });

  /**
   * Proceeds rather than throwing when the lock cannot be taken. Under
   * contention this deployment could not resolve, losing an edit is still
   * better than refusing a customer's order because an operator is slow with a
   * toggle.
   */
  it('does the work anyway rather than refusing, if the lock never comes free', () => {
    const file = aFile();
    takeLock(file);
    utimesSync(lockPathFor(file), Date.now() / 1_000, Date.now() / 1_000);

    // Held and fresh, so this cannot take it — and must still run.
    expect(withLock(file, () => 'ran')).toBe('ran');
  });
});

describe('two processes at once', () => {
  /**
   * The test the whole lock exists for, and the only one that can prove it.
   *
   * Each child reads a counter, waits, writes it back incremented — the shape
   * of every mutateState in the application, with the window widened so the
   * race is certain rather than occasional. Without the lock the final count is
   * far below the number of increments, because each child overwrites what the
   * others wrote. With it, none are lost.
   *
   * The child imports the lock module directly as TypeScript: Node strips the
   * types, and this module deliberately imports nothing but `node:fs` so there
   * is nothing for a bare process to fail to resolve.
   */
  const WORKERS = 4;
  const PER_WORKER = 10;

  /** Writes the child script, and returns the path it was written to. */
  function childScript(locked: boolean): string {
    const lockModule = path.resolve(__dirname, '../src/lib/state-lock.ts');
    const body = `
      const state = JSON.parse(readFileSync(file, 'utf8'));
      // The window every read-modify-write has, widened so an unlocked run
      // loses increments reliably rather than once in a hundred runs.
      const until = Date.now() + 3;
      while (Date.now() < until) {}
      state.count += 1;
      write(state);
    `;

    const source = `
      import { readFileSync, renameSync, writeFileSync } from 'node:fs';
      import { withLock } from ${JSON.stringify(lockModule)};

      const file = process.argv[2];

      /**
       * Temp-and-rename, the same as writeState. Not a detail: writing the
       * target directly lets an unlocked reader catch a half-written file and
       * die on JSON.parse, which would make the control below fail for the
       * wrong reason. The claim is that an unlocked run loses updates, not
       * that it tears reads — atomic writes were never the missing part.
       */
      const write = (state) => {
        const temporary = file + '.' + process.pid + '.tmp';
        writeFileSync(temporary, JSON.stringify(state), 'utf8');
        renameSync(temporary, file);
      };

      for (let i = 0; i < ${PER_WORKER}; i += 1) {
        ${locked ? `withLock(file, () => {${body}});` : body}
      }
    `;

    const script = path.join(os.tmpdir(), `bbq-lock-child-${randomBytes(6).toString('hex')}.mts`);
    temporary.push(script);
    writeFileSync(script, source, 'utf8');
    return script;
  }

  /** Spawns the workers together — awaited one at a time they never contend. */
  async function race(script: string, file: string): Promise<number> {
    writeFileSync(file, JSON.stringify({ count: 0 }), 'utf8');

    await Promise.all(
      Array.from(
        { length: WORKERS },
        () =>
          new Promise<void>((resolve, reject) => {
            const child = spawn(process.execPath, [script, file], { stdio: 'pipe' });
            let stderr = '';
            child.stderr.on('data', (chunk) => (stderr += String(chunk)));
            child.on('error', reject);
            child.on('close', (code) =>
              code === 0 ? resolve() : reject(new Error(`worker exited ${code}: ${stderr}`)),
            );
          }),
      ),
    );

    return (JSON.parse(readFileSync(file, 'utf8')) as { count: number }).count;
  }

  it('does not lose an increment', async () => {
    expect(await race(childScript(true), aFile())).toBe(WORKERS * PER_WORKER);
  }, 30_000);

  /**
   * The control, and the reason the test above means anything.
   *
   * The same four workers doing the same work without the lock lose
   * increments — which is exactly the bug this shipped with for the whole
   * project. If this ever stops losing them, the race has become too narrow to
   * reproduce and the test above has quietly stopped proving its claim.
   */
  it('loses them without it, which is what was happening before', async () => {
    expect(await race(childScript(false), aFile())).toBeLessThan(WORKERS * PER_WORKER);
  }, 30_000);
});
