import fs from 'node:fs';
import path from 'node:path';
import { products } from '@/services/data/menuData';

/**
 * The numbers in the handover, against the repository they describe.
 *
 * The handover is what somebody reads on their first morning, before they know
 * enough to doubt it. Earlier in this branch it claimed every pressable cleared
 * the 44pt minimum while ten controls broke it — that one was found by measuring
 * the app. These are the other kind: counts that were true when written and went
 * quietly stale as the app grew. On the same morning they cost the reader their
 * trust in everything else on the page.
 *
 * Only the exactly-countable claims are held here — routes, suites, swept
 * routes, products. A total test count is deliberately *not* one of them: it
 * moves with every `it()` anybody adds, so the docs point at `npm test` for it
 * rather than naming a number that is wrong by the next commit.
 */
const root = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const README = read('README.md');
const HANDOVER = read('HANDOVER.md');

/** Every number written next to `label` in either document, with its source. */
function claimed(pattern: RegExp): { where: string; value: number }[] {
  const found: { where: string; value: number }[] = [];
  for (const [where, text] of [
    ['README.md', README],
    ['HANDOVER.md', HANDOVER],
  ] as const) {
    for (const match of text.matchAll(pattern)) {
      const digits = match[1];
      if (digits) found.push({ where, value: Number(digits) });
    }
  }
  return found;
}

/** Route files, minus the layouts — a `_layout.tsx` is not somewhere you land. */
function appRoutes(): string[] {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && entry.name.endsWith('.tsx') && entry.name !== '_layout.tsx'
        ? [full]
        : [];
    });
  return walk(path.join(root, 'src/app'));
}

const testSuites = () =>
  fs.readdirSync(path.join(root, '__tests__')).filter((file) => /\.test\.tsx?$/.test(file));

/** The route list `audit:screens` actually sweeps, read out of the script. */
function sweptRoutes(): string[] {
  const source = read('scripts/audit-screens.mjs');
  const block = source.match(/const ROUTES\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block?.[1]) throw new Error('could not find ROUTES in scripts/audit-screens.mjs');
  return [...block[1].matchAll(/'([^']+)'/g)].map((match) => match[1] ?? '');
}

describe('the counts in the docs, against the repository', () => {
  /**
   * Guard first. Every assertion below compares a number found by a regex
   * against a number found by a filesystem walk, and both halves can silently
   * return nothing — a heading reworded, a directory moved. A check that
   * stopped reading anything would go on reporting green forever.
   */
  it('read both documents and the repository, rather than nothing', () => {
    expect(README.length).toBeGreaterThan(5_000);
    expect(HANDOVER.length).toBeGreaterThan(5_000);
    expect(appRoutes().length).toBeGreaterThan(20);
    expect(testSuites().length).toBeGreaterThan(20);
    expect(sweptRoutes().length).toBeGreaterThan(20);
    expect(products.length).toBeGreaterThan(5);
  });

  it('counts the routes a customer can land on', () => {
    const claims = claimed(/(\d+) routes covering/g);
    expect(claims.length).toBeGreaterThan(0);

    for (const claim of claims) {
      expect({ ...claim }).toEqual({ where: claim.where, value: appRoutes().length });
    }
  });

  it('counts the suites the gate runs', () => {
    const claims = claimed(/(\d+) suites/g);
    expect(claims.length).toBeGreaterThan(0);

    for (const claim of claims) {
      expect({ ...claim }).toEqual({ where: claim.where, value: testSuites().length });
    }
  });

  /**
   * `audit:screens` is cited in three places as the thing that measures touch
   * targets and accessibility labels — so how much of the app it covers is a
   * claim about how much of that measurement is real. It sat at 26 in one
   * document and 29 in another while the script swept 31.
   */
  it('counts the routes the screen sweep visits', () => {
    const claims = claimed(/(?:all|renders all) (\d+) (?:routes|screens)/g);
    expect(claims.length).toBeGreaterThan(1);

    for (const claim of claims) {
      expect({ ...claim }).toEqual({ where: claim.where, value: sweptRoutes().length });
    }
  });

  it('counts the catalogue products the photography claim covers', () => {
    const claims = claimed(/(\d+)(?: of \d+)? (?:catalogue )?products/g);
    expect(claims.length).toBeGreaterThan(2);

    for (const claim of claims) {
      expect({ ...claim }).toEqual({ where: claim.where, value: products.length });
    }
  });

  /**
   * A total test count is the number most likely to be stale and the least
   * useful to a reader, so neither document may name one: they point at
   * `npm test`, which counts for itself.
   */
  it('does not name a total test count in either document', () => {
    const named = claimed(/(\d+) tests\b/g).filter((claim) => claim.value > 1);
    expect(named).toEqual([]);
  });
});
