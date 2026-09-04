import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { menuSnapshot } from '@/services/data/menuData';

/**
 * The one field on this menu that can hurt somebody.
 *
 * The product screen drew its allergen line behind `allergens.length > 0`, so
 * a product with an empty list showed nothing — no "contains", and no
 * "prepared in a kitchen that handles other allergens" either. The second half
 * is not a consequence of the first: it is true of every item in the building,
 * and it is the sentence that tells an allergic customer to ask.
 *
 * The catalogue has exactly one such product, and it is the worst possible
 * one. Sweet Potato Fries declares nothing. French Fries — a plain potato —
 * declares Gluten, which it can only have picked up from the fryer they share.
 * So the two disagree about the same equipment, and the one that says nothing
 * is the one that also went silent about the kitchen.
 *
 * The fix is not to type an allergen into the seed. What Sweet Potato Fries
 * contains is a fact about a franchise kitchen and nobody here knows it —
 * inventing it is exactly the failure the brief warns about, and on the one
 * field where being wrong is dangerous. So: `audit:launch` carries the gap as
 * a blocker, and the screen stops reading as though an empty list were an
 * all-clear.
 */
const source = readFileSync(path.join(__dirname, '..', 'src/app/product/[id].tsx'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

describe('what the product screen says about allergens', () => {
  it('does not put the whole block behind a non-empty list', () => {
    // The shape of the defect: a conditional wrapping the notice itself.
    expect(source).not.toMatch(/allergens\.length > 0 \? \(\s*<View/);
  });

  it('still names what an item contains when the list has something in it', () => {
    expect(source).toMatch(/Contains \$\{item\.allergens\.join/);
  });

  it('says the shared kitchen either way', () => {
    const notices = [...source.matchAll(/kitchen that handles other allergens/g)];

    // Once in each arm of the ternary — the "contains" copy and the "not
    // confirmed" copy. One occurrence would mean a branch lost it again.
    expect(notices.length).toBe(2);
  });

  it('never presents an empty list as an all-clear', () => {
    // "No allergens", "allergen free" and friends are claims nobody here can
    // make. What the screen is entitled to say is that it does not know.
    expect(source).not.toMatch(/no allergens|allergen[- ]free|free from/i);
    expect(source).toMatch(/not confirmed/);
  });
});

describe('the catalogue behind it', () => {
  it('has a product with no declared allergens, or none of the above is reachable', () => {
    const undeclared = menuSnapshot.products.filter((p) => p.allergens.length === 0);

    expect(undeclared.length).toBeGreaterThan(0);
    expect(undeclared.map((p) => p.name)).toContain('Sweet Potato Fries');
  });

  /**
   * The disagreement itself, stated so it cannot be quietly resolved the wrong
   * way. If somebody ever types allergens into Sweet Potato Fries, this stops
   * mattering and the assertion below stops applying — which is the point:
   * it is here to describe today's data, not to freeze it.
   */
  it('has two fries products that do not agree about the same fryer', () => {
    const byId = (id: string) => menuSnapshot.products.find((p) => p.id === id);
    const plain = byId('french-fries');
    const sweet = byId('sweet-potato-fries');

    expect(plain?.allergens).toContain('Gluten');
    if (sweet && sweet.allergens.length === 0) {
      // Still unresolved. `audit:launch` is carrying it — asserted below.
      expect(sweet.allergens).toEqual([]);
    }
  });
});

/**
 * And the gap is actually reported, rather than only commented about.
 *
 * Run for real rather than grepped: an audit that has stopped noticing reads
 * exactly like one with nothing to report, which is the failure the geocoding
 * blocker in that same script was written up for.
 */
describe('the launch audit', () => {
  it('names the product whose allergens are missing', () => {
    const output = execFileSync('node', ['scripts/audit-launch-readiness.mjs'], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });

    expect(output).toMatch(/Allergen data/);
    expect(output).toMatch(/Sweet Potato Fries/);
    // Not an option name, which is what the first version of the check found.
    expect(output).not.toMatch(/Allergen data[\s\S]{0,400}Sharing bucket/);
  });
});
