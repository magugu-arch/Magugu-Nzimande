import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AccountPanel } from '@/components/account/AccountPanel';
import { CustomerAccount } from '@/components/account/CustomerAccount';
import { currentAccountFromCookies } from '@/lib/accounts/session';
import { addressesFor } from '@/lib/accounts/store';
import { ordersForAccount } from '@/lib/order-store';

// The account and its orders live in the server process, so this renders per
// request rather than being prerendered signed out for everybody.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  /**
   * The token from a reset email, if they arrived by the link.
   *
   * Read here and handed to the component rather than pulled out of the URL in
   * the browser, so the reset form is what renders — a customer who followed a
   * link from their inbox should not watch a sign-in form appear first and then
   * be replaced.
   */
  const reset = (await searchParams).reset;
  const resetToken = typeof reset === 'string' && reset.length > 0 ? reset : null;
  /**
   * Resolved here rather than by an effect in the browser.
   *
   * A client-side "who am I" shows a loading state to everybody, including the
   * people who are not signed in and have nothing to wait for, and it means the
   * server renders a page it already knows is wrong.
   */
  const account = await currentAccountFromCookies(cookies);
  const orders = account ? ordersForAccount(account.id) : [];
  const addresses = account ? addressesFor(account.id) : [];

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">Your account</h1>
      {/*
        Two panels, and the split is honest rather than tidy.

        CustomerAccount is the signed-in account: order history that follows
        the person, a real address book, and the two POPIA requests. AccountPanel
        below is what this browser remembers — a guest's orders live in this
        device's storage and belong to nobody. Merging them into one list would
        tell a customer their history had vanished the first time they opened
        the site on a different phone.
      */}
      <div className="mt-8">
        <CustomerAccount
          initialAccount={account}
          initialOrders={orders}
          initialAddresses={addresses}
          resetToken={resetToken}
        />
      </div>

      <div className="mt-12 border-t border-line pt-8">
        <h2 className="display text-2xl">On this device</h2>
        <p className="mt-1 max-w-[60ch] text-sm text-muted">
          Orders placed in this browser without signing in. They stay here and are not
          attached to an account.
        </p>
        <div className="mt-6">
          <AccountPanel />
        </div>
      </div>
    </div>
  );
}
