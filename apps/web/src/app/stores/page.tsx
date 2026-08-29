import type { Metadata } from 'next';
import { StoreList } from '@/components/stores/StoreList';
import { DemoNotice } from '@/components/ui/DemoValue';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Find a store',
  description:
    'bb.q Chicken at Cresta Crossing in Randburg and Waterfall Ridge in Midrand. Delivery, collection and dine-in.',
};

export default function StoresPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
        <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
        Two stores, open now
      </p>
      <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">Find a store</h1>

      <StoreList stores={api.getStores()} />

      <div className="mt-10 rounded-md border border-line bg-white p-5">
        <DemoNotice className="max-w-3xl" />
        <p className="mt-3 text-xs text-muted">
          Telephone numbers, trading hours, delivery suburbs and halaal certification status are
          sample values pending confirmation per store.
        </p>
      </div>
    </div>
  );
}
