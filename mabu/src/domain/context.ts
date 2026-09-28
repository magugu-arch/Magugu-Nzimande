import type { Analytics } from './analytics';
import type { Database } from './db';
import type { InMemoryEventBus } from './events/domainEvents';
import type { FeatureFlags } from './flags';
import type { Actor } from './guests/types';
import type { Clock } from './shared/clock';
import { DomainError } from './shared/errors';
import type { IdGenerator } from './shared/ids';

/** What every service is built from. Swapped wholesale in tests. */
export interface ServiceContext {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  bus: InMemoryEventBus;
  flags: FeatureFlags;
  analytics: Analytics;
}

export function nowIso(ctx: Pick<ServiceContext, 'clock'>): string {
  return ctx.clock.now().toISOString();
}

/** §19 audit logging for sensitive actions. */
export function audit(
  ctx: ServiceContext,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  detail?: Record<string, unknown>,
): void {
  ctx.db.audit.insert({
    id: ctx.ids.id('aud'),
    actorId: actor.id,
    actorRole: actor.role,
    action,
    entityType,
    entityId,
    at: nowIso(ctx),
    detail,
  });
}

/** §19 role-based access control. */
export function requireRole(actor: Actor, ...roles: Actor['role'][]): void {
  if (!roles.includes(actor.role)) {
    throw new DomainError(
      'FORBIDDEN',
      'You do not have access to that.',
      `role ${actor.role} not in ${roles.join(',')}`,
    );
  }
}

/** A guest may only touch their own records; staff and admin may touch any. */
export function requireOwnerOrStaff(actor: Actor, ownerGuestId: string): void {
  if (actor.role === 'guest' && actor.id !== ownerGuestId) {
    // NOT_FOUND rather than FORBIDDEN: do not confirm another guest's record exists.
    throw new DomainError('NOT_FOUND', 'We could not find that booking.', 'owner mismatch');
  }
}

export function requireFlag(enabled: boolean, feature: string): void {
  if (!enabled) {
    throw new DomainError(
      'FEATURE_DISABLED',
      'This is not available in the app just now. Our team will gladly help by phone or email.',
      `${feature} disabled`,
    );
  }
}

export const SYSTEM_ACTOR: Actor = { id: 'system', role: 'admin' };
