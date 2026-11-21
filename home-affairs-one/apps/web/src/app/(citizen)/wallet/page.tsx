import type { Metadata } from 'next';
import { RequireTier } from '@/components/RequireTier';
import { WalletFlagGate } from './WalletFlagGate';
import { WalletScreen } from './WalletScreen';

export const metadata: Metadata = { title: 'Digital wallet (concept)' };

export default function WalletPage() {
  return (
    // The flag is checked first: there is no point signing in to learn it is switched off.
    <WalletFlagGate>
      <RequireTier tier="A2" reason="see the wallet concept">
        <WalletScreen />
      </RequireTier>
    </WalletFlagGate>
  );
}
