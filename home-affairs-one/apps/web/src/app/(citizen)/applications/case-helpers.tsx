import type { ApplicationCase, Appointment } from '@hao/api-contracts';
import { PageHeader, Tag, type PageHeaderProps } from '@hao/design-system';
import { Ban, CalendarCheck, CircleCheck, Clock3 } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDay, formatTime, formatTimeInZone } from '@/lib/format';
import styles from './case-helpers.module.css';

/**
 * Small pieces shared by the applications and appointments routes: links,
 * what a case's milestones say about its in-person step, and how an
 * appointment's time is written when the service point is in another zone.
 */

export const SAST = 'Africa/Johannesburg';

export const caseHref = (caseId: string) => `/applications/case/?id=${encodeURIComponent(caseId)}`;
export const bookingHref = (caseId: string) => `/appointments/?case=${encodeURIComponent(caseId)}`;
export const servicePointHref = (id: string) =>
  `/service-points/point/?id=${encodeURIComponent(id)}`;

/** Workflow descriptions come with or without a full stop; show them as a sentence. */
export function sentence(text: string): string {
  const trimmed = text.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** True when the case follows the plan with an in-person step that is already finished. */
export function isCaptureDone(item: ApplicationCase): boolean {
  return item.milestones.some((step) => step.key === 'capture' && step.state === 'done');
}

/** Why booking no longer applies to a case, or `null` when it can still be booked or changed. */
export function bookingLock(item: ApplicationCase): string | null {
  if (item.status === 'CLOSED') return 'This application is closed, so there is nothing to book.';
  if (isCaptureDone(item)) {
    return 'The in-person step for this application is already complete, so there is no appointment to book or change.';
  }
  if (!item.milestones.some((step) => step.key === 'capture')) {
    return 'This application has no in-person step, so it does not need an appointment.';
  }
  return null;
}

/** Booked and still ahead of us. `now` defaults to the device clock. */
export function isUpcoming(appointment: Appointment, now: Date = new Date()): boolean {
  return appointment.status === 'BOOKED' && Date.parse(appointment.startsAt) > now.getTime();
}

/** The calendar day at the service point: `Thursday, 26 November`. */
export function formatAppointmentDay(iso: string, timeZone: string): string {
  if (timeZone === SAST) return formatDay(iso);
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

/**
 * Day and time of an appointment. For a service point outside South Africa the
 * local time there comes first, with South African time alongside.
 */
export function AppointmentWhen({ startsAt, timeZone }: { startsAt: string; timeZone: string }) {
  const day = formatAppointmentDay(startsAt, timeZone);
  if (timeZone === SAST) {
    return (
      <div className={styles.when}>
        <p className={styles.whenDay}>{day}</p>
        <p className={styles.whenTime}>{formatTime(startsAt)}</p>
      </div>
    );
  }
  const sastDay = formatDay(startsAt);
  return (
    <div className={styles.when}>
      <p className={styles.whenDay}>{day}</p>
      <p className={styles.whenTime}>
        {formatTimeInZone(startsAt, timeZone)}{' '}
        <span className={styles.whenNote}>local time at the service point</span>
      </p>
      <p className={styles.whenAlt}>
        {formatTime(startsAt)} South African time{sastDay === day ? '' : ` (${sastDay})`}
      </p>
    </div>
  );
}

/**
 * An appointment's state in words with an icon. The appointments mock never
 * marks a booking as attended, so `visited` (the case's in-person step is
 * recorded as complete) is passed in by the screen.
 */
export function AppointmentStatusTag({
  appointment,
  visited = false,
}: {
  appointment: Appointment;
  visited?: boolean;
}) {
  if (appointment.status === 'CANCELLED') {
    return <Tag icon={<Ban aria-hidden="true" />}>Cancelled</Tag>;
  }
  if (appointment.status === 'ATTENDED') {
    return (
      <Tag tone="success" icon={<CircleCheck aria-hidden="true" />}>
        Attended
      </Tag>
    );
  }
  if (visited) {
    return (
      <Tag tone="success" icon={<CircleCheck aria-hidden="true" />}>
        In-person step completed
      </Tag>
    );
  }
  if (isUpcoming(appointment)) {
    return (
      <Tag tone="info" icon={<CalendarCheck aria-hidden="true" />}>
        Booked
      </Tag>
    );
  }
  return <Tag icon={<Clock3 aria-hidden="true" />}>Time has passed</Tag>;
}

/** A page header with a small photograph beside it on wide screens; phones get the text only. */
export function PhotoHeader({ photo, ...header }: PageHeaderProps & { photo: ReactNode }) {
  return (
    <div className={styles.photoHeader}>
      <PageHeader {...header} />
      <div className={styles.photoHeaderImage}>{photo}</div>
    </div>
  );
}
