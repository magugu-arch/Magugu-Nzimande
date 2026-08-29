'use client';

import type { Reward } from '@bbq/types';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { pointsFor } from '@/lib/pricing';

/**
 * The points balance, built from orders actually placed in this browser rather
 * than a seeded number, so the ladder moves as the journey is walked through.
 */
export function RewardsBalance({ rewards }: { rewards: readonly Reward[] }) {
  const { orders, hydrated } = useOrdering();

  const points = hydrated
    ? orders
        .filter((order) => order.status === 'completed')
        .reduce((total, order) => total + pointsFor(order.totals.totalCents), 0)
    : 0;

  const pending = hydrated
    ? orders
        .filter((order) => order.status !== 'completed' && order.status !== 'cancelled')
        .reduce((total, order) => total + pointsFor(order.totals.totalCents), 0)
    : 0;

  return (
    <>
      <div className="mt-8 rounded-lg bg-black p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gold">Your balance</p>
        <p className="tabular display mt-2 text-6xl">{points.toLocaleString('en-ZA')}</p>
        <p className="mt-1 text-sm text-white/60">
          points
          {pending > 0 && ` · ${pending.toLocaleString('en-ZA')} pending on orders in progress`}
        </p>
        {points === 0 && pending === 0 && (
          <p className="mt-4 max-w-[46ch] text-sm text-white/70">
            Nothing yet. Points post when an order reaches its last step, so place one and watch
            it land here.
          </p>
        )}
      </div>

      <section className="mt-10">
        <h2 className="display text-2xl">Spend them on</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rewards.map((reward) => {
            const reached = points >= reward.points;
            const progress = Math.min(100, Math.round((points / reward.points) * 100));
            return (
              <li
                key={reward.id}
                className={[
                  'rounded-md border bg-white p-5',
                  reached ? 'border-red' : 'border-line',
                ].join(' ')}
              >
                <h3 className="text-sm font-extrabold">{reward.name}</h3>
                <p className="tabular mt-1 text-sm font-bold text-red">
                  {reward.points.toLocaleString('en-ZA')} points
                </p>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-black-20"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progress towards ${reward.name}`}
                >
                  <div className="h-full rounded-full bg-red" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {reached
                    ? 'Ready to redeem in store'
                    : `${(reward.points - points).toLocaleString('en-ZA')} points to go`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
