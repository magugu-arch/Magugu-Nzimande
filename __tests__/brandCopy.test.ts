import fs from 'node:fs';
import path from 'node:path';

/**
 * No other restaurant's words, anywhere a customer can read them.
 *
 * This app was built from one for a Korean fried chicken chain, and the
 * rebrand missed the copy that was not in the obvious places. What shipped,
 * on a Greek and Mediterranean menu on Nelson Mandela Square:
 *
 *   the entry screen       "Korean fried chicken, done properly"
 *   order tracking         "Your chicken is being battered and dropped
 *                           into the fryer"
 *   the empty cart         "…what is coming out of the fryer"
 *   the menu search field  "Search chicken, sides, meals…"
 *   the search chips       Honey Garlic · Wings · Boneless · Cheesling Fries
 *   the customisation box  "e.g. extra crispy, no spring onion…"
 *   the cart total         "You'll earn 240 bb.q points on this order"
 *   the rating chips       "Crispy as always"
 *   the store map          "Map of nearby bb.q stores"
 *
 * Nine separate surfaces. Each one was individually plausible to skim past,
 * and none of them belongs to a restaurant that grills whole fish and lamb
 * over flame. A customer meets the first before the app has finished loading.
 *
 * Scanned as source text rather than asserted screen by screen, because the
 * defect is not in any one screen — it is that nothing was looking at the
 * whole app at once. Comments are stripped first: the history of why a thing
 * changed is worth keeping, and those notes name the old brand constantly.
 */

const ROOT = path.join(__dirname, '..', 'src');

/** Words that belong to the chicken chain, not to Pappas. */
const FOREIGN = [
  /\bbb\.?q\b(?!\.)/i,
  /korean/i,
  /fryer/i,
  /battered/i,
  /\bcrispy\b/i,
  /honey garlic/i,
  /\bboneless\b/i,
  /cheesling/i,
  /\bnuggets?\b/i,
];

/**
 * Strings and JSX text, with comments removed.
 *
 * Crude on purpose: over-collecting costs a false positive that is trivial to
 * read, and under-collecting is how all nine of these survived in the first
 * place.
 */
function readableText(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ');
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('nothing on screen belongs to another restaurant', () => {
  const files = walk(ROOT);

  it('finds source to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((f) => [path.relative(ROOT, f), f]))('%s', (_label, file) => {
    const text = readableText(fs.readFileSync(file, 'utf8'));
    const hits = FOREIGN.flatMap((pattern) => {
      const match = pattern.exec(text);
      return match ? [match[0]] : [];
    });
    expect({ file: path.relative(ROOT, file), hits }).toEqual({
      file: path.relative(ROOT, file),
      hits: [],
    });
  });
});
