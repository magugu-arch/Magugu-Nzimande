/**
 * Facts the app is allowed to state, and facts it is still waiting for.
 *
 * The brief is emphatic and repeats itself, which is usually a sign that
 * somebody has been burned before:
 *
 *   §1  "Use real Pappas content and menu information. Never invent prices,
 *        dishes, events or promotions."
 *   §15 "Do not invent menu prices, events, opening hours, loyalty rules or
 *        customer promises."
 *   §17.15 "When source data is missing, use a clearly marked business-input
 *        placeholder instead of inventing content."
 *
 * The temptation in a build like this is to put a plausible number in — R185
 * for a souvlaki reads fine, nobody notices, and the screenshots look
 * finished. That is exactly the failure the brief is guarding against: an
 * invented price is indistinguishable from a real one until a customer is
 * charged it, and a demo that looks complete never gets the real data
 * collected.
 *
 * So this module makes "we do not know this yet" a value the type system
 * carries. A `Fact<T>` is either verified, with a note saying where it came
 * from, or it is awaiting business input, with a note saying who has to
 * supply it. There is no third state and no default. A screen rendering a
 * `Fact` must handle both branches, which means an unsupplied price cannot
 * quietly render as `R0.00` or as an empty string.
 *
 * ── Why this build needs it so much ──────────────────────────────────────
 *
 * The Pappas website is the brief's own primary source (§2), and it is not
 * reachable from this build environment — the network egress policy blocks
 * it. So a substantial amount of what would normally be looked up has to be
 * requested instead. Rather than let that quietly become guesswork, every
 * such gap is a marked placeholder that shows up in the UI as an honest
 * state, and `npm run audit:placeholders` lists every one of them for the
 * Pappas team to fill in.
 *
 * What *is* verified comes from the sixteen supplied assets, which are
 * Pappas' own artwork and therefore Pappas' own content: the brand lockup
 * and its lines, the dish names legible in the photography, the cocktail
 * list with ingredients printed under each glass, the fish-market chalkboard,
 * and the Nelson Mandela Square setting. Each verified fact records which
 * asset it was read off, so a reviewer can check it.
 */

/** Where a verified fact came from. Always specific enough to check. */
export type FactSource =
  /** Read off one of the sixteen supplied Pappas assets. */
  | { kind: 'supplied-asset'; asset: string; detail?: string }
  /** Stated in the build brief itself. */
  | { kind: 'brief'; section: string }
  /** Confirmed by the Pappas team. */
  | { kind: 'pappas'; confirmedOn: string };

export interface VerifiedFact<T> {
  status: 'verified';
  value: T;
  source: FactSource;
}

export interface AwaitingBusinessInput {
  status: 'awaiting-business-input';
  /** What is missing, in the words the Pappas team would use. */
  needs: string;
  /**
   * What the app shows in the meantime.
   *
   * Never a plausible-looking substitute. "Price on request" is a true
   * statement; "R185" is a lie with a decimal point.
   */
  placeholder: string;
}

export type Fact<T> = VerifiedFact<T> | AwaitingBusinessInput;

/** Record a fact read off a supplied Pappas asset. */
export function fromAsset<T>(value: T, asset: string, detail?: string): VerifiedFact<T> {
  return { status: 'verified', value, source: { kind: 'supplied-asset', asset, detail } };
}

/** Record a fact the brief itself states. */
export function fromBrief<T>(value: T, section: string): VerifiedFact<T> {
  return { status: 'verified', value, source: { kind: 'brief', section } };
}

/** Record a fact the Pappas team has confirmed. */
export function fromPappas<T>(value: T, confirmedOn: string): VerifiedFact<T> {
  return { status: 'verified', value, source: { kind: 'pappas', confirmedOn } };
}

/** Mark something nobody has supplied yet. */
export function awaiting(needs: string, placeholder: string): AwaitingBusinessInput {
  return { status: 'awaiting-business-input', needs, placeholder };
}

export function isVerified<T>(fact: Fact<T>): fact is VerifiedFact<T> {
  return fact.status === 'verified';
}

/**
 * The value, or undefined if nobody has supplied it.
 *
 * Deliberately not `valueOr(fallback)`. A fallback parameter is how an
 * invented default gets in: somebody passes `0`, and a price of R0.00 renders
 * without anything in the type system objecting. Callers must branch.
 */
export function factValue<T>(fact: Fact<T>): T | undefined {
  return isVerified(fact) ? fact.value : undefined;
}

/** What to show on screen: the formatted value, or the honest placeholder. */
export function factText<T>(fact: Fact<T>, format: (value: T) => string): string {
  return isVerified(fact) ? format(fact.value) : fact.placeholder;
}

/** One outstanding gap, for the audit report. */
export interface OutstandingInput {
  path: string;
  needs: string;
  placeholder: string;
}

/**
 * Walk an object tree and collect every fact still awaiting input.
 *
 * Used by `npm run audit:placeholders` to produce the list Pappas has to
 * fill in, and by a test that asserts the list is *published* rather than
 * hidden — the failure mode this whole module exists to prevent is a
 * placeholder nobody remembers is there.
 */
export function collectOutstanding(root: unknown, prefix = ''): OutstandingInput[] {
  const found: OutstandingInput[] = [];

  const walk = (node: unknown, path: string): void => {
    if (node === null || typeof node !== 'object') return;

    if (Array.isArray(node)) {
      node.forEach((child, i) => walk(child, `${path}[${i}]`));
      return;
    }

    const record = node as Record<string, unknown>;
    if (record.status === 'awaiting-business-input') {
      found.push({
        path: path || '(root)',
        needs: String(record.needs),
        placeholder: String(record.placeholder),
      });
      return;
    }
    // A verified fact's `value` may itself hold facts, so it is not a leaf.
    for (const [key, child] of Object.entries(record)) {
      walk(child, path ? `${path}.${key}` : key);
    }
  };

  walk(root, prefix);
  return found;
}
