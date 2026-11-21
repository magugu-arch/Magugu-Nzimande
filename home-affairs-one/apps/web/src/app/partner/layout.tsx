import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PartnerShell } from './PartnerShell';

export const metadata: Metadata = {
  title: {
    default: 'Partner sandbox · Home Affairs One (concept)',
    template: '%s · Partner sandbox · Home Affairs One (concept)',
  },
};

/** The partner sandbox sits outside the citizen route group, with its own minimal shell. */
export default function PartnerLayout({ children }: { children: ReactNode }) {
  return <PartnerShell>{children}</PartnerShell>;
}
