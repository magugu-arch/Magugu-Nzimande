import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const here = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(here);
    return /\.tsx?$/.test(entry.name) ? [here] : [];
  });
}

/*
  ───────────────────────────────────────────────────────────────────────────
  The guarantee the project believed it had.

  `app.json` sets `experiments: { typedRoutes: true }`, and `tsconfig.json`
  includes the `.expo/types` directory to pick up what that generates. Between them
  they are supposed to make a navigation target a compile error when it names
  a screen that does not exist — a typo in `router.push('/account/notifcations')`
  caught by `tsc` rather than by a customer landing on "This page has moved on".

  It does not work, and it has never worked here. Two independent reasons:

    1. **Nothing generates the types.** `.expo/types/router.d.ts` is written by
       the dev server. `npx expo export` does not write it — checked — and the
       dev server does not run in this environment or in CI. Without that file
       `ExpoRouter.__routes` stays the empty interface expo-router ships, and
       `Href` degrades to plain `string`.

    2. **`tsconfig.json` excluded them anyway.** `include` listed the
       `.expo/types` glob and `exclude` listed `.expo`. Exclude wins — it
       filters what include finds — so even a generated file would have been
       dropped.

  Proven rather than argued: a deliberate `router.push('/account/notifcations-
  TYPO-THAT-IS-NOT-A-ROUTE')` was planted in `(tabs)/home.tsx` and
  `npx tsc --noEmit` exited 0.

  That matters beyond the feature, because `npm run verify` runs `typecheck`
  and this project has reported it clean every round — believing route targets
  were among the things being checked. They were not.

  The exclude is fixed, so a developer running the dev server now gets the
  types. But CI still has nobody to generate them, and reimplementing Expo's
  typegen would mean writing a file whose contract I cannot read: AGENTS.md
  points at the versioned docs and the egress proxy blocks them.

  So the line is held here instead, in the project's own idiom — derive both
  sides from source and compare — which needs no Expo internals and cannot
  drift with their file format.
  ───────────────────────────────────────────────────────────────────────────
*/

/** Every screen a customer can be on, derived from the router's own filesystem. */
const ROUTES = (function collect(dir = 'src/app'): { route: string; file: string }[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const here = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(here);
    if (!/\.tsx$/.test(entry.name)) return [];
    if (/_layout\.tsx$/.test(entry.name)) return [];
    const route = here
      .replace(/^src\/app/, '')
      .replace(/\.tsx$/, '')
      .replace(/\/index$/, '');
    return [{ route: route === '' ? '/' : route, file: here }];
  });
})();

/**
 * A route as the router matches it: groups are invisible, parameters are holes.
 *
 * `/(tabs)/home` and `/home` are the same screen; `/product/[id]` matches any
 * one segment in that position.
 */
const asPattern = (route: string) => route.replace(/\/\([a-z-]+\)/g, '') || '/';

/**
 * Does a concrete path land on this route pattern?
 *
 * Both sides are normalised, because a call site may name the group or leave
 * it out and the router treats the two the same: `router.push('/(tabs)/menu')`
 * and `router.push('/menu')` arrive at the same screen. Normalising only the
 * route — the first version of this — reported every grouped call site in the
 * app as a broken link, which is the sort of noise that gets a suite ignored.
 */
function matches(pattern: string, target: string): boolean {
  const a = asPattern(pattern).split('/');
  const b = asPattern(target).split('/');
  if (a.length !== b.length) return false;
  return a.every((segment, i) => /^\[.+\]$/.test(segment) || segment === b[i]);
}

/**
 * A route literal, tidied into something comparable with a route pattern.
 *
 * A template hole stands for one segment, the same as a route parameter, and a
 * query string or fragment is not part of the match.
 */
