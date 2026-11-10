/**
 * Staff roles and permissions. The database (see supabase/migrations) and the
 * admin server both enforce this matrix; hiding a button is never the control.
 */
export const ROLES = [
  'super_admin',
  'content_admin',
  'moderator',
  'support_agent',
  'analyst',
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'ops.read',
  'audit.read',
  'content.read',
  'content.write',
  'content.publish',
  'fixtures.manage',
  'moderation.read',
  'moderation.act',
  'moderation.escalate',
  'notifications.draft',
  'notifications.schedule',
  'rewards.manage',
  'support.read_profile',
  'roles.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = new Set<Permission>(PERMISSIONS);

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: ALL,
  content_admin: new Set<Permission>([
    'ops.read',
    'content.read',
    'content.write',
    'content.publish',
    'fixtures.manage',
    'notifications.draft',
    'notifications.schedule',
    'rewards.manage',
  ]),
  moderator: new Set<Permission>([
    'ops.read',
    'content.read',
    'moderation.read',
    'moderation.act',
    'moderation.escalate',
  ]),
  support_agent: new Set<Permission>([
    'ops.read',
    'content.read',
    'moderation.read',
    'moderation.escalate',
    'support.read_profile',
  ]),
  analyst: new Set<Permission>(['ops.read', 'content.read', 'moderation.read', 'audit.read']),
};

export const ROLE_COPY: Record<Role, { label: string; summary: string }> = {
  super_admin: { label: 'Super admin', summary: 'Everything, including staff roles.' },
  content_admin: {
    label: 'Content admin',
    summary: 'Publishes home modules, stories, fixtures and campaigns.',
  },
  moderator: { label: 'Moderator', summary: 'Reviews and acts on Fan Moments and reports.' },
  support_agent: {
    label: 'Support agent',
    summary: 'Looks up supporter issues and escalates content.',
  },
  analyst: { label: 'Analyst (read-only)', summary: 'Reads dashboards and the audit log.' },
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function rolesWith(permission: Permission): Role[] {
  return ROLES.filter((r) => ROLE_PERMISSIONS[r].has(permission));
}

export class PermissionError extends Error {
  constructor(
    public readonly permission: Permission,
    public readonly role: Role | null,
  ) {
    super(`Role ${role ?? 'none'} lacks permission ${permission}`);
    this.name = 'PermissionError';
  }
}

export function assertCan(role: Role | null | undefined, permission: Permission): void {
  if (!can(role, permission)) throw new PermissionError(permission, role ?? null);
}
