import {
  can,
  permissions,
  rolePermissions,
  roles,
  type Permission,
  type Role,
} from '@scarlets/domain';

/**
 * The people who may use the console. Supporters have no business here, and
 * the service role is for machines: neither can sign in or act through it.
 */
export const consoleRoles = ['editor', 'moderator', 'partner_admin', 'club_admin'] as const;
export type ConsoleRole = (typeof consoleRoles)[number];

export function isConsoleRole(role: Role): role is ConsoleRole {
  return (consoleRoles as readonly Role[]).includes(role);
}

/**
 * The one check every mutation makes. Holding the permission is not enough:
 * the actor must also be a console role, so a service token cannot stand in
 * for the human approval that publishing needs.
 */
export function mayAct(role: Role, permission: Permission): boolean {
  return isConsoleRole(role) && can(role, permission);
}

export const roleLabels: Record<Role, string> = {
  supporter: 'Supporter',
  editor: 'Editor',
  moderator: 'Moderator',
  club_admin: 'Club admin',
  partner_admin: 'Partner admin',
  service: 'Service',
};

/** What each permission lets someone do, as the end of "Editor cannot …". */
export const permissionActions: Record<Permission, string> = {
  'content.read': 'read content',
  'content.write': 'write content drafts',
  'content.publish': 'publish, schedule, pin or archive content',
  'fixtures.override': 'change fixture visibility or notices',
  'campaigns.read': 'read partner campaigns',
  'campaigns.write': 'write partner campaign drafts',
  'campaigns.approve': 'approve partner campaigns',
  'moderation.review': 'review Fan Zone submissions',
  'notifications.schedule': 'schedule or test push notifications',
  'roles.manage': 'change staff roles',
  'audit.read': 'read the audit log',
  'flags.manage': 'manage feature flags',
  'rewards.adjust': 'adjust reward balances',
};

/** Human roles holding a permission. The service role is deliberately left out. */
export function humanRolesWith(permission: Permission): Role[] {
  return roles.filter((role) => role !== 'service' && can(role, permission));
}

export function denialMessage(role: Role, permission: Permission): string {
  const holders = humanRolesWith(permission).filter(isConsoleRole);
  const who =
    holders.length > 0
      ? `Held by: ${holders.map((holder) => roleLabels[holder]).join(', ')}.`
      : 'No human role holds it.';
  return `Refused. ${roleLabels[role]} cannot ${permissionActions[permission]} (needs ${permission}). ${who}`;
}

export interface Section {
  id: string;
  href: string;
  label: string;
  /** Null: open to every signed-in console role. */
  permission: Permission | null;
}

export const sections: readonly Section[] = [
  { id: 'overview', href: '/', label: 'Overview', permission: null },
  { id: 'content', href: '/content', label: 'Content', permission: 'content.read' },
  { id: 'fixtures', href: '/fixtures', label: 'Fixtures', permission: 'fixtures.override' },
  { id: 'campaigns', href: '/campaigns', label: 'Campaigns', permission: 'campaigns.read' },
  { id: 'moderation', href: '/moderation', label: 'Moderation', permission: 'moderation.review' },
  {
    id: 'notifications',
    href: '/notifications',
    label: 'Notifications',
    permission: 'notifications.schedule',
  },
  { id: 'roles', href: '/roles', label: 'Roles', permission: 'roles.manage' },
  { id: 'audit', href: '/audit', label: 'Audit log', permission: 'audit.read' },
];

export function canOpen(role: Role, section: Section): boolean {
  if (!isConsoleRole(role)) return false;
  return section.permission === null || can(role, section.permission);
}

/** The navigation for a role: only what it may open. */
export function sectionsFor(role: Role): Section[] {
  return sections.filter((section) => canOpen(role, section));
}

export interface MatrixRow {
  permission: Permission;
  action: string;
  byRole: Record<Role, boolean>;
}

/** The permission matrix, straight from the domain's `rolePermissions`. */
export function permissionMatrix(): MatrixRow[] {
  return permissions.map((permission) => ({
    permission,
    action: permissionActions[permission],
    byRole: Object.fromEntries(
      roles.map((role) => [role, rolePermissions[role].includes(permission)]),
    ) as Record<Role, boolean>,
  }));
}

/** Roles a club admin may give a person. `supporter` removes console access. */
export const assignableRoles = [...consoleRoles, 'supporter'] as const satisfies readonly Role[];
export type AssignableRole = (typeof assignableRoles)[number];

export function isAssignableRole(role: string): role is AssignableRole {
  return (assignableRoles as readonly string[]).includes(role);
}
