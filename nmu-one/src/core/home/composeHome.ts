import type { Role } from '../domain/models';

/**
 * Home is the daily command centre (brief §5): "What matters to me right
 * now?" — not a departmental news wall. This decides which modules appear,
 * in what order, for a role in a context, honouring the person's own layout.
 *
 * Rules from the brief, enforced here and tested:
 *   - Role decides the starting set; context removes what is not relevant now.
 *   - At most one critical notice, always near the top, and it cannot be hidden.
 *   - People can reorder and hide everything else.
 */

export type HomeModuleId =
  | 'next-class'
  | 'critical-notice'
  | 'money'
  | 'shuttle'
  | 'quick-actions'
  | 'lunch'
  | 'today'
  | 'discover'
  | 'graduation'
  | 'teaching'
  | 'linked-student'
  | 'key-dates'
  | 'support'
  | 'mentoring'
  | 'giving'
  | 'alumni-events'
  | 'jobs';

export const MODULE_LABELS: Record<HomeModuleId, string> = {
  'next-class': 'Next class',
  'critical-notice': 'Important notice',
  money: 'Fees & funding',
  shuttle: 'Next shuttle',
  'quick-actions': 'Quick actions',
  lunch: 'Lunch on campus',
  today: 'Rest of today',
  discover: 'Happening on campus',
  graduation: 'Graduation',
  teaching: 'Teaching today',
  'linked-student': 'Your student',
  'key-dates': 'Key dates',
  support: 'Support for families',
  mentoring: 'Mentoring',
  giving: 'Giving',
  'alumni-events': 'Alumni events',
  jobs: 'Careers',
};

export const ROLE_DEFAULTS: Record<Role, HomeModuleId[]> = {
  student: [
    'next-class',
    'critical-notice',
    'money',
    'shuttle',
    'quick-actions',
    'lunch',
    'today',
    'graduation',
    'discover',
  ],
  staff: ['teaching', 'critical-notice', 'quick-actions', 'shuttle', 'lunch', 'discover'],
  parent: ['linked-student', 'critical-notice', 'key-dates', 'quick-actions', 'support', 'discover'],
  alumni: ['critical-notice', 'mentoring', 'quick-actions', 'giving', 'alumni-events', 'jobs'],
};

/** Safety-critical communication cannot be switched off from Home. */
export const PINNED: ReadonlySet<HomeModuleId> = new Set(['critical-notice']);

export interface HomeContext {
  role: Role;
  /** SAST wall-clock minutes since midnight. */
  minutesOfDay: number;
  hasCriticalNotice: boolean;
  /** Something in fees or funding needs the person's attention. */
  moneyNeedsAttention: boolean;
  graduationEligible: boolean;
  hasActiveOrder: boolean;
}

export interface HomeLayout {
  order: HomeModuleId[];
  hidden: HomeModuleId[];
}

const LUNCH_OPENS = 10 * 60 + 30;
const LUNCH_CLOSES = 14 * 60 + 30;

function relevant(id: HomeModuleId, ctx: HomeContext): boolean {
  switch (id) {
    case 'critical-notice':
      return ctx.hasCriticalNotice;
    case 'money':
      return ctx.moneyNeedsAttention;
    case 'lunch':
      // Brief §5: transport/utility "when relevant". Lunch is relevant around
      // lunch — or while an order is on its way.
      return ctx.hasActiveOrder || (ctx.minutesOfDay >= LUNCH_OPENS - 60 && ctx.minutesOfDay < LUNCH_CLOSES);
    case 'graduation':
      return ctx.graduationEligible;
    default:
      return true;
  }
}

/** Modules the person may place on Home for their role (for the editor). */
export const availableModules = (role: Role): HomeModuleId[] => ROLE_DEFAULTS[role];

export function composeHome(ctx: HomeContext, layout?: HomeLayout | null): HomeModuleId[] {
  const allowed = ROLE_DEFAULTS[ctx.role];
  // The person's order first (only modules this role may have), then any
  // defaults their saved layout predates.
  const ordered = [
    ...(layout?.order ?? []).filter((id) => allowed.includes(id)),
    ...allowed.filter((id) => !(layout?.order ?? []).includes(id)),
  ];
  const hidden = new Set((layout?.hidden ?? []).filter((id) => !PINNED.has(id)));

  const visible = ordered.filter((id) => !hidden.has(id) && relevant(id, ctx));

  // One critical notice, second at the latest — never buried by a reorder.
  const i = visible.indexOf('critical-notice');
  if (i > 1) {
    visible.splice(i, 1);
    visible.splice(Math.min(1, visible.length), 0, 'critical-notice');
  }
  return visible;
}

/** Moves a module up or down within a layout, for the Home editor. */
export function moveModule(order: HomeModuleId[], id: HomeModuleId, delta: -1 | 1): HomeModuleId[] {
  const i = order.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}
