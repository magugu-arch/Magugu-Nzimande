import { FEES } from '@bbq/seed';
import { DemoFlag } from '@/components/ui/DemoValue';
import { Price } from '@/components/ui/Price';

/** How much further the basket has to go before delivery stops being charged. */
export function FreeDeliveryMeter({
  remainingCents,
  subtotalAfterDiscountCents,
}: {
  remainingCents: number;
  subtotalAfterDiscountCents: number;
}) {
  const cleared = remainingCents === 0;
  const progress = Math.min(
    100,
    Math.round((subtotalAfterDiscountCents / FEES.freeDeliveryOverCents) * 100),
  );

  return (
    <div className="mt-4 rounded-sm bg-paper p-3">
      <p className="flex items-center text-xs font-semibold">
        {cleared ? (
          <span className="text-red">Delivery is on us.</span>
        ) : (
          <span>
            <Price cents={remainingCents} compact className="font-bold text-red" /> more for free
            delivery
          </span>
        )}
        <DemoFlag />
      </p>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-black-20"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progress towards free delivery"
      >
        <div
          className="h-full rounded-full bg-red transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
