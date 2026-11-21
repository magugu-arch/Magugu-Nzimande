import { describe, expect, it } from 'vitest';
import { AA_NON_TEXT, AA_TEXT, contrastRatio, darkTheme, lightTheme } from '@scarlets/ui';
import { windowsOverlap } from './campaign-rules';
import { buildBody, decideTranslation, joinParagraphs, splitParagraphs } from './content-rules';
import { findScoreLike, scoreKeysIn } from './fixture-rules';
import { FREQUENCY_CAPS, checkFrequencyCap } from './notification-rules';
import { tokenCss } from './theme';
import { DAY, HOUR, utcToZonedInput, zonedInputToUtc } from './time';

describe('UK time fields', () => {
  it('reads a winter time as GMT and a summer time as BST', () => {
    expect(zonedInputToUtc('2026-12-05T17:00')).toBe('2026-12-05T17:00:00.000Z');
    expect(zonedInputToUtc('2026-07-01T17:00')).toBe('2026-07-01T16:00:00.000Z');
  });

  it('round-trips through the field format', () => {
    for (const iso of [
      '2026-12-05T17:00:00.000Z',
      '2026-07-01T16:00:00.000Z',
      '2027-03-28T02:30:00.000Z',
    ]) {
      expect(zonedInputToUtc(utcToZonedInput(iso))).toBe(iso);
    }
    expect(utcToZonedInput('2026-07-01T16:00:00Z')).toBe('2026-07-01T17:00');
  });

  it('rejects text that is not a real date and time', () => {
    expect(zonedInputToUtc('')).toBeNull();
    expect(zonedInputToUtc('tomorrow')).toBeNull();
    expect(zonedInputToUtc('2026-02-31T10:00')).toBeNull();
    expect(zonedInputToUtc('2026-11-23T25:00')).toBeNull();
  });
});

describe('frequency cap', () => {
  const cap = FREQUENCY_CAPS.marketing;
  const t = (day: number, hour = 12) => Date.UTC(2026, 10, day, hour);

  it('allows up to the maximum inside a window', () => {
    expect(checkFrequencyCap(t(10), [], cap)).toEqual({ breached: false });
    expect(checkFrequencyCap(t(12), [t(10)], cap)).toEqual({ breached: false });
  });

  it('refuses one more, and names the pushes it would crowd', () => {
    expect(checkFrequencyCap(t(12), [t(10), t(14)], cap)).toEqual({
      breached: true,
      clashing: [t(10), t(14)],
    });
    expect(checkFrequencyCap(t(9), [t(10), t(14)], cap)).toEqual({
      breached: true,
      clashing: [t(10), t(14)],
    });
  });

  it('uses a rolling window, not a calendar week', () => {
    expect(checkFrequencyCap(t(17), [t(10), t(14)], cap).breached).toBe(false); // exactly 7 days after the 10th
    expect(checkFrequencyCap(t(17, 11), [t(10), t(14)], cap).breached).toBe(true);
    expect(checkFrequencyCap(t(25), [t(10), t(14)], cap).breached).toBe(false);
  });

  it('does not blame the candidate for an older breach it is not part of', () => {
    expect(checkFrequencyCap(t(28), [t(10), t(11), t(12)], cap).breached).toBe(false);
  });

  it('has a tighter window for service messages', () => {
    expect(FREQUENCY_CAPS.service).toMatchObject({ max: 4, windowMs: DAY });
    const base = t(10, 9);
    const four = [0, 1, 2, 3].map((hours) => base + hours * HOUR);
    expect(checkFrequencyCap(base + 4 * HOUR, four, FREQUENCY_CAPS.service).breached).toBe(true);
    expect(checkFrequencyCap(base + 24 * HOUR, four, FREQUENCY_CAPS.service).breached).toBe(false);
  });
});

describe('campaign windows', () => {
  const w = (startsAt: string, endsAt: string) => ({ startsAt, endsAt });

  it('overlap when they share any instant', () => {
    expect(
      windowsOverlap(
        w('2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z'),
        w('2026-12-15T00:00:00Z', '2027-02-01T00:00:00Z'),
      ),
    ).toBe(true);
    expect(
      windowsOverlap(
        w('2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z'),
        w('2026-08-01T00:00:00Z', '2027-06-30T00:00:00Z'),
      ),
    ).toBe(true);
  });

  it('do not overlap when one starts as the other ends', () => {
    expect(
      windowsOverlap(
        w('2026-12-01T00:00:00Z', '2027-01-01T00:00:00Z'),
        w('2027-01-01T00:00:00Z', '2027-02-01T00:00:00Z'),
      ),
    ).toBe(false);
  });
});

describe('score guard', () => {
  it('spots score-shaped fields', () => {
    expect(scoreKeysIn({ kind: 'information', noteEn: 'x' })).toEqual([]);
    expect(scoreKeysIn({ score: 1, homeScore: 2, Result: '3', bonusPoints: 1 })).toEqual([
      'score',
      'homeScore',
      'Result',
      'bonusPoints',
    ]);
    expect(scoreKeysIn(null)).toEqual([]);
  });

  it('spots a score in text but leaves times and dates alone', () => {
    expect(findScoreLike('Scarlets 24-18 Demo XV')).toBe('24-18');
    expect(findScoreLike('Final: 24 – 18')).toBe('24 – 18');
    expect(findScoreLike('Lost by 12 points')).toBe('12 points');
    expect(findScoreLike('Kick-off moves to 19:35')).toBeNull();
    expect(findScoreLike('Gates open 17:30-18:00')).toBeNull();
    expect(findScoreLike('Postponed until 12 December 2026')).toBeNull();
  });
});

