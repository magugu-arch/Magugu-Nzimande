import type { Metadata } from 'next';
import { OperationsConsole } from '@/components/admin/OperationsConsole';
import { api } from '@/lib/api';
import { PRODUCTS } from '@bbq/seed';

export const metadata: Metadata = {
  title: 'Operations console',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">Operations</h1>

      <p className="mt-4 max-w-[68ch] rounded-md border border-gold bg-white p-4 text-sm leading-relaxed">
        <span className="font-extrabold">This console has no authentication.</span> It shares the
        storefront&rsquo;s deployment and its own auth boundary has not been built, so it must not
        reach an environment serving real customers in this state.
      </p>

      <div className="mt-8">
        <OperationsConsole
          // The console needs the hidden products too, so it is handed the full
          // catalogue rather than the customer-facing one.
          initialProducts={PRODUCTS}
          initialStores={api.getStores()}
          promotions={api.getPromotions()}
        />
      </div>
    </div>
  );
}
