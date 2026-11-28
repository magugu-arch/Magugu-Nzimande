import 'server-only';
import { absoluteUrl } from '@/content/site';
import { payfastCheckout, payfastConfigured } from './payfast';

export type PaymentInit = { kind: 'redirect'; url: string } | { kind: 'form'; action: string; fields: Record<string, string> };

export type PayableBooking = {
  id: string;
  ref: string;
  amount: number;
  itemName: string;
  name: string;
  email: string;
  phone: string;
};

export type ProviderId = 'payfast' | 'demo';

/** PayFast when its merchant keys are set; otherwise a clearly labelled simulated checkout. */
export function activeProvider(): ProviderId {
  return payfastConfigured() ? 'payfast' : 'demo';
}

export function startPayment(b: PayableBooking): { provider: ProviderId; init: PaymentInit } {
  if (activeProvider() === 'payfast') {
    return { provider: 'payfast', init: payfastCheckout(b) };
  }
  return { provider: 'demo', init: { kind: 'redirect', url: absoluteUrl(`/checkout/demo/${b.id}`) } };
}
