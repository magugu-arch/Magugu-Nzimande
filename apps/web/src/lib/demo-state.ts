import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Order, ServiceMode } from '@bbq/types';

/**
 * The stand-in for Postgres, until /services/api exists.
 *
 * It is a single JSON file rather than a module-level Map because the server
 * runs several worker processes: an order placed through a route handler in one
 * worker is invisible to a page rendered in another, which showed up as an
 * operations console whose queue was empty until its first poll.
 *
 * Every read re-reads the file and every write replaces it atomically, so the
 * workers agree. Two operators writing in the same instant can still lose one
 * edit — a read-modify-write race a database would settle with a transaction,
 * and the reason this is a stopgap rather than a design.
 */

export type AuditEntry = { at: string; who: string; what: string };

export type DemoState = {
  soldOut: string[];
  hidden: string[];
  services: Record<string, Partial<Record<ServiceMode, boolean>>>;
  orders: Order[];
  sequence: number;
  audit: AuditEntry[];
};

const FILE =
  process.env.BBQ_STATE_FILE ?? path.join(os.tmpdir(), 'bbq-chicken-demo-state.json');

function seed(): DemoState {
  return {
    soldOut: [],
    hidden: [],
    services: {},
    orders: [],
    sequence: 0,
    audit: [
      {
        at: new Date().toISOString(),
        who: 'system',
        what: 'Demo catalogue loaded (16 products)',
      },
    ],
  };
}

export function readState(): DemoState {
  try {
    const raw = readFileSync(FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return { ...seed(), ...parsed };
  } catch {
    // Missing or unreadable on the first request of a fresh deployment.
    return seed();
  }
}

export function writeState(next: DemoState): void {
  try {
    // Written beside the target and renamed, so a reader never catches a
    // half-written file.
    const temporary = `${FILE}.${process.pid}.tmp`;
    writeFileSync(temporary, JSON.stringify(next), 'utf8');
    renameSync(temporary, FILE);
  } catch {
    // A read-only filesystem costs the console its writes, not the storefront
    // its ability to take orders.
  }
}

export function mutateState<T>(change: (state: DemoState) => T): T {
  const state = readState();
  const result = change(state);
  writeState(state);
  return result;
}

/** Newest first, and bounded: an unbounded log in a long-lived process is a leak. */
export function pushAudit(state: DemoState, who: string, what: string): void {
  state.audit.unshift({ at: new Date().toISOString(), who, what });
  if (state.audit.length > 200) state.audit.length = 200;
}
