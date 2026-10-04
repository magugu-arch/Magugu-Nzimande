import type { AppNotification, NotificationPriority } from '../domain/models';

const RANK: Record<NotificationPriority, number> = { emergency: 3, high: 2, normal: 1, low: 0 };

/**
 * The single notice Home surfaces (brief §5 "one critical notification"):
 * the most urgent unread, unexpired notification at high priority or above,
 * newest first among equals. Normal and low notices stay in the inbox.
 */
export function criticalNotice(list: AppNotification[], now: Date): AppNotification | null {
  const candidates = list.filter(
    (n) =>
      !n.read &&
      RANK[n.priority] >= RANK.high &&
      (n.expiresAt === null || new Date(n.expiresAt) > now),
  );
  candidates.sort(
    (a, b) => RANK[b.priority] - RANK[a.priority] || b.createdAt.localeCompare(a.createdAt),
  );
  return candidates[0] ?? null;
}

export const unreadCount = (list: AppNotification[]) => list.filter((n) => !n.read).length;

/**
 * Quiet hours (brief §11): non-urgent pushes wait; emergencies never do.
 * `start`/`end` are minutes since midnight and may wrap past midnight.
 */
export function suppressedByQuietHours(
  priority: NotificationPriority,
  minutesOfDay: number,
  quiet: { enabled: boolean; start: number; end: number },
): boolean {
  if (!quiet.enabled || priority === 'emergency') return false;
  const { start, end } = quiet;
  return start <= end
    ? minutesOfDay >= start && minutesOfDay < end
    : minutesOfDay >= start || minutesOfDay < end;
}
