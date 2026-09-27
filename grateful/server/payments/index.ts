import { config } from '../config';
import { createMockProvider } from './mock';
import { createPayfastProvider } from './payfast';
import type { PaymentProvider } from './types';

let override: PaymentProvider | null = null;

/** The configured gateway. Add a provider by implementing PaymentProvider and a case here. */
export function paymentProvider(): PaymentProvider {
  if (override) return override;
  const c = config();
  switch (c.paymentProvider) {
    case 'payfast': {
      const { merchantId, merchantKey } = c.payfast;
      if (!merchantId || !merchantKey) throw new Error('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY must be set.');
      return createPayfastProvider({ ...c.payfast, merchantId, merchantKey });
    }
    case 'mock':
      if (c.isProduction && !c.allowMockPayments) throw new Error('The mock payment provider is disabled in production.');
      return createMockProvider();
    default:
      throw new Error(`Unknown PAYMENT_PROVIDER: ${String(c.paymentProvider)}`);
  }
}

/** Tests only. */
export function setPaymentProvider(p: PaymentProvider | null) {
  override = p;
}
