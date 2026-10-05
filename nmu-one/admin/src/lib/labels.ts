import type { NotificationCategory, NotificationPriority } from '@core/domain/models';
import type { Tone } from '@/components/ui';
import type { ConsoleData } from './seed';
import type { AdminEvent, Campaign, CampaignStatus, ServiceRecord } from './types';

export const STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  'pending-approval': { label: 'Awaiting approval', tone: 'warning' },
  'changes-requested': { label: 'Changes requested', tone: 'danger' },
  scheduled: { label: 'Scheduled', tone: 'info' },
  sent: { label: 'Sent', tone: 'success' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

export const EVENT_STATUS: Record<AdminEvent['status'], { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  'pending-approval': { label: 'Awaiting approval', tone: 'warning' },
  published: { label: 'Published', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export const SERVICE_STATUS: Record<ServiceRecord['status'], { label: string; tone: Tone }> = {
  live: { label: 'Live', tone: 'success' },
  pilot: { label: 'Pilot (demo data)', tone: 'info' },
  'awaiting-integration': { label: 'Awaiting integration', tone: 'warning' },
};

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  safety: 'Safety',
  academic: 'Academic',
  money: 'Money',
  campus: 'Campus',
  community: 'Community',
  alumni: 'Alumni',
  orders: 'Orders',
};

export const PRIORITY: Record<NotificationPriority, { label: string; tone: Tone; hint: string }> = {
  emergency: {
    label: 'Emergency',
    tone: 'danger',
    hint: 'Interrupts everyone, ignores quiet hours.',
  },
  high: { label: 'High', tone: 'warning', hint: 'Time-sensitive: a change to today’s plans.' },
  normal: { label: 'Normal', tone: 'info', hint: 'Useful news people will want to act on.' },
  low: { label: 'Low', tone: 'neutral', hint: 'Delivered quietly to the inbox, no sound.' },
};

/** The five workflow stages of brief §11, and where a campaign sits in them. */
export const STAGES = ['Create', 'Approve', 'Schedule', 'Deliver', 'Measure'] as const;

export function stageIndex(c: Campaign): number {
  switch (c.status) {
    case 'draft':
    case 'changes-requested':
      return 0;
    case 'pending-approval':
      return 1;
    case 'scheduled':
      return 2;
    case 'sent':
      return 4;
    case 'withdrawn':
      return -1;
  }
}

/** Screens a notification can open in NMU ONE. */
export function destinations(data: ConsoleData): { href: string; label: string }[] {
  const services = data.services.map((s) => ({ href: s.route, label: s.title }));
  const events = data.events
    .filter((e) => e.status === 'published')
    .map((e) => ({ href: `/events/${e.id}`, label: `Event: ${e.title}` }));
  return [
    ...services,
    ...events,
    { href: '/campus-map?to=EB212', label: 'Campus map: directions to EB212' },
    { href: '/notifications', label: 'Notifications inbox' },
  ];
}
