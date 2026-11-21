'use client';

import { Container, LinkButton, UnavailableState } from '@hao/design-system';
import type { ReactNode } from 'react';
import { useFlags } from '@/lib/prefs';

/** Shows the wallet concept only while its feature flag is on; otherwise explains the gate. */
export function WalletFlagGate({ children }: { children: ReactNode }) {
  const { flags } = useFlags();
  if (flags.wallet) return <>{children}</>;

  return (
    <Container width="narrow" style={{ paddingBlock: 'var(--space-7)' }}>
      <h1 className="visually-hidden">Digital wallet</h1>
      <UnavailableState
        title="The wallet is switched off"
        reason="A digital wallet is a future capability. It is subject to legal, security and operational approval, so it is not shown in this version."
        whatNext="Nothing changes for you. Your physical documents remain valid, and every service here works without a wallet."
        alternatives={[
          'Apply for, track and collect documents through Services and My applications.',
          'Reviewers can switch the wallet concept on in Prototype controls.',
        ]}
        actions={
          <>
            <LinkButton href="/services/">Browse services</LinkButton>
            <LinkButton href="/profile/prototype/" variant="secondary">
              Prototype controls
            </LinkButton>
          </>
        }
      />
    </Container>
  );
}