describe('content body and Welsh status', () => {
  it('splits on blank lines and tidies whitespace', () => {
    expect(splitParagraphs('One\nline.\n\n\n  Two.  \r\n\r\nThree.')).toEqual([
      'One line.',
      'Two.',
      'Three.',
    ]);
  });

  it('pairs Welsh with English by position, or leaves Welsh out', () => {
    expect(buildBody('A.\n\nB.', '')).toEqual({ ok: true, body: [{ en: 'A.' }, { en: 'B.' }] });
    expect(buildBody('A.\n\nB.', 'A cy.\n\nB cy.')).toEqual({
      ok: true,
      body: [
        { en: 'A.', cy: 'A cy.' },
        { en: 'B.', cy: 'B cy.' },
      ],
    });
    expect(buildBody('A.\n\nB.', 'A cy.').ok).toBe(false);
  });

  it('shows Welsh in the editor only when every paragraph has it', () => {
    expect(joinParagraphs([{ en: 'A.', cy: 'A cy.' }, { en: 'B.' }], 'cy')).toBe('');
    expect(joinParagraphs([{ en: 'A.', cy: 'A cy.' }], 'cy')).toBe('A cy.');
    expect(joinParagraphs([{ en: 'A.' }, { en: 'B.' }], 'en')).toBe('A.\n\nB.');
  });

  it('decides the Welsh status', () => {
    const base = {
      titleCy: 'Teitl',
      summaryCy: 'Crynodeb',
      previous: null,
      welshChanged: true,
      canApprove: false,
    } as const;
    expect(decideTranslation({ ...base, titleCy: '', requested: 'approved' })).toEqual({
      ok: true,
      status: 'missing',
    });
    expect(decideTranslation({ ...base, requested: 'draft' })).toEqual({
      ok: true,
      status: 'draft',
    });
    expect(decideTranslation({ ...base, requested: 'approved' })).toMatchObject({
      ok: false,
      reason: 'needs_approver',
    });
    expect(decideTranslation({ ...base, requested: 'approved', canApprove: true })).toEqual({
      ok: true,
      status: 'approved',
    });
    expect(
      decideTranslation({ ...base, summaryCy: '', requested: 'approved', canApprove: true }),
    ).toMatchObject({ ok: false, reason: 'incomplete' });
    expect(
      decideTranslation({
        ...base,
        requested: 'approved',
        previous: 'approved',
        welshChanged: false,
      }),
    ).toEqual({ ok: true, status: 'approved' });
  });
});

describe('design tokens on the web', () => {
  it('turns the @scarlets/ui tokens into custom properties for both schemes', () => {
    const css = tokenCss();
    expect(css).toContain(`--c-bg:${lightTheme.bg};`);
    expect(css).toContain(`--c-inverse:${lightTheme.inverse};`);
    expect(css).toContain(`--c-surface-muted:${lightTheme.surfaceMuted};`);
    expect(css).toContain('@media (prefers-color-scheme:dark)');
    expect(css).toContain(`--c-bg:${darkTheme.bg};`);
    expect(css).toContain('--t-display-tracking:');
    expect(css).toContain('--s-lg:16px;');
    expect(css).not.toContain('--c-scheme');
  });

  // The colour pairs the console's stylesheet actually uses.
  it.each([lightTheme, darkTheme])('meets WCAG AA contrast in the $scheme scheme', (theme) => {
    const text: Array<[string, string, string]> = [
      ['body text on the page', theme.text, theme.bg],
      ['body text on a card', theme.text, theme.surface],
      ['body text on a well', theme.text, theme.surfaceMuted],
      ['secondary text on the page', theme.textSecondary, theme.bg],
      ['secondary text on a card', theme.textSecondary, theme.surface],
      ['secondary text on a well', theme.textSecondary, theme.surfaceMuted],
      ['primary button label', theme.onAccent, theme.accent],
      ['pressed primary button label', theme.onAccent, theme.accentPressed],
      ['error text on a card', theme.accentText, theme.surface],
      ['error text on the page', theme.accentText, theme.bg],
      ['DEMO tag on a card', theme.goldText, theme.surface],
      ['DEMO tag on the page', theme.goldText, theme.bg],
      ['success text on a card', theme.success, theme.surface],
      ['success text on the page', theme.success, theme.bg],
      ['warning text on a card', theme.warning, theme.surface],
      ['warning text on the page', theme.warning, theme.bg],
      ['sidebar text', theme.onInverse, theme.inverse],
      ['sidebar muted text', theme.onInverseMuted, theme.inverse],
      ['sidebar active item', theme.onInverse, theme.inverseRaised],
      ['banner text', theme.onInverse, theme.inverseRaised],
      ['gold on the sidebar', theme.goldOnInverse, theme.inverse],
      ['gold on the banner', theme.goldOnInverse, theme.inverseRaised],
    ];
    for (const [name, foreground, background] of text) {
      expect(contrastRatio(foreground, background), name).toBeGreaterThanOrEqual(AA_TEXT);
    }
    // Focus rings and control outlines need 3:1 against what they sit on.
    expect(contrastRatio(theme.text, theme.bg)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    expect(contrastRatio(theme.onInverse, theme.inverse)).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });
});
