'use client';

import { announce } from '@hao/accessibility';
import { ClipboardList, Gauge, Headset, ScrollText } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/session';
import { ConsoleShell, type ConsoleNavItem } from './ConsoleShell';
import { useConsoleQuery } from './console-data';
import { STAFF_ROLE_WORDS } from './words';

const NAV: ConsoleNavItem[] = [
  { href: '/staff/queue/', label: 'Queue', icon: ClipboardList, alsoUnder: ['/staff/case/'] },
  { href: '/staff/dashboard/', label: 'Dashboard', icon: Gauge },
  { href: '/staff/support/', label: 'Support requests', icon: Headset },
  { href: '/staff/audit/', label: 'Audit log', icon: ScrollText },
];

/** The signed-in official's record: the session holds a name, the role comes from the staff list. */
export function useStaffMember() {
  const { session, ready } = useSession();
  const staffSession = ready && session?.role === 'staff' ? session : null;
  const staff = useConsoleQuery(['staff-members'], (g) => g.identity.listDemoStaff(), {
    enabled: Boolean(staffSession),
  });
  const member = staff.data?.find((entry) => entry.staffRef === staffSession?.subjectRef) ?? null;
  return { session: staffSession, member };
}

/**
 * The staff console frame: visibly not the public service. Navigation only
 * appears once an official is signed in.
 */
export function StaffShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { signOut } = useSession();
  const { session, member } = useStaffMember();

  const leave = () => {
    signOut();
    announce('You are signed out of the staff console.');
    router.push('/staff/');
  };

  return (
    <ConsoleShell
      surface="Staff console (concept)"
      homeHref={session ? '/staff/queue/' : '/staff/'}
      account={
        session
          ? {
              initials: session.initials,
              name: session.displayName,
              detail: member ? STAFF_ROLE_WORDS[member.role] : 'Official',
            }
          : null
      }
      onSignOut={leave}
      nav={NAV}
      navLabel="Staff console"
      line="Official use. Every action here is recorded in the audit trail."
    >
      {children}
    </ConsoleShell>
  );
}
