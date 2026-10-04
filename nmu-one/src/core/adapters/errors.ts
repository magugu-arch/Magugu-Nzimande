import type { AdapterDomain } from '../config';

/**
 * Every adapter fails with one of these kinds, and only these (brief §22
 * "predictable error states"). Screens map a kind to a state — offline,
 * permission denied, unavailable — instead of parsing messages.
 */
export type AdapterErrorKind =
  | 'offline'
  | 'unauthorised'
  | 'forbidden'
  | 'not-found'
  | 'unavailable'
  | 'not-configured'
  | 'invalid'
  | 'conflict';

export class AdapterError extends Error {
  readonly kind: AdapterErrorKind;
  readonly domain: AdapterDomain;

  constructor(kind: AdapterErrorKind, domain: AdapterDomain, message?: string) {
    super(message ?? `${domain}: ${kind}`);
    this.name = 'AdapterError';
    this.kind = kind;
    this.domain = domain;
  }

  /** Whether trying again, unchanged, might work. */
  get retryable(): boolean {
    return this.kind === 'offline' || this.kind === 'unavailable';
  }
}

export function isAdapterError(e: unknown): e is AdapterError {
  return e instanceof AdapterError;
}

/** Normalises anything thrown into an AdapterError for a domain. */
export function toAdapterError(e: unknown, domain: AdapterDomain): AdapterError {
  if (isAdapterError(e)) return e;
  return new AdapterError('unavailable', domain, e instanceof Error ? e.message : String(e));
}
