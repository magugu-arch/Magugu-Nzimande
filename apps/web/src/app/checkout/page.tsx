import type { Metadata } from 'next';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">Checkout</h1>
      <div className="mt-8">
        <CheckoutFlow />
      </div>
    </div>
  );
}
