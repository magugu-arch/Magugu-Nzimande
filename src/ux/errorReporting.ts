/**
 * Crash and error reporting — brief §13.
 *
 * §13 asks for two things in one sentence: "Log operational errors without
 * leaking sensitive customer information." The first half is a wire; the
 * second half is the work, and it is the half that gets skipped.
 *
 * An error message is the least disciplined string in an application. Nobody
 * writes one expecting it to be stored, so they accumulate whatever was in
 * scope — a request URL with an email in the query, a 401 body quoting the
 * bearer token, a validation message echoing the address somebody typed. Point
 * a crash reporter at that and you have built a second customer database, in a
 * third-party system, that nobody declared and no retention policy covers.
 *
 * So everything here goes through `scrub` on the way out. It is deliberately
 * blunt: it would rather redact a harmless order note than let one email
 * through, because the cost is asymmetric — an over-redacted breadcrumb costs
 * an engineer five minutes, an under-redacted one is a notifiable incident.
 *
 * ── No vendor, same as analytics ───────────────────────────────────────────
 * No SDK is bundled. `setErrorReporter` takes one at startup; until then
 * errors go to the console in development and nowhere in production. Sentry
 * and Crashlytics both ship a device identifier and both want an opinion on
 * data residency, which is bb.q's decision rather than a default worth
 * guessing at.
 */

/** Where an error happened, for grouping. Never free text from a customer. */
export interface ErrorContext {
  /** A stable, hand-written label: 'render', 'checkout.submit', 'push.register'. */
  scope: string;
  /** React's component stack, for a render crash. Scrubbed like everything else. */
  componentStack?: string;
}

export interface ErrorReporter {
  report(error: { name: string; message: string }, context: ErrorContext): void;
}

let reporter: ErrorReporter | null = null;

export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

/**
 * Patterns that must never reach a third party, roughly in order of how often
 * they turn up in a real error string.
 *
 * Order matters: the token rules run before the long-digit rule, so a JWT is
 * redacted as a token rather than half-eaten by the card-number rule.
 */
const REDACTIONS: [RegExp, string][] = [
  /**
   * The query string goes first, and that ordering is load-bearing.
   *
   * It is the single most common carrier — the email, the token and the
   * coordinates all end up in one — so removing it wholesale defuses the rest.
   * It also has to precede the email rule, which would otherwise match across
   * the whole URL (a URL containing `&email=a@b.co` is one long run of
   * non-space characters with an `@` in it) and redact the path too, losing
   * the only part worth keeping for grouping.
   */
  [/(https?:\/\/[^\s?]+)\?\S*/gi, '$1?[redacted]'],

  // Bearer tokens and JWTs, which land in 401 bodies constantly.
  [/\bBearer\s+[\w-]+(?:\.[\w-]+)*/gi, 'Bearer [redacted]'],
  [/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]'],

  /**
   * A credential named in a JSON field or a query pair. The `Bearer`
   * lookahead hands `Authorization: Bearer …` back to the rule above rather
   * than mangling it into `Authorization=[redacted] [redacted]` — the value is
   * redacted either way, but a breadcrumb nobody can read is barely a
   * breadcrumb.
   */
  [
    /\b(token|secret|password|api[_-]?key|authorization)["'\s:=]+(?!Bearer\b)[^\s"',}&]+/gi,
    '$1=[redacted]',
  ],

  // Bounded on both sides of the `@`, so this cannot run away across a URL.
  [/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]'],

  /**
   * South African mobile numbers, in the shapes people type them. `\+27` is
   * matched literally rather than behind a `\b`: there is no word boundary
   * before a `+`, so `\b\+?27` starts at the digits and leaves the plus
   * stranded as `+[phone]`.
   */
  [/(?:\+27|\b0)\s?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g, '[phone]'],

  // 13–19 digits with optional separators: a card number, however it is spaced.
  [/\b(?:\d[ -]?){13,19}\b/g, '[card]'],
  // Coordinates — a customer's home, to five decimal places.
  [/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g, '[coords]'],
];

/** How much of a message is worth keeping. Past this it is a stack, not a message. */
const MAX_LENGTH = 500;

/**
 * Strip anything identifying from a string bound for a crash reporter.
 *
 * Exported because it is the part worth testing directly, and because any
 * other reporting path — a log line, a support payload — should use the same
 * rules rather than inventing its own.
 */
export function scrub(value: string): string {
  let output = value;
  for (const [pattern, replacement] of REDACTIONS) {
    output = output.replace(pattern, replacement);
  }
  return output.length > MAX_LENGTH ? `${output.slice(0, MAX_LENGTH)}…` : output;
}

/**
 * Record an error.
 *
 * Never throws, for the reason `track` never throws: this runs on paths that
 * are already going badly — inside an error boundary, inside a catch — and an
 * error reporter that can itself throw turns a handled failure into a crash.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  const normalised =
    error instanceof Error
      ? { name: error.name, message: scrub(error.message) }
      : { name: 'UnknownError', message: scrub(String(error)) };

  const safeContext: ErrorContext = {
    scope: context.scope,
    ...(context.componentStack ? { componentStack: scrub(context.componentStack) } : {}),
  };

  try {
    reporter?.report(normalised, safeContext);
  } catch {
    // Deliberately swallowed. See above.
  }

  if (__DEV__ && !reporter) {
    // eslint-disable-next-line no-console
    console.error(`[bb.q error: ${safeContext.scope}]`, normalised.name, normalised.message);
  }
}
