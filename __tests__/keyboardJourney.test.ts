import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (file: string) => readFileSync(path.join(__dirname, '..', file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/**
 * 1 — a customer who never touches the screen.
 *
 * `audit:screens` has checked focus rings since it was written, and it does
 * that by calling `el.focus()` directly. That is the right check for §32.6 and
 * a narrower one than it looks: it proves a ring appears *if* something is
 * focused, not that Tab can reach anything, nor that a control does anything
 * when Enter lands on it.
 *
 * React Native Web decides on its own which of its `Pressable`s become
 * tabbable, so this is precisely the kind of thing that breaks without
 * rendering differently or failing a test — and the person it breaks for
 * simply cannot buy anything.
 *
 * Driven end to end in Chromium, the answer today is that they can. This is a
 * guard on a result, not a repair.
 */
describe('ordering without a pointer', () => {
  it('is driven as a journey rather than inspected', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    // Every action is a key press. A click anywhere would make the result a
    // claim about something else.
    expect(audit).not.toMatch(/\.click\(/);
    expect(audit).toMatch(/keyboard\.press\('Tab'\)/);
    expect(audit).toMatch(/press\('Enter'\)/);
    expect(audit).toMatch(/keyboard\.press\('Escape'\)/);
  });

  it('covers the whole journey, not one screen of it', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    for (const route of ['/sign-in', '/product/golden-original', '/cart', '/checkout']) {
      expect(audit).toContain(route);
    }
  });

  /** 2 — signing in, which is where a keyboard journey either starts or stops. */
  it('types into the form and submits it with Enter', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/keyboard\.type\('loyal@example\.co\.za'\)/);
    expect(audit).toMatch(/Enter on the sign-in button did not submit the form/);
  });

  /**
   * 3 — the distance to the button that matters.
   *
   * Reachable and usable are different claims. A control forty tab stops down
   * a screen satisfies WCAG 2.1.1 and fails the person it is written for, so
   * the audit reports the count and fails on an unreasonable one.
   */
  it('measures how far "Add to cart" is, not only whether it is reachable', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/addToCart\.presses > 40/);
    expect(audit).toMatch(/reachable, but not usably so/);
  });

  /** 4 — and the one that takes the money. */
  it('presses Enter on Place order and checks an order actually happened', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/Place order/);
    expect(audit).toMatch(/\/confirmation\/\.test\(page\.url\(\)\)/);
    expect(audit).toMatch(/Enter on "Place order" did not place one/);
  });
});

/**
 * 5 — the dialog, which is where modals usually fail.
 *
 * A modal that is merely drawn over a page leaves the page behind it tabbable,
 * and a keyboard user then walks out of the question without answering it.
 * `DialogHost` uses React Native's `Modal` on the strength of a comment saying
 * react-native-web implements a portal, a focus trap and an Escape handler.
 *
 * That is a claim about a dependency, and the last time this repository trusted
 * one of those — NetInfo's connectivity events — it was wrong. So it was
 * checked: the trap holds, Escape closes, and focus returns to the control that
 * opened it. The comment was right, and now it is verified rather than
 * believed.
 */
describe('the confirmation dialog under a keyboard', () => {
  it('is checked for a trap across enough tab stops to cycle', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/focus leaves the open dialog/);
    expect(audit).toMatch(/data-testid="dialog-scrim"/);
  });

  it('is checked for Escape, and for where focus lands afterwards', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/Escape did not close the dialog/);
    expect(audit).toMatch(/focus did not return to the control that opened the dialog/);
  });

  /**
   * 6 — the one thing that was wrong, and it was the first thing anybody met.
   *
   * The scrim is a pointer convenience — tap outside to dismiss — and it was
   * also a focusable control labelled "Dismiss". Being first in the modal, it
   * opened the tab cycle: Dismiss → title → Empty cart → Keep it. A button
   * offering to close the question, announced before the question.
   */
  it('no longer puts a "Dismiss" control ahead of the question', () => {
    const host = code('src/components/system/DialogHost.tsx');
    const scrim = host.slice(host.indexOf('testID="dialog-scrim"') - 700);

    expect(scrim).toMatch(/focusable=\{false\}/);
    // The role and the label went with it: not a control, so not announced.
    expect(scrim).not.toMatch(/accessibilityLabel="Dismiss"/);
    expect(scrim).not.toMatch(/accessibilityRole="button"/);
  });

  /**
   * And *not* by hiding it. The first attempt reached for `aria-hidden` and
   * `importantForAccessibility="no"`, and the dialog's own tests failed on the
   * spot: the scrim wraps the card, both attributes are inherited, and hiding
   * the scrim hid the question inside it from the accessibility tree too.
   */
  it('does not hide the question it wraps', () => {
    const host = code('src/components/system/DialogHost.tsx');
    const scrim = host.slice(host.indexOf('style={styles.scrim}'), host.indexOf('styles.card'));

    expect(scrim).not.toMatch(/aria-hidden/);
    expect(scrim).not.toMatch(/importantForAccessibility="no"/);
  });

  it('keeps the tap-outside dismissal it exists for', () => {
    const host = code('src/components/system/DialogHost.tsx');

    expect(host).toMatch(/onPress=\{\(\) => answer\(id, false\)\}/);
  });

  /**
   * 7 — nothing is lost by that. Escape dismisses, and the polite version of
   * the same answer is a real button inside the card.
   */
  it('leaves two ways out that a keyboard can take', () => {
    const host = code('src/components/system/DialogHost.tsx');

    expect(host).toMatch(/onRequestClose=\{\(\) => answer\(id, false\)\}/);
    expect(host).toMatch(/cancelLabel/);
  });

  it('is the first tab stop the audit now asserts', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/the first tab stop inside the dialog is the scrim/);
  });
});

/**
 * 8 — the audit's own honesty.
 *
 * The failure this whole file is least able to notice is a sweep that stopped
 * doing anything and kept reporting green. `audit:text-scale` had exactly that
 * bug on its first run and only its own no-op check caught it, so the same
 * discipline applies here: every step is counted, and a run that completes no
 * steps is not a pass.
 */
describe('the keyboard audit itself', () => {
  it('counts what it did and prints the count', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/steps\.push\(text\)/);
    expect(audit).toMatch(/step\(s\) completed by keyboard alone/);
  });

  it('exits non-zero on a finding', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/if \(findings\.length === 0\)/);
    expect(audit).toMatch(/process\.exit\(1\)/);
  });

  /** 9 — and it serves its build the contained way, like the rest of them. */
  it('serves its build from inside its own directory, on loopback', () => {
    const audit = code('scripts/audit-keyboard.mjs');

    expect(audit).toMatch(/!file\.startsWith\(OUT \+ path\.sep\)/);
    expect(audit).toMatch(/listen\(PORT, '127\.0\.0\.1'/);
  });

  /** 10 — and it is a command somebody can actually run. */
  it('is registered, and named for what it proves', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

    expect(pkg.scripts['audit:keyboard']).toBe('node scripts/audit-keyboard.mjs');
    expect(code('scripts/audit-keyboard.mjs')).toMatch(
      /A customer who never touches the screen can order dinner/,
    );
  });
});
