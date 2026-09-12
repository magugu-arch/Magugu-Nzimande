import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The version the app's stores persist with, read from the app.
 *
 * A sweep that seeds a customer or a basket into `localStorage` has to stamp
 * the envelope with a version Zustand will accept, because state stamped with
 * anything else is dropped on load and the sweep silently drives a signed-out,
 * empty-basket app instead.
 *
 * That is not hypothetical. `audit:offline` wrote `version: 0`, and had done
 * since before `PERSIST_VERSION` existed. When versioned persistence arrived,
 * every signed-in route in that sweep began rendering "Sign in to see your
 * orders" — and the sweep kept reporting, six routes at a time, that they
 * "said nothing about the server at all". True, and about itself.
 *
 * The other two sweeps that seed state wrote `version: 1`, which is correct
 * today and is the same latent failure: the next bump breaks them in exactly
 * the same silent way. So all three read it from here instead, and this throws
 * rather than guessing if the constant is ever renamed or moved.
 */
export const PERSIST_VERSION = (() => {
  const source = readFileSync(path.join(root, 'src/store/persistence.ts'), 'utf8');
  const found = /export const PERSIST_VERSION = (\d+);/.exec(source);
  if (!found) throw new Error('PERSIST_VERSION not found in src/store/persistence.ts');
  return Number(found[1]);
})();
