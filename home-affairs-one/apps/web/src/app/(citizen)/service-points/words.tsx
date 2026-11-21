import type {
  AccessFeature,
  PointCapability,
  ServicePoint,
  ServicePointKind,
} from '@hao/api-contracts';
import { Tag, type Tone } from '@hao/design-system';
import { CircleCheck, CircleDot, CircleHelp, CircleMinus } from 'lucide-react';
import type { ReactNode } from 'react';

/** Words for the service-point screens. Shared by the finder, the point page and /abroad/. */

export const SAST = 'Africa/Johannesburg';

export const KIND_LABEL: Record<ServicePointKind, string> = {
  SERVICE_OFFICE: 'Service office',
  PARTNER_BANK: 'Partner bank point',
  MOBILE_UNIT: 'Mobile unit',
  KIOSK: 'Self-service kiosk',
  MISSION_ABROAD: 'Mission abroad',
};

/** In the order the filter shows them. */
export const ACCESS_FEATURES: readonly AccessFeature[] = [
  'STEP_FREE',
  'ACCESSIBLE_PARKING',
  'HEARING_LOOP',
  'SIGN_LANGUAGE_BY_BOOKING',
  'QUIET_HOUR',
  'ASSISTED_DIGITAL',
];

export const ACCESS_LABEL: Record<AccessFeature, string> = {
  STEP_FREE: 'Step-free access',
  ACCESSIBLE_PARKING: 'Accessible parking',
  HEARING_LOOP: 'Hearing loop',
  SIGN_LANGUAGE_BY_BOOKING: 'Sign language by booking',
  QUIET_HOUR: 'Quiet hour',
  ASSISTED_DIGITAL: 'Help with digital steps',
};

export const CAPABILITY_LABEL: Record<PointCapability, string> = {
  APPLICATIONS: 'Start or continue an application',
  IDENTITY_CAPTURE: 'In-person identity capture',
  COLLECTION: 'Collect a document',
  PAYMENTS: 'Pay',
  SELF_SERVICE: 'Self-service',
};

const AVAILABILITY: Record<
  ServicePoint['availability'],
  { label: string; tone: Tone; icon: ReactNode }
> = {
  OPEN: { label: 'Open today', tone: 'success', icon: <CircleCheck aria-hidden="true" /> },
  LIMITED: { label: 'Limited service', tone: 'attention', icon: <CircleDot aria-hidden="true" /> },
  CLOSED_TODAY: { label: 'Closed today', tone: 'neutral', icon: <CircleMinus aria-hidden="true" /> },
  NOT_REPORTED: {
    label: 'Status not reported',
    tone: 'neutral',
    icon: <CircleHelp aria-hidden="true" />,
  },
};

export function availabilityLabel(availability: ServicePoint['availability']): string {
  return AVAILABILITY[availability].label;
}

/** Availability in words with an icon, never colour alone. */
export function AvailabilityTag({ availability }: { availability: ServicePoint['availability'] }) {
  const info = AVAILABILITY[availability];
  return (
    <Tag tone={info.tone} icon={info.icon}>
      {info.label}
    </Tag>
  );
}

export function pointHref(id: string): string {
  return `/service-points/point/?id=${encodeURIComponent(id)}`;
}

/** `Monday to Friday, 08:00 to 15:30` — sample hours, one line per entry. */
export function hoursLines(point: ServicePoint): string[] {
  return point.hours.map((entry) => `${entry.days}, ${entry.open} to ${entry.close}`);
}

/** `Europe/London` stays as it is; underscores in zone names become spaces. */
export function zoneLabel(timeZone: string): string {
  return timeZone.replace(/_/g, ' ');
}

/** The calendar day in a given time zone: `Wednesday, 25 November`. */
export function formatDayInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}
