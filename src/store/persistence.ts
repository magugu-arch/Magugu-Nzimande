/**
 * What the app does with storage it did not write.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * Four stores persist through `zustand/persist`, and none of them declared a
 * `version` or a `migrate`. Zustand's default rehydration is a shallow merge:
 * whatever is in storage under that key wins over the initial state, field by
 * field, unexamined. That is fine while the only writer is this build of this
 * app — and this build is not the only writer it will ever have.
 *
 * A shipped app updates. `updates.url` is configured, so a customer can be
 * carrying a basket written by last month's binary when this month's code
 * rehydrates it. A field that changed shape between those two versions is not
 * a hypothetical; it is the ordinary consequence of shipping twice.
 *
 * Driven in Chromium against seeded storage, three shapes crashed the app
 * outright:
 *
 *   lines: null                    → priceBasket        → null.map
 *   a line with no selectedOptions → describeOptions    → undefined.map
 *   a store with no openingHours   → closureReason      → undefined.length
 *
 * The `ErrorBoundary` caught all three, which is the good news and also the
 * trap: its screen says "Your cart is saved, so nothing is lost" and offers
 * "Try again", and trying again re-reads the same poisoned value and crashes
 * again. There is no way out of that loop from inside the app. A customer
 * would have to reinstall it.
 *
 * ── What this does ─────────────────────────────────────────────────────────
 * Every persisted slice is checked on the way in, and anything that is not the
 * shape the code expects is dropped in favour of the initial value. Dropped,
 * not repaired: a basket line missing its options cannot be reconstructed, and
 * guessing at one would put food in front of somebody that they did not order.
 *
 * Losing a saved basket is a bad afternoon. An app that cannot be opened is a
 * customer lost, and the second is what this trades away.
 *
 * `PERSIST_VERSION` is bumped whenever a persisted shape changes in a way this
 * file cannot check for. It is deliberately shared across the four stores: the
 * question "is this data from a build that thought differently" has one answer
 * per release, not four.
 */

/** Bump when a persisted shape changes incompatibly. See the note above. */
export const PERSIST_VERSION = 1;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Keep a persisted field only when it satisfies its own shape.
 *
 * The returned object carries only the keys that passed, so zustand's merge
 * leaves the initial value in place for the rest — which is exactly the
 * behaviour wanted, and is why this returns a partial rather than a boolean.
 */
export function keepValid<T extends object>(
  persisted: unknown,
  checks: { [K in keyof T]?: (value: unknown) => boolean },
): Partial<T> {
  if (!isObject(persisted)) return {};

  const kept: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(persisted)) {
    const check = (checks as Record<string, ((value: unknown) => boolean) | undefined>)[key];
    // A key nobody declared a check for is carried through untouched. This is
    // a guard against the shapes that crash, not a schema — treating every
    // unlisted field as suspect would mean every new field needs a line here
    // before it can be saved at all.
    if (check === undefined || check(value)) kept[key] = value;
  }
  return kept as Partial<T>;
}

/** An array whose every member is an object carrying all of `required`. */
export function arrayOfShaped(required: readonly string[]) {
  return (value: unknown): boolean =>
    Array.isArray(value) &&
    value.every((item) => isObject(item) && required.every((key) => key in item));
}

/** One of a fixed set — the check a stored enum member needs and never had. */
export function oneOf(members: readonly string[]) {
  return (value: unknown): boolean => typeof value === 'string' && members.includes(value);
}

/** Null, or an object carrying all of `required`. */
export function nullOrShaped(required: readonly string[]) {
  return (value: unknown): boolean =>
    value === null || (isObject(value) && required.every((key) => key in value));
}

export const isStringArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

export const isString = (value: unknown): boolean => typeof value === 'string';

export const isBoolean = (value: unknown): boolean => typeof value === 'boolean';

/**
 * Everything this app has ever written, for the one case validation cannot
 * reach: a shape that passes every check here and still breaks something
 * downstream.
 *
 * The `ErrorBoundary` offers this as a last resort, because the alternative it
 * offered before was a "Try again" that re-read the same value and crashed
 * again. A customer should never have to delete an app to open it.
 */
export const PERSISTED_KEYS = ['bbq.auth', 'bbq.cart', 'bbq.favourites', 'bbq.fulfilment'] as const;
