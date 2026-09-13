import { readFileSync } from 'node:fs';
import path from 'node:path';

import { all, maxLength, minLength, required } from '@/utils/validation';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  Text longer than anybody drew for.

  `audit:sparse` drove data that was missing. `audit:basket` drove data there
  was a lot of. Nothing had driven data that is simply **long**, and the app
  had more room for it than anybody intended: of every text field, five capped
  what could be typed — the OTP box, a postal code, a product note, a support
  message and a rating comment — and every part of a delivery address did not.
  `utils/validation` had `required` and `minLength`, and no `maxLength`. A
  vocabulary with a floor and no ceiling.

  `npm run audit:long` types three addresses and renders each one:

      ordinary         14 chars a line      no overflow   (the control)
      long but real    91 chars a line      no overflow
      no ceiling      400 chars, unbroken   955px past a 390pt screen

  The middle case is what makes this about **unbroken runs** rather than about
  length. A genuinely long address — an estate name, a unit, a floor — has
  spaces to wrap at and was always fine. One token with nowhere to break is
  not, and customers produce those by accident: a complex name run together, a
  pasted link in a delivery note, an email typed into the wrong box.

  Two fixes, and only one of them is a fix.

  The layout one is real and belongs to the web build alone: React Native wraps
  an over-long word at a character boundary, React Native Web hands it to CSS
  where `overflow-wrap: normal` refuses to break inside a word. A defect that
  cannot exist on iOS or Android, on the build every preview is done from.

  The cap is a **guardrail**, stated as one. What a backend accepts in a
  `suburb` is its contract, and a limit invented here could reject a real
  address — so it is generous, and the real numbers are in `audit:launch`.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the half of the vocabulary that was missing.
 */
describe('1 — a ceiling, not only a floor', () => {
  const cap = maxLength('Suburb', 10);

  it('passes anything inside the limit', () => {
    expect(cap('Melville')).toBeNull();
    expect(cap('')).toBeNull();
  });

  it('refuses what is over it, and names the field and the number', () => {
    const message = cap('Weltevredenpark');

    expect(message).toBe('Suburb must be 10 characters or fewer');
  });

  it('measures the trimmed value, like every other rule here', () => {
    // Otherwise trailing whitespace could fail a field the customer can see is
    // short, with an error that points at nothing.
    expect(cap('Melville    ')).toBeNull();
    expect(cap('  Melville  ')).toBeNull();
  });

  it('counts exactly at the boundary', () => {
    expect(maxLength('x', 5)('abcde')).toBeNull();
    expect(maxLength('x', 5)('abcdef')).not.toBeNull();
  });

  it('is the mirror of the rule that already existed', () => {
    // `minLength` had been there since the beginning with nothing opposite it,
    // which is the whole reason nothing capped an address.
    expect(minLength('x', 5)('abcd')).toBe('x must be at least 5 characters');
    expect(maxLength('x', 5)('abcdef')).toBe('x must be 5 characters or fewer');
  });
});

/**
 * FIXTURE 2 — both ends of a field, composed.
 */
describe('2 — required and bounded at once', () => {
  const rule = all(required('Suburb'), maxLength('Suburb', 10));

  it('reports emptiness before length', () => {
    // The more useful sentence for somebody who has typed nothing. A "10
    // characters or fewer" error on an empty box is a puzzle.
    expect(rule('')).toBe('Suburb is required');
    expect(rule('   ')).toBe('Suburb is required');
  });

  it('reports length when there is something to be too long', () => {
    expect(rule('Weltevredenpark')).toBe('Suburb must be 10 characters or fewer');
  });

  it('passes a value that satisfies both', () => {
    expect(rule('Melville')).toBeNull();
  });

  it('stops at the first failure rather than collecting them', () => {
    // A field shows one error. Returning the first keeps that true without the
    // caller having to choose.
    const noisy = all(
      () => 'first',
      () => 'second',
    );
    expect(noisy('anything')).toBe('first');
  });

  it('passes when nothing objects, including with no rules at all', () => {
    expect(all()('anything')).toBeNull();
  });
});

/**
 * FIXTURE 3 — the layout fix, which is the one that is a fix.
 */
