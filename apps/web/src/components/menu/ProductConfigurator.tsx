'use client';

import { EXCLUSIVE_SAUCE_GROUPS } from '@bbq/seed';
import type { OptionGroup, ProductWithOptions } from '@bbq/types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useCartDrawer } from '@/components/cart/CartDrawerProvider';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { Button } from '@/components/ui/Button';
import { Price } from '@/components/ui/Price';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { defaultSelection, toSelectedOptions, unitPriceFor, type Selection } from '@/lib/cart';

/**
 * Picks the options for one product and puts it in the basket.
 *
 * The one rule with teeth is Half and Half: its two sauce groups may never hold
 * the same sauce, so choosing a sauce that is already picked in the other group
 * moves that other group along rather than silently accepting a bird with one
 * flavour on both halves.
 */
export function ProductConfigurator({ product }: { product: ProductWithOptions }) {
  const groups = product.optionGroups;
  const [selection, setSelection] = useState<Selection>(() => defaultSelection(groups));
  const [quantity, setQuantity] = useState(1);
  const { addLine } = useOrdering();
  const { open } = useCartDrawer();
  const router = useRouter();

  const unitCents = useMemo(
    () => unitPriceFor(product.priceCents, groups, selection),
    [product.priceCents, groups, selection],
  );

  function choose(group: OptionGroup, label: string) {
    setSelection((current) => {
      if (group.multi) {
        const chosen = current[group.key] ?? [];
        return {
          ...current,
          [group.key]: chosen.includes(label)
            ? chosen.filter((candidate) => candidate !== label)
            : [...chosen, label],
        };
      }

      const next: Selection = { ...current, [group.key]: [label] };

      const exclusive = EXCLUSIVE_SAUCE_GROUPS as readonly string[];
      if (exclusive.includes(group.key)) {
        const otherKey = exclusive.find((key) => key !== group.key);
        const otherGroup = otherKey ? groups.find((candidate) => candidate.key === otherKey) : null;
        if (otherKey && otherGroup && next[otherKey]?.[0] === label) {
          // The other half now holds the same sauce, so move it to the first
          // sauce that is still free.
          const free = otherGroup.choices.find((choice) => choice.label !== label);
          if (free) next[otherKey] = [free.label];
        }
      }

      return next;
    });
  }

  function addToBasket() {
    addLine({
      slug: product.slug,
      name: product.name,
      imageKey: product.imageKey,
      quantity,
      unitCents,
      options: toSelectedOptions(groups, selection),
    });
    open();
  }

  if (product.soldOut) {
    return (
      <div className="rounded-md border border-line bg-white p-6">
        <p className="display text-2xl text-black-60">Sold out today</p>
        <p className="mt-2 text-sm text-muted">
          This one has gone for the day. The kitchen restocks each morning.
        </p>
        <div className="mt-5">
          <Button variant="ghost" onClick={() => router.push('/menu')}>
            Back to the menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {groups.map((group) => (
        <fieldset key={group.key} className="mb-6">
          <legend className="mb-2.5 text-xs font-bold uppercase tracking-[0.1em] text-muted">
            {group.label}
            {group.multi && <span className="ml-2 font-semibold normal-case">Optional</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {group.choices.map((choice) => {
              const chosen = (selection[group.key] ?? []).includes(choice.label);
              return (
                <button
                  key={choice.label}
                  type="button"
                  onClick={() => choose(group, choice.label)}
                  aria-pressed={chosen}
                  className={[
                    'rounded-full border px-4 py-2.5 text-[13px] font-bold transition-colors',
                    chosen
                      ? 'border-red bg-red text-white'
                      : 'border-line bg-white hover:border-line-strong hover:bg-paper',
                  ].join(' ')}
                >
                  {choice.label}
                  {choice.deltaCents !== 0 && (
                    <span className={chosen ? 'ml-2 text-white/80' : 'ml-2 text-muted'}>
                      {choice.deltaCents > 0 ? '+' : '−'}
                      <Price cents={Math.abs(choice.deltaCents)} compact />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center gap-3 bg-white/95 px-1 py-4 backdrop-blur">
        <QuantityStepper
          quantity={quantity}
          onChange={(next) => setQuantity(Math.max(1, next))}
          label={product.name}
          removable={false}
        />
        <Button onClick={addToBasket} className="flex-1">
          Add to basket
          <span aria-hidden="true" className="opacity-70">
            ·
          </span>
          <Price cents={unitCents * quantity} />
        </Button>
      </div>
    </div>
  );
}
