import { SAUCES, optionGroupsFor } from '@bbq/seed';
import type { OptionGroup } from '@bbq/types';
import { describe, expect, it } from 'vitest';
import { productBySlug, required } from './fixtures';
import { chooseOption, defaultSelection, lineKey, unitPriceFor } from '@/lib/cart';

function extrasOf(groups: readonly OptionGroup[]): OptionGroup {
  return required(
    groups.find((candidate) => candidate.key === 'extras'),
    'an extras group',
  );
}

const halfHalf = productBySlug('half-half');
const halfHalfGroups = optionGroupsFor(halfHalf);
const group = (key: string) => {
  const found = halfHalfGroups.find((candidate) => candidate.key === key);
  if (!found) throw new Error(`No option group ${key}`);
  return found;
};

describe('Half and Half', () => {
  it('opens with two different sauces', () => {
    const selection = defaultSelection(halfHalfGroups);
    expect(selection.sauceA?.[0]).not.toBe(selection.sauceB?.[0]);
  });

  it('moves the second sauce aside when the first takes it', () => {
    let selection = defaultSelection(halfHalfGroups);
    const wanted = required(selection.sauceB?.[0], 'a second sauce in the default selection');

    selection = chooseOption(halfHalfGroups, selection, group('sauceA'), wanted);

    expect(selection.sauceA?.[0]).toBe(wanted);
    expect(selection.sauceB?.[0]).not.toBe(wanted);
  });

  it('moves the first sauce aside when the second takes it', () => {
    let selection = defaultSelection(halfHalfGroups);
    const wanted = required(selection.sauceA?.[0], 'a first sauce in the default selection');

    selection = chooseOption(halfHalfGroups, selection, group('sauceB'), wanted);

    expect(selection.sauceB?.[0]).toBe(wanted);
    expect(selection.sauceA?.[0]).not.toBe(wanted);
  });

  it('never holds the same sauce twice, whichever sauce is picked', () => {
    for (const sauce of SAUCES) {
      let selection = defaultSelection(halfHalfGroups);
      selection = chooseOption(halfHalfGroups, selection, group('sauceA'), sauce.name);
      expect(selection.sauceA?.[0]).not.toBe(selection.sauceB?.[0]);

      selection = chooseOption(halfHalfGroups, selection, group('sauceB'), sauce.name);
      expect(selection.sauceA?.[0]).not.toBe(selection.sauceB?.[0]);
    }
  });
});

describe('option selection', () => {
  it('replaces the choice in a single group', () => {
    let selection = defaultSelection(halfHalfGroups);
    selection = chooseOption(halfHalfGroups, selection, group('size'), 'Half bird');
    expect(selection.size).toEqual(['Half bird']);
  });

  it('toggles choices in a multi group', () => {
    const groups = optionGroupsFor(productBySlug('french-fries'));
    const extras = extrasOf(groups);
    let selection = defaultSelection(groups);

    expect(selection.extras).toEqual([]);
    selection = chooseOption(groups, selection, extras, 'Pickled radish');
    expect(selection.extras).toEqual(['Pickled radish']);
    selection = chooseOption(groups, selection, extras, 'Pickled radish');
    expect(selection.extras).toEqual([]);
  });
});

describe('unit price', () => {
  it('is the base price when nothing adds a delta', () => {
    const groups = optionGroupsFor(halfHalf);
    const selection = defaultSelection(groups);
    expect(unitPriceFor(halfHalf.priceCents, groups, selection)).toBe(halfHalf.priceCents);
  });

  it('takes off the half-bird delta', () => {
    const groups = optionGroupsFor(halfHalf);
    let selection = defaultSelection(groups);
    selection = chooseOption(groups, selection, group('size'), 'Half bird');
    expect(unitPriceFor(halfHalf.priceCents, groups, selection)).toBe(halfHalf.priceCents - 7_000);
  });

  it('adds every extra that is selected', () => {
    const groups = optionGroupsFor(halfHalf);
    const extras = extrasOf(groups);
    let selection = defaultSelection(groups);
    selection = chooseOption(groups, selection, extras, 'Extra dipping sauce');
    selection = chooseOption(groups, selection, extras, 'Cheese dust');
    expect(unitPriceFor(halfHalf.priceCents, groups, selection)).toBe(
      halfHalf.priceCents + 1_500 + 2_000,
    );
  });
});

describe('line identity', () => {
  it('matches two lines with the same options in any order', () => {
    const a = lineKey('half-half', [
      { groupKey: 'size', groupLabel: 'Size', choices: ['Whole bird'] },
      { groupKey: 'extras', groupLabel: 'Add to it', choices: ['Cheese dust', 'Pickled radish'] },
    ]);
    const b = lineKey('half-half', [
      { groupKey: 'extras', groupLabel: 'Add to it', choices: ['Pickled radish', 'Cheese dust'] },
      { groupKey: 'size', groupLabel: 'Size', choices: ['Whole bird'] },
    ]);
    expect(a).toBe(b);
  });

  it('separates a whole bird from a half bird', () => {
    const whole = lineKey('half-half', [
      { groupKey: 'size', groupLabel: 'Size', choices: ['Whole bird'] },
    ]);
    const half = lineKey('half-half', [
      { groupKey: 'size', groupLabel: 'Size', choices: ['Half bird'] },
    ]);
    expect(whole).not.toBe(half);
  });
});
