import type { NotificationCategory } from '@core/domain/models';
import type { Campaign, Operator, OperatorRole } from './types';

/**
 * Who may do what in the console — brief §16 "different departments can
 * publish into their authorised areas, but the product remains one NMU
 * experience", and §11's create → approve workflow.
 *
 * Two rules matter most:
 *   - publishing is scoped: an operator writes only into their categories
 *     (and a faculty publisher only to their faculty);
 *   - separation of duties: nobody approves their own notice.
 */

export type OperatorAction =
  | 'compose'
  | 'approve'
  | 'send-emergency'
  | 'manage-events'
  | 'manage-commerce'
  | 'manage-content'
  | 'moderate'
  | 'manage-audiences'
  | 'view-analytics'
  | 'manage-roles';

export const OPERATOR_ROLE_LABELS: Record<OperatorRole, string> = {
  'super-admin': 'Platform administrator',
  'comms-officer': 'Communications officer',
  'faculty-publisher': 'Faculty publisher',
  approver: 'Approver',
  'vendor-manager': 'Commerce manager',
  analyst: 'Analyst (read-only)',
};

export const OPERATOR_PERMISSIONS: Record<OperatorRole, OperatorAction[]> = {
  'super-admin': [
    'compose',
    'approve',
    'send-emergency',
    'manage-events',
    'manage-commerce',
    'manage-content',
    'moderate',
    'manage-audiences',
    'view-analytics',
    'manage-roles',
  ],
  'comms-officer': [
    'compose',
    'manage-events',
    'manage-content',
    'moderate',
    'manage-audiences',
    'view-analytics',
  ],
  'faculty-publisher': ['compose', 'manage-events', 'view-analytics'],
  approver: ['approve', 'send-emergency', 'moderate', 'view-analytics'],
  'vendor-manager': ['manage-commerce', 'view-analytics'],
  analyst: ['view-analytics'],
};

export const ACTION_LABELS: Record<OperatorAction, string> = {
  compose: 'Write notifications',
  approve: 'Approve notifications and events',
  'send-emergency': 'Send emergency notices',
  'manage-events': 'Manage events',
  'manage-commerce': 'Manage vendors and menus',
  'manage-content': 'Edit help content',
  moderate: 'Moderate listings',
  'manage-audiences': 'Build audiences',
  'view-analytics': 'View analytics',
  'manage-roles': 'Manage operators and roles',
};

export const allows = (op: Operator, action: OperatorAction): boolean =>
  OPERATOR_PERMISSIONS[op.role].includes(action);

export const canPublishInto = (op: Operator, category: NotificationCategory): boolean =>
  allows(op, 'compose') && (op.role === 'super-admin' || op.areas.includes(category));

/** Separation of duties: an approver never approves their own notice. */
export function canApprove(
  op: Operator,
  campaign: Campaign,
): { ok: true } | { ok: false; reason: string } {
  if (!allows(op, 'approve'))
    return { ok: false, reason: 'Your role can’t approve notifications.' };
  if (campaign.authorId === op.id)
    return { ok: false, reason: 'You wrote this notice — someone else must approve it.' };
  if (campaign.status !== 'pending-approval')
    return { ok: false, reason: 'This notice isn’t waiting for approval.' };
  return { ok: true };
}
