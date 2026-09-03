import { payfastProvider } from './payfast/provider';
import type { PaymentProvider } from './provider';
import { sandboxProvider } from './sandbox-provider';

/**
 * Which gateway this deployment is talking to, if any.
 *
 * Returns null unless one is configured, and every caller is expected to answer
 * 501 on null rather than fall back to something. That is the whole point: a
 * build with no merchant account must refuse payment visibly, not accept it
 * plausibly. An integration that silently works in an environment where no
 * money can move is how a store discovers on its first Saturday that nothing
 * was ever charged.
 *
 * Selected by name and secret, both from the environment, so no credential is
 * ever written down here — brief §7.
 */

export type ProviderConfig = { name: string; secret: string };

/**
 * The two variables this module reads, and nothing else.
 *
 * Narrower than `NodeJS.ProcessEnv` on purpose: it says at the type level which
 * environment this decision depends on, and it means a caller — a test, or a
 * future configuration loader — can hand over two fields instead of forging a
 * whole process environment to ask one question.
 */
export type PaymentEnv = {
  BBQ_PAYMENT_PROVIDER?: string | undefined;
  /** The shared secret: PayFast's passphrase, or the sandbox signing key. */
  BBQ_PAYMENT_SECRET?: string | undefined;
  BBQ_PAYFAST_MERCHANT_ID?: string | undefined;
  BBQ_PAYFAST_MERCHANT_KEY?: string | undefined;
  /** Anything other than "false" keeps the sandbox. See below. */
  BBQ_PAYFAST_SANDBOX?: string | undefined;
  BBQ_PUBLIC_URL?: string | undefined;
  // An environment carries more than these two. Named so the index signature
  // reads as deliberate: without it every property here is optional, which
  // makes this a weak type, and TypeScript then refuses `process.env` for
  // having nothing provably in common with it.
  readonly [other: string]: string | undefined;
};

export function configuredProvider(env: PaymentEnv = process.env): ProviderConfig | null {
  const name = env.BBQ_PAYMENT_PROVIDER;
  const secret = env.BBQ_PAYMENT_SECRET;

  // Both or neither. A named provider with no secret cannot verify a callback,
  // which would leave the webhook open — worse than being switched off.
  if (!name || !secret) return null;
  return { name, secret };
}

export function activeProvider(env: PaymentEnv = process.env): PaymentProvider | null {
  const config = configuredProvider(env);
  if (!config) return null;

  switch (config.name) {
    case 'sandbox':
      return sandboxProvider(config.secret);

    case 'payfast': {
      const merchantId = env.BBQ_PAYFAST_MERCHANT_ID;
      const merchantKey = env.BBQ_PAYFAST_MERCHANT_KEY;
      const publicUrl = env.BBQ_PUBLIC_URL;

      // All four or nothing. A PayFast adapter missing its merchant id builds
      // a redirect PayFast rejects, and one missing its public URL sends the
      // notification to a URL that does not exist — the payment then succeeds
      // and the order never hears about it, which is the worst of the failures
      // available here.
      if (!merchantId || !merchantKey || !publicUrl) return null;

      /**
       * Live only when the variable says exactly "false", so every other value
       * — unset, empty, "0", a typo — keeps the sandbox. Getting this backwards
       * would take real money on a deployment somebody believed was a test,
       * and there is no version of that mistake worth making cheap.
       */
      const sandbox = env.BBQ_PAYFAST_SANDBOX !== 'false';
      const base = publicBaseUrl(env) ?? publicUrl;

      return payfastProvider({
        merchantId,
        merchantKey,
        passphrase: config.secret,
        sandbox,
        returnUrl: `${base}/journey?payment=done`,
        cancelUrl: `${base}/checkout?payment=cancelled`,
        notifyUrl: `${base}/api/payments/webhook`,
      });
    }

    default:
      // A name nobody has written an adapter for. Refused rather than guessed:
      // a typo in a deployment variable should stop payments, not pick one.
      return null;
  }
}

/** Whether this deployment can take a payment at all. */
export function isPaymentConfigured(env: PaymentEnv = process.env): boolean {
  return activeProvider(env) !== null;
}

/**
 * This deployment's own address, without its trailing slash, or null.
 *
 * Exported so the route that opens an intent can build a return URL naming the
 * order being paid for. It is the same value the adapter's fallback URLs are
 * built from, read in one place rather than two: a base URL assembled twice is
 * a base URL that disagrees with itself once somebody adds a path prefix.
 */
export function publicBaseUrl(env: PaymentEnv = process.env): string | null {
  const url = env.BBQ_PUBLIC_URL;
  return url ? url.replace(/\/+$/, '') : null;
}
