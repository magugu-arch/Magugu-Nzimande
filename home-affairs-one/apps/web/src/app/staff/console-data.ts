'use client';

import type { Gateway } from '@hao/api-gateway';
import { TOPICS } from '@hao/local-platform';
import type { GatewayError } from '@hao/shared-types';
import type { QueryKey, UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getGateway } from '@/lib/gateway';
import { useGatewayQuery } from '@/lib/queries';
import { useSession } from '@/lib/session';

/**
 * Reads for the staff console and the partner sandbox.
 *
 * Why this exists: the gateway audits every read made by an official or a
 * partner, and the app refreshes every query whenever anything in the mock
 * store changes — including the audit trail. Put together, one staff read
 * would write an audit event, which would refresh the read, which would write
 * another audit event, without end.
 *
 * So a read made here is only sent to the gateway again when something other
 * than the audit trail has changed since the last time, or when the screen is
 * opened again. Each view is therefore audited once, which is also the honest
 * record: "who looked at what, and when". Audit queries themselves are not
 * audited and can keep using `useGatewayQuery`.
 */

const AUDIT_COLLECTION = 'audit.events';
/** A failed read is not retried by a background refresh for this long. A manual retry after it is. */
const ERROR_HOLD_MS = 2_000;

/** Counts changes to anything in the mock store except the audit trail. */
let dataRevision = 0;
let watching = false;

function watchStore(): void {
  if (watching) return;
  watching = true;
  getGateway().platform.bus.subscribe(TOPICS.storeChanged, (event) => {
    const payload = event.payload as { collection?: unknown } | null | undefined;
    if (payload?.collection !== AUDIT_COLLECTION) dataRevision += 1;
  });
}

interface Remembered {
  revision: number;
  at: number;
  outcome: { ok: true; data: unknown } | { ok: false; error: unknown };
}

const remembered = new Map<string, Remembered>();
const mounted = new Map<string, number>();

/**
 * Same shape as `useGatewayQuery`. The signed-in reference is added to the key,
 * so a different official or partner never reuses someone else's read.
 */
export function useConsoleQuery<T>(
  key: QueryKey,
  read: (gateway: Gateway) => Promise<T>,
  options: { enabled?: boolean } = {},
): UseQueryResult<T, GatewayError> {
  const { session } = useSession();
  const fullKey = [...key, session?.subjectRef ?? 'signed-out'];
  const id = JSON.stringify(fullKey);

  // Forget the read when the last screen using it closes, so opening the
  // screen again is a new view (and is audited as one).
  useEffect(() => {
    mounted.set(id, (mounted.get(id) ?? 0) + 1);
    return () => {
      const left = (mounted.get(id) ?? 1) - 1;
      if (left > 0) {
        mounted.set(id, left);
      } else {
        mounted.delete(id);
        remembered.delete(id);
      }
    };
  }, [id]);

  return useGatewayQuery<T>(
    fullKey,
    async (gateway) => {
      watchStore();
      const last = remembered.get(id);
      if (last && last.revision === dataRevision) {
        if (last.outcome.ok) return last.outcome.data as T;
        if (Date.now() - last.at < ERROR_HOLD_MS) throw last.outcome.error;
      }
      const revision = dataRevision;
      try {
        const data = await read(gateway);
        remembered.set(id, { revision, at: Date.now(), outcome: { ok: true, data } });
        return data;
      } catch (error) {
        remembered.set(id, { revision, at: Date.now(), outcome: { ok: false, error } });
        throw error;
      }
    },
    options,
  );
}
