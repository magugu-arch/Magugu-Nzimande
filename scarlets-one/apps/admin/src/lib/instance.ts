import 'server-only';
import { createDemoClock } from '@scarlets/adapters';
import { AdminStore } from './store';

/**
 * The one DEMO store for this server process.
 *
 * It is kept on `globalThis` so that every route and Server Action shares it,
 * and so a hot reload in development does not quietly reseed it. It is
 * memory only: restart the server and the demo starts again from the seed.
 *
 * The store runs on the demo clock (the "two weeks out" scenario), the same
 * one the supporter app uses, so scheduled items and campaign windows behave
 * the same on any day the demo is run.
 */
interface Held {
  store: AdminStore;
  startedAt: number;
}

const holder = globalThis as typeof globalThis & { __scarletsOneAdmin?: Held };

function held(): Held {
  if (!holder.__scarletsOneAdmin) {
    const startedAt = Date.now();
    const clock = createDemoClock('pre_match', startedAt);
    holder.__scarletsOneAdmin = { store: new AdminStore({ now: () => clock.now() }), startedAt };
  }
  return holder.__scarletsOneAdmin;
}

export function getStore(): AdminStore {
  return held().store;
}

/** When this server process seeded the store, in real time. */
export function storeStartedAt(): Date {
  return new Date(held().startedAt);
}
