import type { InboxMessage } from '@hao/api-contracts';
import type { Channel } from '@hao/shared-types';
import {
  BellRing,
  CalendarCheck,
  CircleAlert,
  FileText,
  LockKeyhole,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Words and icons shared by the four messaging screens. Local to this route:
 * nothing here is read from a photograph or invented about a real service.
 */

type CategoryTone = 'neutral' | 'info' | 'attention' | 'teal';

/** Inbox categories in plain words, with the tag tone and the row's lead icon. */
export const CATEGORY_INFO: Record<
  InboxMessage['category'],
  { label: string; tone: CategoryTone; icon: ReactNode }
> = {
  CASE_UPDATE: { label: 'Application update', tone: 'info', icon: <FileText /> },
  ACTION_REQUIRED: { label: 'Action needed', tone: 'attention', icon: <CircleAlert /> },
  RECEIPT: { label: 'Receipt', tone: 'neutral', icon: <Receipt /> },
  APPOINTMENT: { label: 'Appointment', tone: 'teal', icon: <CalendarCheck /> },
  SECURITY: { label: 'Security', tone: 'attention', icon: <ShieldAlert /> },
  SERVICE_NOTICE: { label: 'Service notice', tone: 'neutral', icon: <Megaphone /> },
};

/** Generic line icons only. No channel provider's logo or colours are used anywhere. */
export const CHANNEL_ICON: Record<Channel, ReactNode> = {
  SECURE_INBOX: <LockKeyhole />,
  PUSH: <BellRing />,
  WHATSAPP: <MessageCircle />,
  EMAIL: <Mail />,
  SMS: <MessageSquareText />,
};

/** `application_status_changed_v1` → `Application status changed`. */
export function templateInWords(templateKey: string): string {
  const words = templateKey
    .replace(/_v\d+$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (words === '') return 'Message';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Only follow a link from stored message data when it stays inside this app. */
export function isInAppHref(href: string): boolean {
  return href.startsWith('/') && !href.startsWith('//');
}

export function messageHref(messageId: string): string {
  return `/messages/view/?id=${encodeURIComponent(messageId)}`;
}

export function caseHref(caseId: string): string {
  return `/applications/case/?id=${encodeURIComponent(caseId)}`;
}
