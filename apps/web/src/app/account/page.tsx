import type { Metadata } from 'next';
import { AccountPanel } from '@/components/account/AccountPanel';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">Your account</h1>
      <div className="mt-8">
        <AccountPanel />
      </div>
    </div>
  );
}
