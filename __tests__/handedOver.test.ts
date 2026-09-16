import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  The build nothing was driving, and the screen nobody had opened.

  Thirty-two sweeps build this app, and all thirty-two build it the same way:
  `expo export --platform web` into a directory, served by a small Node server
  each script writes for itself, with a fallback that answers any unknown path
  with `index.html`.

  Nobody outside this repository is served by that. What leaves here is one
  file — `bbq-chicken-app.html` — published as an artifact and attached to a
  message. Thirty-nine versions of it had gone to the client, checked by
  exactly one thing: a person, by eye.

  `audit:single` serves that file the way a single-document host serves it —
  one document, 404 for everything else, no fallback — and because it is the
  only sweep that starts the app at its own entry point rather than navigating
  past it, it opened the welcome carousel. Which had never been opened.

  **The carousel did not work.** `index` was fed by `onMomentumScrollEnd`
  alone, and react-native-web does not fire momentum events for a programmatic
  `scrollToOffset`. So on every web build:

    • the picture advanced and the headline, body and dots did not — the
      customer read one slide while looking at another;
    • `handleNext` scrolls to `(index + 1) * width` with `index` stuck at 0,
      so the second press went to the same offset as the first and the
      carousel could not be moved off slide two;
    • `isLastSlide` never became true, so **"Get started" never appeared** and
      the app's first screen could not be finished with its own button. Skip —
      a 27x19 link in the corner — was the only way in.

  Two lessons, and these fixtures are about both: a sweep that only ever
  navigates *past* a screen is not covering it, and the artefact you hand over
  is not the artefact you test unless you test the artefact you hand over.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the carousel advances, and nothing in it depends on momentum.
 */
