import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'src', 'app');

function walk(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, match));
    else if (match.test(entry.name)) out.push(full);
  }
  return out;
}

/** Expo Router groups are organisational only — they never appear in a URL. */
const stripGroups = (route: string) => route.replace(/\((?:tabs|auth|onboarding)\)\//g, '');

/** `[id]` and `${x}` both stand for "some value here". */
const normalise = (route: string) =>
  route
    .replace(/\[[^\]]+\]/g, ':param')
    .replace(/\$\{[^}]*\}/g, ':param')
    .split('?')[0]!
    .replace(/\/+$/, '');

function definedRoutes(): string[] {
  return walk(appDir, /\.tsx$/)
    .filter((file) => !path.basename(file).startsWith('_layout'))
    .map((file) => {
      const rel = path.relative(appDir, file).replace(/\.tsx$/, '');
      return '/' + stripGroups(rel).replace(/\/?index$/, '');
    })
    .map((route) => (route === '/' ? '/index' : route));
}

/**
 * Everywhere the app can send someone.
 *
 * Rather than enumerate the syntaxes — a string push, an object with a
 * `pathname`, a ternary inside a `<Redirect href>`, a literal returned from a
 * helper, a `<Tabs.Screen name>` reached only by tapping — this takes any
 * route-shaped string literal in the source. Chasing the spellings produced
 * phantom orphans twice: the check is meant to find a screen with no way in,
 * and a path that appears nowhere at all is the honest signal for that.
 */
function navigationTargets(): Set<string> {
  const targets = new Set<string>();

  for (const file of walk(path.join(root, 'src'), /\.tsx?$/)) {
    const source = fs.readFileSync(file, 'utf8');

    // `{}` is allowed through so a template literal like `/product/${id}`
    // matches; `normalise` turns the placeholder into :param afterwards.
    for (const m of source.matchAll(/['"`](\/[A-Za-z0-9()[\]{}/_.$:-]*)['"`]/g)) {
      targets.add(m[1]!);
    }
    // Tabs are registered by name, not by path, and reached by tapping.
    for (const m of source.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)) {
      targets.add('/' + m[1]!);
    }
  }

  return new Set([...targets].map((t) => normalise(stripGroups(t))));
}

describe('every screen can be reached', () => {
  // Entry points nothing navigates *to*: the router resolves them itself.
  const ENTRY_POINTS = new Set(['/index', '/+not-found']);

  it('has no orphaned route', () => {
    const reachable = navigationTargets();
    const orphans = definedRoutes()
      .filter((route) => !ENTRY_POINTS.has(route))
      .filter((route) => !reachable.has(normalise(route)));

    // A screen nobody can open is dead weight that still costs bundle size and
    // still has to be maintained. Easy to create by deleting the one link.
    expect(orphans).toEqual([]);
  });

  it('found the routes and the links, rather than passing on empty sets', () => {
    expect(definedRoutes().length).toBeGreaterThan(25);
    expect(navigationTargets().size).toBeGreaterThan(20);
  });
});

/**
 * Every escape from Expo Router's typed routes has to go through the guard.
 *
 * `router.push(x as Href)` is the app telling the compiler to stop asking, and
 * the three places that do it all push a string that came off the wire — a
 * notification's `href`, a promotion's `ctaHref`, an in-app notification's
 * `href`. Two of them had guards, in two different states of wrongness, and
 * the third had none.
 *
 * I found the third by grepping for the sink rather than the field names,
 * having already announced the sweep complete on the strength of the field
 * names. This is that grep, kept, so the fourth one cannot arrive quietly.
 */
describe('routes pushed past the type system', () => {
  const sourceFiles = () => {
    const roots = ['src/app', 'src/features', 'src/components'].map((d) => path.join(root, d));
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) found.push(full);
      }
    };
    for (const root of roots) walk(root);
    return found;
  };

  it('always go through inAppRoute', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles()) {
      const source = fs.readFileSync(file, 'utf8');
      for (const line of source.split('\n')) {
        if (!/as Href/.test(line)) continue;
        if (/inAppRoute|routeForNotification/.test(line)) continue;
        offenders.push(`${file}: ${line.trim()}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
