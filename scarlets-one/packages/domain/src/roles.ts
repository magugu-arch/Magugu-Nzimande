export const roles = [
  'supporter',
  'editor',
  'moderator',
  'club_admin',
  'partner_admin',
  'service',
] as const;
export type Role = (typeof roles)[number];

export const permissions = [
  'content.read',
  'content.write',
  'content.publish',
  'fixtures.override',
  'campaigns.read',
  'campaigns.write',
  'campaigns.approve',
  'moderation.review',
  'notifications.schedule',
  'roles.manage',
  'audit.read',
  'flags.manage',
  'rewards.adjust',
] as const;
export type Permission = (typeof permissions)[number];

/**
 * Who may do what in the operations console. The same matrix is mirrored by
 * the row-level security policies in supabase/migrations, so a role that
 * cannot do something here cannot do it by calling the database directly.
 *
 * Nobody but the service role can adjust rewards: balances belong to the
 * rewards provider, and a human editing one would break its audit trail.
 */
export const rolePermissions: Record<Role, readonly Permission[]> = {
  supporter: [],
  editor: ['content.read', 'content.write', 'campaigns.read'],
  moderator: ['content.read', 'moderation.review'],
  partner_admin: ['campaigns.read', 'campaigns.write'],
  club_admin: [
    'content.read',
    'content.write',
    'content.publish',
    'fixtures.override',
    'campaigns.read',
    'campaigns.write',
    'campaigns.approve',
    'moderation.review',
    'notifications.schedule',
    'roles.manage',
    'audit.read',
    'flags.manage',
  ],
  service: [...permissions],
};

export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
