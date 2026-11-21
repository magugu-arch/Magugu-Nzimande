'use client';

import { announce } from '@hao/accessibility';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { ConsoleShell } from '../staff/ConsoleShell';

/** A minimal frame for accredited partners: no citizen navigation, no staff tools. */
export function PartnerShell({ children }: { children: ReactNode }) {
  const { session, ready, signOut } = useSession();
  const partner = ready && session?.role === 'partner' ? session : null;

  return (
    <ConsoleShell
      surface="Partner sandbox (concept)"
      homeHref="/partner/"
      account={
        partner
          ? { initials: partner.initials, name: partner.displayName, detail: 'Accredited partner' }
          : null
      }
      onSignOut={() => {
        signOut();
        announce('You are signed out of the partner sandbox.');
      }}
      line="Sandbox for accredited partners. Every request here is recorded, and the person it is about can see it."
    >
      {children}
    </ConsoleShell>
  );
}
