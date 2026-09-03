import type { Metadata } from 'next';
import { CheckoutFlow } from '@/components/checkout/CheckoutFlow';
import { isPaymentConfigured } from '@/lib/payments/registry';

export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

/**
 * Rendered per request so the payment panel reflects this deployment.
 *
 * It used to be prerendered with "no payment provider is configured" written
 * into the markup, which meant configuring one changed nothing a customer could
 * see: the page still said there was no gateway, and the order was still placed
 * unpaid. Reading it here means the answer comes from the environment the
 * server is actually running with.
 */
export const dynamic = 'force-dynamic';

export default function CheckoutPage() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <h1 className="display text-[clamp(2.1rem,5vw,3.2rem)]">Checkout</h1>
      <div className="mt-8">
        <CheckoutFlow paymentConfigured={isPaymentConfigured()} />
      </div>
    </div>
  );
}
