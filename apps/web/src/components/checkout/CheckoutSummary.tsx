'use client';

import { FoodImage } from '@/components/food/FoodImage';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { DemoFlag } from '@/components/ui/DemoValue';
import { Price } from '@/components/ui/Price';
import { describeOptions } from '@/lib/cart';

export function CheckoutSummary() {
  const { lines, totals, mode, promoCode, store } = useOrdering();

  return (
    <aside className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-md border border-line bg-white p-5">
        <h2 className="display text-xl">Your order</h2>
        <p className="mt-1 text-xs text-muted">
          {mode} from {store.name}
        </p>

        <ul className="mt-4 divide-y divide-line border-y border-line">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-3 py-3">
              <div className="size-12 shrink-0 overflow-hidden rounded-xs bg-paper">
                <FoodImage
                  imageKey={line.imageKey}
                  alt=""
                  sizes="48px"
                  className="size-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold">
                  <span className="tabular">{line.quantity}&times;</span> {line.name}
                </p>
                {line.options.length > 0 && (
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {describeOptions(line.options)}
                  </p>
                )}
              </div>
              <Price cents={line.unitCents * line.quantity} className="text-xs font-bold" />
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd>
              <Price cents={totals.subtotalCents} />
            </dd>
          </div>
          {totals.discountCents > 0 && (
            <div className="flex justify-between text-red">
              <dt className="font-semibold">Discount ({promoCode})</dt>
              <dd className="font-semibold">
                &minus;<Price cents={totals.discountCents} />
              </dd>
            </div>
          )}
          {mode === 'Delivery' && (
            <div className="flex justify-between">
              <dt className="flex items-center text-muted">
                Delivery
                <DemoFlag />
              </dt>
              <dd>
                {totals.deliveryCents === 0 ? (
                  <span className="font-bold text-red">Free</span>
                ) : (
                  <Price cents={totals.deliveryCents} />
                )}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2.5 text-base font-extrabold">
            <dt>Total</dt>
            <dd>
              <Price cents={totals.totalCents} />
            </dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}