describe('3 — a word that cannot push the screen sideways', () => {
  const text = read('src/components/ui/Text.tsx');

  it('breaks long words, on web only', () => {
    expect(code('src/components/ui/Text.tsx')).toMatch(
      /Platform\.OS === 'web' \? \(\{ wordBreak: 'break-word' \}/,
    );
  });

  it('applies it in the one text primitive rather than at each screen', () => {
    /*
      The whole reason this is the right layer: `Text` is the only text
      primitive in the app, so this covers every screen including the one
      somebody adds next. Six screens draw customer-entered text today; the
      seventh is the one nobody would remember.
    */
    expect(code('src/components/ui/Text.tsx')).toMatch(/BREAK_LONG_WORDS,/);
  });

  it('says why native does not need it', () => {
    expect(text).toMatch(/React\s+\* Native lays a `Text` out itself/);
    expect(text).toMatch(/overflow-wrap: normal/);
  });

  it('breaks only a word that cannot fit, so ordinary prose is unchanged', () => {
    // `break-all` would break every line at the last character that fits,
    // including mid-word in normal sentences. `break-word` only steps in when
    // a word cannot fit on a line of its own.
    expect(text).toMatch(/`break-word` rather than `break-all`/);
    expect(code('src/components/ui/Text.tsx')).not.toMatch(/break-all/);
  });

  it('is the fix, and the cap is not', () => {
    /*
      Proven by stashing it. With the 120-character cap in place and this one
      line removed, `audit:long` goes red on the same case at the same two
      widths — 955px past a 390pt screen, 1025px past a 320pt one — because a
      capped field is still an unbroken run, and 120 characters of it do not
      fit on a phone either.

      Which settles which of the two changes this round is a fix. The cap
      bounds what reaches the kitchen; only this stops the screen being pushed
      sideways, and a round that had shipped the cap alone would have looked
      like it solved something.
    */
    expect(code('src/components/ui/Text.tsx')).toMatch(/BREAK_LONG_WORDS/);
    expect(read('src/components/ui/Text.tsx')).toMatch(/955px past a 390pt screen/);
  });

  it('sits under the caller-supplied style, like everything else here', () => {
    // A screen that genuinely wants a different wrapping rule can still say
    // so; the order in the flatten is the policy.
    const flattened = code('src/components/ui/Text.tsx');
    expect(flattened.indexOf('BREAK_LONG_WORDS')).toBeLessThan(flattened.lastIndexOf('style,'));
  });
});

/**
 * FIXTURE 4 — the guardrail, and that it is labelled as one.
 */
describe('4 — the cap, and what it is not', () => {
  const form = read('src/app/checkout/address.tsx');

  it('bounds every line of the address', () => {
    for (const field of ['label', 'line1', 'line2', 'suburb', 'city', 'province']) {
      expect(code('src/app/checkout/address.tsx')).toMatch(
        new RegExp(`${field}: (all\\(required|maxLength)`),
      );
    }
  });

  it('stops the typing as well as the saving', () => {
    // A rule that only fires on submit lets somebody write four hundred
    // characters and then tells them off for it. Six fields, capped at the
    // keyboard.
    const caps = code('src/app/checkout/address.tsx').match(/maxLength=\{FIELD_LIMIT\}/g) ?? [];
    expect(caps).toHaveLength(6);
  });

  it('bounds the note the driver reads, with room for sentences', () => {
    expect(code('src/app/checkout/address.tsx')).toMatch(/maxLength=\{FIELD_LIMIT \* 2\}/);
  });

  it('leaves room for the longest address the sweep proves renders', () => {
    /*
      91 characters is the longest line of `audit:long`'s "long but real" case
      — an estate name, a unit and a floor — and it renders correctly at both
      390 and 320pt. A cap below that would reject a real address, which is a
      worse bug than the one it fixes.
    */
    const limit = Number(/const FIELD_LIMIT = (\d+);/.exec(form)?.[1]);

    expect(limit).toBeGreaterThan(91);
    expect(limit).toBeLessThan(400);
  });

  it('calls itself a guardrail rather than a rule', () => {
    // The distinction this repository keeps making: a number nobody supplied
    // is not a business rule, and pretending otherwise is how an invented
    // limit becomes a requirement somebody later defends.
    expect(form).toMatch(/guardrail, not a business rule/);
    expect(form).toMatch(/audit:launch/);
  });

  it('hands the real numbers on', () => {
    const launch = read('scripts/audit-launch-readiness.mjs');

    expect(launch).toContain("'Field length limits'");
    expect(launch).toContain('guardrails I chose, not limits anybody gave');
    // The consequence, said plainly: a silent truncation is a wrong address.
    expect(launch).toContain('a delivery to the wrong gate');
  });
});

/**
 * FIXTURE 5 — the sweep, and the run of it that was measuring nothing.
 */
describe('5 — audit:long', () => {
  const audit = read('scripts/audit-long.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:long']).toBe('node scripts/audit-long.mjs');
  });

  it('carries an ordinary address as the control', () => {
    /*
      Every screen here draws something at every length, so overflow on a long
      case means nothing unless the same probe reports none on a short one. A
      failing control demotes every other finding in the run, in the run's own
      output.
    */
    expect(audit).toMatch(/name: 'ordinary',\s*\n\s*control: true,/);
    expect(audit).toMatch(/this sweep is measuring something that was already there/);
  });

  it('separates a long address from an unbroken run', () => {
    // Without the middle case this would have read as "long text breaks the
    // app", which is false and would have led to a cap instead of a fix.
    expect(audit).toMatch(/name: 'long but real'/);
    expect(audit).toMatch(/const unbroken = \(n\) => 'n'\.repeat\(n\);/);
  });

  it('proves each screen drew the text before believing its measurement', () => {
    /*
      The check that caught the first version of this sweep. It reported zero
      overflows on a 400-character address and a longest drawn word of thirteen
      characters — the same number as the control — because the mock backend
      keeps addresses in memory and a page reload emptied the list. All three
      cases were measuring an empty address book and reporting a pass.
    */
    expect(audit).toMatch(/document\.body\.innerText\.includes\(mark\)/);
    expect(audit).toMatch(/Its zero overflows are an absence, not a pass/);
  });

  it('reaches the second screen the way a customer does', () => {
    // The fix for the above: the address book is measured in place, and
    // checkout is reached through the selected address, which persists.
    expect(audit).toMatch(/await measure\('the address book'\);/);
    expect(audit).toMatch(/fulfilment-delivery/);
  });

  it('fills the form by test id rather than by position or label text', () => {
    // Position breaks when somebody reorders the form and label text breaks
    // when somebody rewords it, and neither should be able to turn this green.
    expect(audit).toMatch(/\[data-testid="address-field-\$\{field\}"\]/);
  });
});
