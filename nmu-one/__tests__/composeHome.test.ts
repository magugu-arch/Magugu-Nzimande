import { composeHome, moveModule, ROLE_DEFAULTS, type HomeContext } from '@/core/home/composeHome';
import { criticalNotice, suppressedByQuietHours, unreadCount } from '@/core/notifications/priority';
import type { AppNotification } from '@/core/domain/models';

const ctx = (over: Partial<HomeContext> = {}): HomeContext => ({
  role: 'student',
  minutesOfDay: 9 * 60 + 40,
  hasCriticalNotice: true,
  moneyNeedsAttention: true,
  graduationEligible: false,
  hasActiveOrder: false,
  ...over,
});

describe('Home — the daily command centre (brief §5)', () => {
  it('leads a student with the next class, then one critical notice', () => {
    const mods = composeHome(ctx());
    expect(mods[0]).toBe('next-class');
    expect(mods[1]).toBe('critical-notice');
    expect(mods.filter((m) => m === 'critical-notice')).toHaveLength(1);
  });

  it('keeps the number of primary actions above the fold small', () => {
    // Next class, notice, money, shuttle, quick actions: five modules before scroll.
    expect(composeHome(ctx()).slice(0, 5)).toEqual([
      'next-class',
      'critical-notice',
      'money',
      'shuttle',
      'quick-actions',
    ]);
  });

  it('drops modules that are not relevant right now', () => {
    const mods = composeHome(ctx({ hasCriticalNotice: false, moneyNeedsAttention: false }));
    expect(mods).not.toContain('critical-notice');
    expect(mods).not.toContain('money');
    expect(mods).not.toContain('graduation');
  });

  it('shows lunch around lunchtime or while an order is on its way', () => {
    expect(composeHome(ctx({ minutesOfDay: 8 * 60 }))).not.toContain('lunch');
    expect(composeHome(ctx({ minutesOfDay: 12 * 60 }))).toContain('lunch');
    expect(composeHome(ctx({ minutesOfDay: 18 * 60, hasActiveOrder: true }))).toContain('lunch');
  });

  it('changes with the role', () => {
    expect(composeHome(ctx({ role: 'staff' }))[0]).toBe('teaching');
    expect(composeHome(ctx({ role: 'parent' }))[0]).toBe('linked-student');
    expect(composeHome(ctx({ role: 'alumni' }))).toContain('mentoring');
    expect(composeHome(ctx({ role: 'alumni' }))).not.toContain('next-class');
  });

  it('honours a person’s order and hidden modules', () => {
    const mods = composeHome(ctx({ hasCriticalNotice: false }), {
      order: ['quick-actions', 'next-class'],
      hidden: ['shuttle'],
    });
    expect(mods[0]).toBe('quick-actions');
    expect(mods[1]).toBe('next-class');
    expect(mods).not.toContain('shuttle');
  });

  it('never lets a critical notice be hidden or buried', () => {
    const mods = composeHome(ctx(), {
      order: ['quick-actions', 'today', 'discover', 'next-class', 'critical-notice'],
      hidden: ['critical-notice'],
    });
    expect(mods.indexOf('critical-notice')).toBe(1);
  });

  it('ignores modules a saved layout names that the role may not have', () => {
    const mods = composeHome(ctx({ role: 'parent' }), {
      order: ['next-class', 'money'],
      hidden: [],
    });
    expect(mods).not.toContain('next-class');
    expect(mods).not.toContain('money');
  });

  it('moves modules up and down within bounds', () => {
    const order = ROLE_DEFAULTS.student;
    expect(moveModule(order, 'money', -1).indexOf('money')).toBe(order.indexOf('money') - 1);
    expect(moveModule(order, 'next-class', -1)).toEqual(order);
  });
});

const n = (over: Partial<AppNotification>): AppNotification => ({
  id: Math.random().toString(36),
  title: 't',
  body: 'b',
  category: 'campus',
  priority: 'normal',
  createdAt: '2026-10-05T07:00:00.000Z',
  read: false,
  action: null,
  publisher: 'p',
  expiresAt: null,
  ...over,
});

describe('notification priority', () => {
  const now = new Date('2026-10-05T08:00:00.000Z');

  it('surfaces the most urgent unread notice, newest first', () => {
    const list = [
      n({ id: 'low', priority: 'low' }),
      n({ id: 'old-high', priority: 'high', createdAt: '2026-10-05T06:00:00.000Z' }),
      n({ id: 'new-high', priority: 'high', createdAt: '2026-10-05T07:30:00.000Z' }),
      n({ id: 'read-emergency', priority: 'emergency', read: true }),
    ];
    expect(criticalNotice(list, now)?.id).toBe('new-high');
    expect(criticalNotice([...list, n({ id: 'em', priority: 'emergency' })], now)?.id).toBe('em');
  });

  it('never surfaces normal notices or expired ones', () => {
    expect(criticalNotice([n({ priority: 'normal' })], now)).toBeNull();
    expect(
      criticalNotice([n({ priority: 'high', expiresAt: '2026-10-05T07:59:00.000Z' })], now),
    ).toBeNull();
  });

  it('counts unread', () => {
    expect(unreadCount([n({}), n({ read: true }), n({})])).toBe(2);
  });

  it('holds non-urgent notices in quiet hours across midnight, never emergencies', () => {
    const quiet = { enabled: true, start: 22 * 60, end: 6 * 60 };
    expect(suppressedByQuietHours('normal', 23 * 60, quiet)).toBe(true);
    expect(suppressedByQuietHours('high', 2 * 60, quiet)).toBe(true);
    expect(suppressedByQuietHours('normal', 12 * 60, quiet)).toBe(false);
    expect(suppressedByQuietHours('emergency', 23 * 60, quiet)).toBe(false);
    expect(suppressedByQuietHours('normal', 23 * 60, { ...quiet, enabled: false })).toBe(false);
  });
});
