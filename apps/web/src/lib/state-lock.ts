import { closeSync, openSync, statSync, unlinkSync } from 'node:fs';

/**
 * A lock across worker processes, held for the length of one read-modify-write.
 *
 * Deliberately imports nothing but `node:fs`. That keeps it honest — a lock
 * with no application dependencies cannot deadlock on one — and it means a
 * child process can import this file directly under Node's type stripping,
 * which is the only way to test mutual exclusion between real processes rather
 * than asserting it about code that never runs concurrently in one.
 */

/**
 * How long a lock may be held before it is assumed dead.
 *
 * A worker killed between taking and releasing would otherwise wedge every
 * other worker for good. Generous next to the work it guards — read a file,
 * change an object, write it back — so a slow disk is not read as a crash.
 */
export const LOCK_STALE_MS = 5_000;
export const LOCK_WAIT_MS = 2_000;

/** Somewhere for Atomics.wait to wait. Its value is never read. */
const PARK = new Int32Array(new SharedArrayBuffer(4));

export const lockPathFor = (file: string): string => `${file}.lock`;

/**
 * Takes the lock, or gives up at `until`.
 *
 * `openSync` with `wx` fails when the file exists, and the check and the create
 * are one operation in the kernel. That is the whole reason this works: an
 * `existsSync` followed by a `writeFileSync` is two operations, and two is the
 * race it was meant to prevent.
 */
export function takeLock(file: string, until: number = Date.now() + LOCK_WAIT_MS): number | null {
  const lock = lockPathFor(file);

  while (Date.now() <= until) {
    try {
      return openSync(lock, 'wx');
    } catch (error) {
      // Only EEXIST means somebody holds it. Anything else — the directory does
      // not exist, the filesystem is read only, we lack permission — means this
      // lock can never be created, and waiting two seconds to discover that on
      // every single write would turn "a read-only filesystem costs the console
      // its writes" into "every request takes two seconds longer".
      //
      // An earlier version treated the two alike and, worse, retried the
      // unopenable case without consulting the deadline: pointing the state
      // file at a directory that did not exist hung the process outright.
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST') return null;
    }

    try {
      if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
        // Left behind by something that died. Reap it and try again at once.
        unlinkSync(lock);
        continue;
      }
    } catch {
      // It vanished between the open and the stat. Go round; the deadline in
      // the loop condition is what stops this being for ever.
      continue;
    }

    // A synchronous spin, because making this async would turn every caller of
    // mutateState async to save a few milliseconds on a path contended about as
    // often as two operators press a button in the same instant.
    Atomics.wait(PARK, 0, 0, 5);
  }

  return null;
}

export function releaseLock(file: string, handle: number): void {
  try {
    closeSync(handle);
  } catch {
    /* already closed */
  }
  try {
    unlinkSync(lockPathFor(file));
  } catch {
    /* already gone, or reaped as stale by somebody else */
  }
}

/**
 * Runs `work` with the lock held, and releases it whatever happens.
 *
 * Proceeds without the lock rather than throwing when it cannot be taken within
 * the deadline. Under contention this deployment could not resolve, the old
 * behaviour — lose an edit — is still better than the new one, which would be
 * refusing a customer's order because an operator is slow with a toggle.
 */
export function withLock<T>(file: string, work: () => T): T {
  const handle = takeLock(file);
  try {
    return work();
  } finally {
    if (handle !== null) releaseLock(file, handle);
  }
}
