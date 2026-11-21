import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { StaffShell } from './StaffShell';

export const metadata: Metadata = {
  title: { default: 'Staff console', template: '%s · Staff console · Home Affairs One (concept)' },
};

/** The staff console sits outside the citizen route group, with its own shell. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