describe('1 — the first screen of the app', () => {
  const welcome = code('src/app/(onboarding)/welcome.tsx');

  it('does not leave the slide number to an event that one platform never sends', () => {
    /*
      The bug, as an assertion. `onMomentumScrollEnd` is a real event and
      belongs here for the native swipe; it is being the *only* source that
      broke the web build, so what this pins is that `onScroll` is wired too.
    */
    expect(welcome).toMatch(/onScroll=\{handleScroll\}/);
    expect(welcome).toMatch(/onMomentumScrollEnd=\{handleScroll\}/);
  });

  it('asks for scroll events often enough for iOS to send them', () => {
    // Without this iOS throttles `onScroll` to roughly once a second, which
    // for a carousel tracking a finger is the same as not sending it.
    expect(welcome).toMatch(/scrollEventThrottle=\{16\}/);
  });

  it('advances the slide in the press rather than waiting to be told', () => {
    // `handleNext` knows where it is sending the list. Deriving that back out
    // of a listener is what made the button depend on a platform detail.
    expect(welcome).toMatch(/const next = index \+ 1;/);
    expect(welcome).toMatch(/setIndex\(next\);/);
    expect(welcome).toMatch(/scrollToOffset\(\{ offset: next \* width/);
  });

  it('cannot be scrolled past either end of the deck', () => {
    // A drag with rubber-banding reports an offset outside the deck, and an
    // out-of-range `index` empties the headline via `SLIDES[index]?.headline
    // ?? ''` — a blank panel over a photograph.
    expect(welcome).toMatch(/Math\.min\(SLIDES\.length - 1, Math\.max\(0, Math\.round\(/);
  });

  it('still ends onboarding on the last slide and not before', () => {
    expect(welcome).toMatch(/const isLastSlide = index === SLIDES\.length - 1;/);
    expect(welcome).toMatch(/label=\{isLastSlide \? 'Get started' : 'Next'\}/);
  });
});

/**
 * FIXTURE 2 — the sweep that drives what we actually hand over.
 */
describe('2 — audit:single', () => {
  const audit = read('scripts/audit-single.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:single']).toBe('node scripts/audit-single.mjs');
  });

  it('serves the document with no fallback, unlike every other sweep', () => {
    /*
      The single difference that makes this sweep able to see a missed asset.
      The other sweeps answer an unknown path with `index.html`, which is right
      for a directory build with deep links and turns a 404 into a silent 200.
    */
    /*
      Scoped to the server, not to the file. The header explains at length what
      the *other* sweeps' servers do, and one finding quotes it back to the
      reader — naming `index.html` in either place is the explanation, and a
      fixture that could not tell those from a fallback would be failing on
      prose.
    */
    const server = /function serve\(\) \{[\s\S]*?\n\}/.exec(code('scripts/audit-single.mjs'))?.[0];

    expect(server).toMatch(/res\.writeHead\(404/);
    expect(server).toMatch(/no such file/);
    expect(server).not.toMatch(/index\.html/);
  });

  it('opens the file at a deep path, at the root and off a disk', () => {
    expect(audit).toMatch(/const HOSTED_AT = '\/artifact\//);
    expect(audit).toMatch(/pathToFileURL\(SINGLE\)\.href/);
    // The root is the control: if the app failed to start for a reason that
    // has nothing to do with where it was served, all three go red together.
    expect(audit).toMatch(/note: 'the control'/);
  });

  it('allows the one delivery that legitimately does not open on welcome', () => {
    /*
      From `file://` the browser refuses to rewrite the path, so the catch-all
      draws and the shim presses its own "Back to home" — landing on home, past
      onboarding. Holding that to `welcome` would be a fixture asserting a
      wrong expectation, which is how a sweep teaches people to ignore it.
    */
    expect(audit).toMatch(/expect: 'somewhere real'/);
    expect(audit).toMatch(/expect: 'welcome'/);
  });

  it('reads the file as a file as well as watching the wire', () => {
    /*
      The runtime half can only speak for the screens it opens, and a
      counterfactual proved it: one data URI put back to a path on a screen the
      sweep does not visit, and it stayed green. The static half compares the
      document against what the export actually emitted, so it does not depend
      on where anybody navigated.
    */
    expect(audit).toMatch(/const notInlined = emitted\(exportedAssets\)/);
    expect(audit).toMatch(/\.filter\(\(key\) => documentText\.includes\(key\)\)/);
  });

  it('refuses to run half of itself and call it an answer', () => {
    // Without the export beside it, which assets *should* have been inlined is
    // unknowable. Exit 2 — "could not run" — not a green from the other half.
    expect(audit).toMatch(/half this sweep cannot run/);
    expect(audit).toMatch(/process\.exit\(2\)/);
  });

  it('drives the carousel to the end rather than diffing the page text', () => {
    /*
      The first draft compared `document.body.innerText` before and after a
      press, which was wrong twice: the photograph is not text, so a working
      carousel looked broken, and the words never changed, so a broken one
      looked the same. The finding is about slides, so the probe is slides.
    */
    expect(audit).toMatch(/headline: lines\[1\] \?\? ''/);
    expect(audit).toMatch(/Next never became "Get started"/);
    expect(audit).not.toMatch(/before !== after/);
  });

  it('never prints a summary its own findings contradict', () => {
    // An earlier draft asserted "every asset is either inside it or
    // unreferenced" unconditionally, above a finding saying otherwise.
    expect(audit).toMatch(/notInlined\.length === 0\s*\?\s*'Every asset the export wrote/);
  });

  it('exempts the file:// history refusal narrowly and says why', () => {
    /*
      A `null` origin cannot use the History API, so the router's own
      `replaceState` throws uncaught on that delivery and navigation continues
      in memory. Exempting it is right; exempting "errors on file://" would
      make the third row unable to report anything at all.
    */
    expect(audit).toMatch(/delivery\.expect === 'somewhere real' &&/);
    expect(audit).toMatch(/\/SecurityError\/\.test\(crash\) &&/);
    expect(audit).toMatch(/result\.landed === 'past it, to home'/);
  });

  it('does not decide where the app landed by racing two selectors', () => {
    /*
      Written first as `waitForSelector('welcome, catch-all')` and judge the
      winner. Off a disk the catch-all draws and the shim clicks through it in
      about a tenth of a second, so the verdict depended on whether a
      twenty-second wait happened to open inside that window: the same file
      reported "past it, to home" on one run and "nothing at all" — from a page
      sitting on home with thirty-three photographs — on the next.

      Polling alone did not fix it either, because the whole episode fits
      inside one interval. What fixed it was dropping the flash from the
      question: each delivery is polled for what it is meant to reach.
    */
    expect(audit).not.toMatch(/waitForSelector\(`\$\{WELCOME\}, \$\{CATCH_ALL\}`/);
    expect(audit).not.toMatch(/sawCatchAll/);
    expect(audit).toMatch(/if \(expect === 'somewhere real'\) \{/);
  });

  it('will not call a screen the app is passing through a destination', () => {
    // One reading would accept the splash — a line of copy and no catch-all —
    // on its way to somewhere. Two readings 150ms apart will not.
    expect(audit).toMatch(/settled = !now\.catchAll && now\.text > 40 \? settled \+ 1 : 0;/);
    expect(audit).toMatch(/if \(settled >= 2\)/);
  });
});

/**
 * FIXTURE 3 — the bundler's claims about its own output.
 */
describe('3 — bundle-single-file.mjs', () => {
  const bundler = read('scripts/bundle-single-file.mjs');

  it('no longer claims both deliveries land on the welcome screen', () => {
    /*
      It said "both land on the welcome screen". Driven, they do not: over http
      the customer gets welcome, off a disk they get home with onboarding
      skipped. A comment is a claim, and this one was wrong for as long as the
      shim has existed because nothing had opened the file either way.
    */
    // Retracted rather than deleted — the sentence is still there, in quotes,
    // as the thing that used to be claimed. A wrong claim that simply vanishes
    // teaches nobody why the check exists.
    expect(bundler).toMatch(/used to say they were\s*\n?\s*\*?\s*\("both land on the welcome/);
    expect(bundler).toMatch(/Opened off a disk they get \*\*home\*\*/);
    expect(bundler).toMatch(/`audit:single` drives all three deliveries/);
  });

  it('still refuses to fold an export older than the code', () => {
    expect(bundler).toMatch(/is \$\{behind\} minute\(s\) older than src\//);
  });
});

/**
 * FIXTURE 4 — the gap that hid it: a screen every sweep navigates past.
 */
describe('4 — the entry point is somebody’s screen', () => {
  /** Every sweep, derived — the list is never the point, the count is. */
  const sweeps = readdirSync(path.join(root, 'scripts'))
    .filter((file) => file.startsWith('audit-') && file.endsWith('.mjs'))
    .map((file) => path.join('scripts', file));

  it('keeps at least one sweep that lets the app choose its own first screen', () => {
    /*
      Everything else either seeds `hasCompletedOnboarding` or navigates
      straight to a route, which is correct for what those sweeps measure and
      is why `/welcome` went thirty-five rounds without being opened.

      Written first as exactly one, with "one is enough" as the reasoning. That
      was wrong the following round: `audit:firstrun` opens the entry point too
      and walks on through sign-in to the permission screen and Home, which is
      a second thing worth having rather than a duplicate. What this fixture is
      actually for is that the count never goes back to zero, so it says that.
    */
    const opensTheEntryPoint = sweeps.filter((file) => /onboarding-next/.test(read(file)));

    expect(opensTheEntryPoint).toContain('scripts/audit-single.mjs');
    expect(opensTheEntryPoint).toContain('scripts/audit-firstrun.mjs');
  });

  it('documents the single-file build as the thing that gets handed over', () => {
    const handover = read('HANDOVER.md');
    expect(handover).toMatch(/audit:single/);
  });
});