const asTarget = (raw: string) => raw.replace(/\$\{[^}]*\}/g, 'x').split(/[?#]/)[0] as string;

/*
  Two questions, two derivations, and they are deliberately not the same one.

  "Does this target resolve?" has to be precise: it is only fair to fail a
  string that is genuinely being used to navigate. So it reads navigation calls
  and nothing else.

  "Can this screen be reached?" has to be generous: under-reading it accuses a
  working screen of being unreachable. The app routes through helpers —
  `postAuthRoute` returns a path, `index.tsx` picks one inside a ternary — and
  a scanner that only understood `router.push('…')` called three real screens
  dead. So it counts any literal naming a route, wherever it appears.

  Using the precise set for both would have raised three false findings; using
  the generous set for both would have let a typo through, because a string
  nothing recognises is exactly what a typo is.
*/

/** Where the app sends somebody, from the calls that send them. */
const TARGETS = sourceFiles().flatMap((file) => {
  const source = code(file);
  const found: { to: string; file: string }[] = [];
  const push = (raw: string | undefined) => {
    if (raw === undefined) return;
    const to = asTarget(raw);
    if (!to.startsWith('/')) return; // relative, external, or a custom scheme
    found.push({ to, file });
  };
  for (const m of source.matchAll(/router\.(?:push|replace|navigate)\(\s*['"`]([^'"`]+)['"`]/g))
    push(m[1]);
  /*
    `href` takes an expression, not just a literal — `<Redirect href={done ? a
    : b} />` is how the splash chooses between home and onboarding — so the
    whole attribute is read and every literal inside it counted.
  */
  for (const m of source.matchAll(/href=(\{[^}]*\}|['"`][^'"`]*['"`])/g))
    for (const lit of (m[1] as string).matchAll(/['"`]([^'"`]+)['"`]/g)) push(lit[1]);
  return found;
});

/** Every literal anywhere in `src` that names one of this app's routes. */
const MENTIONS = sourceFiles().flatMap((file) =>
  [...code(file).matchAll(/['"`](\/[A-Za-z0-9_\-/()[\]$.{}]*)['"`]/g)].map((m) =>
    asTarget(m[1] as string),
  ),
);

/**
 * Screens with no in-app way in, and the reason each one is allowed to have
 * none. Every entry has to earn its place — see the fixture below, which fails
 * if one of these becomes reachable and the exemption goes stale.
 */
const ENTERED_FROM_OUTSIDE: Record<string, string> = {
  '/reset-password':
    'Opened from the link in a password-reset email, so nothing in the app links to it. ' +
    'audit:launch carries the deep-link work this still needs.',
};

describe('1 — every navigation target is a screen that exists', () => {
  it('finds both sides of the question', () => {
    // A derivation that quietly found nothing would pass every test below it.
    expect(ROUTES.length).toBeGreaterThan(30);
    expect(TARGETS.length).toBeGreaterThan(30);
    expect(MENTIONS.length).toBeGreaterThan(TARGETS.length);
  });

  it.each([...new Map(TARGETS.map((t) => [t.to, t])).values()].map((t) => [t.to, t.file] as const))(
    '%s resolves to a screen',
    (to) => {
      /*
      The check `typedRoutes` was supposed to be doing. A target matching no
      route is not a crash — Expo Router renders the catch-all — so it ships
      looking like a working button that says "This page has moved on".
    */
      expect(ROUTES.some((r) => matches(r.route, to))).toBe(true);
    },
  );
});

describe('2 — every screen has a way in', () => {
  /** Tabs are reached by the tab bar, so the tab layout is an entry point. */
  const tabs = [
    ...code('src/app/(tabs)/_layout.tsx').matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g),
  ].map((m) => `/${m[1]}`);

  const reachable = (pattern: string) =>
    pattern === '/' ||
    pattern === '/+not-found' ||
    tabs.includes(pattern) ||
    MENTIONS.some((to) => matches(pattern, to));

  it('registers the tabs it thinks it does', () => {
    expect(tabs.sort()).toEqual(['/home', '/menu', '/more', '/orders', '/rewards']);
  });

  it.each(ROUTES.map((r) => [asPattern(r.route), r.file] as const))(
    '%s can be reached',
    (pattern) => {
      if (ENTERED_FROM_OUTSIDE[pattern] !== undefined) return;
      expect(reachable(pattern)).toBe(true);
    },
  );

  it('has no stale exemptions', () => {
    /*
      The half that keeps the list above honest. When somebody finally links to
      a screen that used to be entered only from outside, the exemption stops
      being true — and an exemption nobody re-reads is how a list rots into
      permission to skip whatever is under it.
    */
    const nowReachable = Object.keys(ENTERED_FROM_OUTSIDE).filter((route) => reachable(route));

    expect(nowReachable).toEqual([]);
  });

  it('gives a reason for every exemption', () => {
    for (const [route, reason] of Object.entries(ENTERED_FROM_OUTSIDE)) {
      expect(ROUTES.some((r) => asPattern(r.route) === route)).toBe(true);
      expect(reason.length).toBeGreaterThan(40);
    }
  });
});

describe('3 — the typed-routes configuration', () => {
  const tsconfig = JSON.parse(read('tsconfig.json')) as {
    include: string[];
    exclude: string[];
  };

  it('no longer excludes the directory it includes from', () => {
    /*
      Including the `.expo/types` glob while excluding `.expo` is a
      contradiction TypeScript resolves silently in favour of exclude, so the
      generated route types were dropped without a word.
    */
    expect(tsconfig.include).toContain('.expo/types/**/*.ts');
    expect(tsconfig.exclude).not.toContain('.expo');
  });

  it('keeps the build output excluded, which is what that entry was for', () => {
    // `.expo/web` and `.expo/dev` are caches, and compiling them would be slow
    // and meaningless. Only the generated types were ever wanted.
    expect(tsconfig.exclude).toContain('.expo/web');
    expect(tsconfig.exclude).toContain('.expo/dev');
  });

  it('does not pretend the types are there when they are not', () => {
    /*
      The honest part, and the reason this suite exists rather than a compiler
      flag. With the exclude fixed, a developer running the dev server gets
      real route types. CI has nobody to generate them — `expo export` does not
      write `.expo/types`, checked — so `tsc` there still sees `Href = string`
      and these fixtures are the whole enforcement.

      If that ever changes and the types are generated, this asserts the
      include is still pointing at them, so the compiler check comes back
      automatically rather than needing somebody to notice.
    */
    const generated = existsSync(path.join(root, '.expo/types'));

    expect(tsconfig.include).toContain('.expo/types/**/*.ts');
    if (generated) {
      expect(readdirSync(path.join(root, '.expo/types')).some((f) => f.endsWith('.d.ts'))).toBe(
        true,
      );
    }
  });

  it('is written down where the next person will look', () => {
    // A limitation that lives only in a test comment is one the next reader
    // finds after trusting the thing it limits.
    expect(read('HANDOVER.md')).toMatch(/typedRoutes/);
  });
});
