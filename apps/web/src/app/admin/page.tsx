import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { OperationsConsole } from '@/components/admin/OperationsConsole';
import { SignOut } from '@/components/admin/SignOut';
import { SESSION_COOKIE, isValidToken } from '@/lib/admin-auth';
import { api } from '@/lib/api';
import { hiddenSlugs, readAudit } from '@/lib/catalogue-state';
import { labelFor, listOrders } from '@/lib/order-store';
import { PRODUCTS } from '@bbq/seed';

// The queue lives in the server process, so this page must be rendered per
// request rather than prerendered at build time with an empty rail.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Operations console',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  /**
   * The page is rendered on the server, so this runs before any of the queue
   * reaches the browser. The API routes carry the same guard rather than
   * trusting that a caller came through here.
   */
  if (!isValidToken((await cookies()).get(SESSION_COOKIE)?.value ?? null)) {
    redirect('/admin/login');
  }

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">Operations</h1>
        <SignOut />
      </div>

      <p className="mt-4 max-w-[68ch] rounded-md border border-gold bg-white p-4 text-sm leading-relaxed">
        <span className="font-extrabold">One shared passphrase, not staff accounts.</span> The
        audit log can say an operator made a change, but not which one. Per-person sign-in needs a
        user store this deployment does not have.
      </p>

      <div className="mt-8">
        <OperationsConsole
          // The console needs the hidden products too, so it is handed the full
          // catalogue rather than the customer-facing one.
          initialProducts={PRODUCTS}
          initialStores={api.getStores()}
          initialOrders={listOrders().map((order) => ({
            ...order,
            statusLabel: labelFor(order),
          }))}
          initialAudit={readAudit()}
          initialHidden={hiddenSlugs()}
          promotions={api.getPromotions()}
        />
      </div>
    </div>
  );
}
