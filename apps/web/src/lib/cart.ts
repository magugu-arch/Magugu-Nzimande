import { EXCLUSIVE_SAUCE_GROUPS } from '@bbq/seed';
import type { OptionGroup, OrderLine, SelectedOption } from '@bbq/types';

/** A selection is group key to chosen labels. Single groups hold exactly one. */
export type Selection = Record<string, string[]>;

export function defaultSelection(groups: readonly OptionGroup[]): Selection {
  const selection: Selection = {};
  for (const group of groups) {
    if (group.multi) {
      selection[group.key] = [];
    } else {
      const choice = group.choices[group.defaultIndex] ?? group.choices[0];
      selection[group.key] = choice ? [choice.label] : [];
    }
  }
  return selection;
}

/** Unit price is the base plus every selected choice's delta. */
export function unitPriceFor(
  baseCents: number,
  groups: readonly OptionGroup[],
  selection: Selection,
): number {
  let total = baseCents;
  for (const group of groups) {
    for (const label of selection[group.key] ?? []) {
      const choice = group.choices.find((candidate) => candidate.label === label);
      if (choice) total += choice.deltaCents;
    }
  }
  return total;
}

export function toSelectedOptions(
  groups: readonly OptionGroup[],
  selection: Selection,
): SelectedOption[] {
  return groups
    .map((group) => ({
      groupKey: group.key,
      groupLabel: group.label,
      choices: selection[group.key] ?? [],
    }))
    .filter((option) => option.choices.length > 0);
}

/**
 * Applies one option choice to a selection.
 *
 * A multi group toggles. A single group replaces. The one rule with teeth is
 * Half and Half: its two sauce groups may never hold the same sauce, so
 * choosing a sauce the other half already holds moves that half to the first
 * sauce still free, rather than quietly accepting one flavour on both halves.
 */
export function chooseOption(
  groups: readonly OptionGroup[],
  selection: Selection,
  group: OptionGroup,
  label: string,
): Selection {
  if (group.multi) {
    const chosen = selection[group.key] ?? [];
    return {
      ...selection,
      [group.key]: chosen.includes(label)
        ? chosen.filter((candidate) => candidate !== label)
        : [...chosen, label],
    };
  }

  const next: Selection = { ...selection, [group.key]: [label] };

  const exclusive = EXCLUSIVE_SAUCE_GROUPS as readonly string[];
  if (exclusive.includes(group.key)) {
    const otherKey = exclusive.find((key) => key !== group.key);
    const otherGroup = otherKey ? groups.find((candidate) => candidate.key === otherKey) : undefined;
    if (otherKey && otherGroup && next[otherKey]?.[0] === label) {
      const free = otherGroup.choices.find((choice) => choice.label !== label);
      if (free) next[otherKey] = [free.label];
    }
  }

  return next;
}

/**
 * Two lines merge only when they are the same product with the same options, so
 * a whole bird with cheese dust never absorbs a half bird without it.
 */
export function lineKey(slug: string, options: readonly SelectedOption[]): string {
  const canonical = options
    .map((option) => `${option.groupKey}:${[...option.choices].sort().join('|')}`)
    .sort()
    .join(';');
  return `${slug}::${canonical}`;
}

/** The one-line summary of a line's options, shown under its name. */
export function describeOptions(options: readonly SelectedOption[]): string {
  return options.flatMap((option) => option.choices).join(' · ');
}

export type CartLine = OrderLine;
