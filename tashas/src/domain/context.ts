/**
 * What every service receives: storage, time, ids and approved content, plus
 * the audit and alert helpers so no module invents its own logging.
 */

import type { Database } from './db.ts';
import type { Clock, IdSource } from './util/core.ts';
import type { Content } from './content.ts';
import type { Actor, AuditEntry, StaffAlert } from './types.ts';

export interface Ctx {
  db: Database;
  clock: Clock;
  ids: IdSource;
  content: Content;
}

export const SYSTEM: Actor = { kind: 'system', id: 'system' };

/** Keys whose values never reach the audit log or alerts in the clear. */
const SENSITIVE = /email|phone|name|token|secret|signature|card/i;

export function redact(details: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (SENSITIVE.test(k) && typeof v === 'string') out[k] = '[redacted]';
    else out[k] = v;
  }
  return out;
}

export function audit(
  ctx: Ctx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  details: Record<string, unknown> = {},
): AuditEntry {
  return ctx.db.insert('audit', {
    id: ctx.ids.id('aud'),
    at: ctx.clock.now(),
    actor,
    action,
    entityType,
    entityId,
    details: redact(details),
  });
}

export function raiseAlert(
  ctx: Ctx,
  alert: Omit<StaffAlert, 'id' | 'at' | 'resolvedAt' | 'resolvedBy'>,
): StaffAlert {
  const open = ctx.db.where(
    'alerts',
    (a) => a.entityId === alert.entityId && a.title === alert.title && a.resolvedAt === null,
  );
  if (open[0]) return open[0];
  return ctx.db.insert('alerts', {
    ...alert,
    id: ctx.ids.id('alr'),
    at: ctx.clock.now(),
    resolvedAt: null,
    resolvedBy: null,
  });
}

export function resolveAlerts(ctx: Ctx, entityId: string, by: string): void {
  for (const a of ctx.db.where('alerts', (x) => x.entityId === entityId && x.resolvedAt === null)) {
    ctx.db.update('alerts', a.id, { resolvedAt: ctx.clock.now(), resolvedBy: by });
  }
}
