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
  BBQ_PAYMENT_SECRET?: string | undefined;
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
