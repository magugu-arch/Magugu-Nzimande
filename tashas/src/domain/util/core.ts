/**
 * Small primitives every module shares: clocks, ids, money, validation and
 * masking. Kept framework-free so a Node API, the web app and a future Expo
 * build all import the same code.
 */

// ---------------------------------------------------------------- clocks

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** Tests drive time by hand. */
export class ManualClock implements Clock {
  current: number;
  constructor(start: number) {
    this.current = start;
  }
  now(): number {
    return this.current;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

/** The sandbox can move time forward to fire reminders and expiries. */
export class OffsetClock implements Clock {
  offsetMs = 0;
  base: Clock;
  constructor(base: Clock = systemClock, offsetMs = 0) {
    this.base = base;
    this.offsetMs = offsetMs;
  }
  now(): number {
    return this.base.now() + this.offsetMs;
  }
}

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

// ------------------------------------------------------------------- ids

export interface IdSource {
  id(prefix: string): string;
  /** Human-readable booking or voucher reference, no ambiguous characters. */
  reference(prefix: string): string;
}

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Seedable so tests and the demo population are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createIdSource(random: () => number = defaultRandom): IdSource {
  const pick = (n: number) => {
    let out = '';
    for (let i = 0; i < n; i++) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
    return out;
  };
  return {
    id: (prefix) => `${prefix}_${pick(12).toLowerCase()}`,
    reference: (prefix) => `${prefix}-${pick(6)}`,
  };
}

function defaultRandom(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0]! / 4294967296;
  }
  return Math.random();
}

/** Stable string hash for seeding per-slot demo load; not for security. */
export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ----------------------------------------------------------------- money

/** ZAR cents. Integer minor units only; floats never touch an amount. */
export type Minor = number;

export function assertMinor(amount: number, label = 'amount'): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new DomainError('invalid_amount', `${label} must be a non-negative integer in minor units`);
  }
}

export function formatZar(minor: Minor, opts: { cents?: boolean } = {}): string {
  const rands = minor / 100;
  const showCents = opts.cents ?? minor % 100 !== 0;
  const formatted = rands.toLocaleString('en-ZA', {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
  // en-ZA uses a non-breaking space as the thousands separator and a comma for
  // decimals; keep that, it is how South African menus print prices.
  return `R${formatted}`;
}

// ---------------------------------------------------------------- errors

export class DomainError extends Error {
  code: string;
  details: Record<string, unknown> | undefined;
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function isDomainError(err: unknown, code?: string): err is DomainError {
  return err instanceof DomainError && (code === undefined || err.code === code);
}

// ------------------------------------------------------------ validation

export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.trim());
}

/**
 * South African mobiles in local (0XX XXX XXXX) or international form, and
 * other E.164 numbers for visitors. Returns E.164 or null.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, '');
  if (/^0[6-8]\d{8}$/.test(digits)) return `+27${digits.slice(1)}`;
  if (/^\+27[6-8]\d{8}$/.test(digits)) return digits;
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  return null;
}

export function isValidName(input: string): boolean {
  const t = input.trim();
  return t.length >= 2 && t.length <= 80;
}

// --------------------------------------------------------------- masking

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return '***';
  return `${user[0]}${'•'.repeat(Math.max(2, Math.min(5, user.length - 1)))}@${domain}`;
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return '•••';
  return `${phone.slice(0, 3)} ••• ••${phone.slice(-2)}`;
}

export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.map((p, i) => (i === 0 ? p : `${p[0]}.`)).join(' ');
}
