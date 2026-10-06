import 'server-only';
import { PayFast } from './payfast';
import { PeachPayments } from './peach';
import { SandboxPayments } from './sandbox';
import { PaymentsNotConfigured, type PaymentProvider } from './types';

export * from './types';

/**
 * PAYMENTS_PROVIDER selects the gateway: `payfast`, `peach` or `sandbox`.
 * Development defaults to the sandbox; production has no default and fails
 * until a real provider is configured.
 */
export function getPaymentProvider(): PaymentProvider {
  const production = process.env.NODE_ENV === 'production';
  const choice = process.env.PAYMENTS_PROVIDER ?? (production ? '' : 'sandbox');
  switch (choice) {
    case 'payfast': {
      const { PAYFAST_MERCHANT_ID: id, PAYFAST_MERCHANT_KEY: key, PAYFAST_PASSPHRASE: passphrase } = process.env;
      if (!id || !key) throw new PaymentsNotConfigured('PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY are required');
      return new PayFast({ merchantId: id, merchantKey: key, passphrase: passphrase || undefined, sandbox: process.env.PAYFAST_SANDBOX === 'true' });
    }
    case 'peach':
      return new PeachPayments();
    case 'sandbox':
      if (production && process.env.ALLOW_SANDBOX_PAYMENTS !== 'true') {
        throw new PaymentsNotConfigured('the sandbox provider is disabled in production');
      }
      return new SandboxPayments();
    default:
      throw new PaymentsNotConfigured('set PAYMENTS_PROVIDER to payfast or peach');
  }
}
