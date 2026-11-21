'use client';

import { Card, Container, LinkButton, LoadingState, Stack, Tag } from '@hao/design-system';
import { ASSURANCE_TIER_INFO, meetsTier, type AssuranceTier, type Role } from '@hao/shared-types';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';

export interface RequireTierProps {
  /** Minimum assurance tier for this screen. Defaults to A1 (any signed-in citizen). */
  tier?: AssuranceTier;
  /** Finishes the sentence "Sign in to …", e.g. "see your applications". */
  reason: string;
  children: ReactNode;
}

function Gate({ children }: { children: ReactNode }) {
  return (
    <Container width="narrow" style={{ paddingBlock: 'var(--space-7)' }}>
      {children}
    </Container>
  );
}

/**
 * Client-side guard for signed-in screens. It explains what is needed and
 * offers the next step — it never leaves a blank page or a silent redirect.
 *
 * This is a usability guard, not a security control: the prototype has no
 * server. Real enforcement belongs at the API gateway.
 */
export function RequireTier({ tier = 'A1', reason, children }: RequireTierProps) {
  const { session, ready } = useSession();
  const pathname = usePathname();

  if (!ready) {
    return (
      <Gate>
        <LoadingState label="Checking your sign-in" rows={2} />
      </Gate>
    );
  }

  if (!session || session.role !== 'citizen') {
    return (
      <Gate>
        <Card>
          <Stack gap={4}>
            <LockKeyhole aria-hidden="true" size={28} />
            <h1 style={{ fontSize: 'var(--text-2xl)' }}>Sign in to {reason}</h1>
            <p>
              Your applications, messages and profile are only shown after you sign in. Public
              guidance, service points and help stay open to everyone.
            </p>
            <div>
              <LinkButton href={`/sign-in/?next=${encodeURIComponent(pathname)}`}>
                Sign in
              </LinkButton>
            </div>
          </Stack>
        </Card>
      </Gate>
    );
  }

  if (!meetsTier(session.tier, tier)) {
    return (
      <Gate>
        <Card tone="attention">
          <Stack gap={4}>
            <ShieldCheck aria-hidden="true" size={28} />
            <h1 style={{ fontSize: 'var(--text-2xl)' }}>This needs a stronger check</h1>
            <p>
              To {reason} your account needs to be at the “{ASSURANCE_TIER_INFO[tier].label}” level.
              You are signed in at “{ASSURANCE_TIER_INFO[session.tier].label}”.
            </p>
            <p>
              <Tag tone="info">What this level means</Tag> {ASSURANCE_TIER_INFO[tier].summary}
            </p>
            <div>
              <LinkButton href="/profile/security/" variant="secondary">
                See how to verify your account
              </LinkButton>
            </div>
          </Stack>
        </Card>
      </Gate>
    );
  }

  return <>{children}</>;
}

/** Guard for the staff console and partner sandbox. */
export function RequireRole({
  role,
  signInHref,
  children,
}: {
  role: Exclude<Role, 'citizen'>;
  signInHref: string;
  children: ReactNode;
}) {
  const { session, ready } = useSession();
  if (!ready) {
    return (
      <Gate>
        <LoadingState label="Checking your sign-in" rows={2} />
      </Gate>
    );
  }
  if (session?.role !== role) {
    return (
      <Gate>
        <Card>
          <Stack gap={4}>
            <LockKeyhole aria-hidden="true" size={28} />
            <h1 style={{ fontSize: 'var(--text-2xl)' }}>
              {role === 'staff' ? 'Staff sign-in required' : 'Partner sign-in required'}
            </h1>
            <p>
              This area is separate from the public service. It needs an official role, and every
              action in it is recorded in the audit trail.
            </p>
            <div>
              <LinkButton href={signInHref}>Go to sign-in</LinkButton>
            </div>
          </Stack>
        </Card>
      </Gate>
    );
  }
  return <>{children}</>;
}
