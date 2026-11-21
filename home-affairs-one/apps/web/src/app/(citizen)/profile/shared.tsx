import type { Contact } from '@hao/api-contracts';
import { tierForSignIn, type Session } from '@hao/auth-client';
import { Tag } from '@hao/design-system';
import type { AssuranceTier } from '@hao/shared-types';
import { CircleCheck, CircleDashed, Mail, MessageCircle, MessageSquareText } from 'lucide-react';
import type { ReactNode } from 'react';

/** Contact channels in words. Values are always masked by the identity adapter. */
export const CONTACT_LABEL: Record<Contact['channel'], string> = {
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
};

export const CONTACT_ICON: Record<Contact['channel'], ReactNode> = {
  EMAIL: <Mail aria-hidden="true" />,
  SMS: <MessageSquareText aria-hidden="true" />,
  WHATSAPP: <MessageCircle aria-hidden="true" />,
};

/** Verified or not, in words and with an icon — never by colour alone. */
export function VerifiedTag({ verified }: { verified: boolean }) {
  return verified ? (
    <Tag tone="success" icon={<CircleCheck aria-hidden="true" />}>
      Verified
    </Tag>
  ) : (
    <Tag tone="neutral" icon={<CircleDashed aria-hidden="true" />}>
      Not verified
    </Tag>
  );
}

/** True when the moment has passed, by this device's clock. Browser only. */
export function isPast(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now();
}

/**
 * The tier a session holds right now. A step-up that has run out falls back to
 * the sign-in tier, even if the session in memory has not been refreshed yet.
 */
export function currentTier(session: Session): AssuranceTier {
  if (session.stepUpExpiresAt && isPast(session.stepUpExpiresAt)) {
    return tierForSignIn(session.accountTier, session.method);
  }
  return session.tier;
}
