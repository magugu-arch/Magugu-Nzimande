/**
 * Staff permissions, checked inside the services (brief §13.13: never rely on
 * hidden buttons or client role flags). The web app hides controls a role
 * cannot use as a courtesy; the check that matters is here.
 */

import type { Actor, StaffRole } from './types.ts';
import { DomainError } from './util/core.ts';
import type { Minor } from './util/core.ts';

export type Permission =
  | 'booking.view-all'
  | 'booking.mark-outcome'
  | 'booking.reconcile'
  | 'payment.view'
  | 'payment.refund'
  | 'campaign.create'
  | 'campaign.approve'
  | 'campaign.send'
  | 'branch.configure'
  | 'guest.view-unmasked'
  | 'notifications.view'
  | 'sandbox.control';

const GRANTS: Record<StaffRole, Permission[]> = {
  host: ['booking.view-all', 'booking.mark-outcome'],
  manager: [
    'booking.view-all',
    'booking.mark-outcome',
    'booking.reconcile',
    'payment.view',
    'payment.refund',
    'campaign.approve',
    'campaign.send',
    'branch.configure',
    'notifications.view',
  ],
  finance: ['payment.view', 'payment.refund', 'booking.view-all', 'booking.reconcile'],
  marketer: ['campaign.create', 'campaign.send', 'notifications.view'],
  admin: [
    'booking.view-all',
    'booking.mark-outcome',
    'booking.reconcile',
    'payment.view',
    'payment.refund',
    'campaign.create',
    'campaign.approve',
    'campaign.send',
    'branch.configure',
    'guest.view-unmasked',
    'notifications.view',
    'sandbox.control',
  ],
};

/** Managers approve small refunds on the spot; larger ones go to finance. */
export const MANAGER_REFUND_LIMIT_MINOR: Minor = 50_000;

export const ROLE_LABELS: Record<StaffRole, string> = {
  host: 'Host',
  manager: 'Branch manager',
  finance: 'Finance',
  marketer: 'Marketing',
  admin: 'Administrator',
};

export function can(actor: Actor, permission: Permission, amountMinor?: Minor): boolean {
  // Policy-driven automation (a refund the cancellation policy requires).
  if (actor.kind === 'system') return permission === 'payment.refund' || permission === 'booking.reconcile';
  if (actor.kind !== 'staff' || !actor.role) return false;
  if (!GRANTS[actor.role].includes(permission)) return false;
  if (permission === 'payment.refund' && actor.role === 'manager' && (amountMinor ?? 0) > MANAGER_REFUND_LIMIT_MINOR) {
    return false;
  }
  return true;
}

export function authorize(actor: Actor, permission: Permission, amountMinor?: Minor): void {
  if (!can(actor, permission, amountMinor)) {
    throw new DomainError('forbidden', `${actor.role ?? actor.kind} may not ${permission}`, {
      permission,
      role: actor.role ?? actor.kind,
    });
  }
}

export function staff(role: StaffRole, id = `staff-${role}`): Actor {
  return { kind: 'staff', id, role };
}
