'use client';

import type { Reward } from '@bbq/types';
import { useOrdering } from '@/components/ordering/OrderingProvider';
import { pointsFor } from '@/lib/pricing';

/**
 * The points balance.
 *
 * Two sources, and which one is right depends on whether there is an account.
 *
 * It used to count this browser's completed orders and call the result "your
 * balance", while the account page showed the number the server keeps. For a
 * signed-in customer those disagree — and on a phone they have not ordered
 * from, the browser's answer is zero under a heading promising every rand earns
 * a point. So a signed-in customer is shown their account, and a guest is shown
 * this device with the label saying so.
 *
 * @param accountPoints The signed-in balance, or null for a guest.
 */
export function RewardsBalance({
  rewards,
  accountPoints = null,
}: {
  rewards: readonly Reward[];
  accountPoints?: number | null;
}) {
  const { orders, hydrated } = useOrdering();
  const signedIn = accountPoints !== null;

  const onThisDevice = hydrated
    ? orders
        .filter((order) => order.status === 'completed')
        .reduce((total, order) => total + pointsFor(order.totals.totalCents), 0)
    : 0;

  const points = signedIn ? accountPoints : onThisDevice;

  /**
   * Orders still being made. Only ever this browser's: the server knows a
   * signed-in customer's outstanding orders too, but a number that mixed one
   * device's pending with the account's posted would be a third figure
   * agreeing with neither.
   */
  const pending = hydrated
    ? orders
        .filter((order) => order.status !== 'completed' && order.status !== 'cancelled')
        .reduce((total, order) => total + pointsFor(order.totals.totalCents), 0)
    : 0;

  return (
    <>
      <div className="mt-8 rounded-lg bg-black p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gold">
          {signedIn ? 'Your balance' : 'On this device'}
        </p>
        <p className="tabular display mt-2 text-6xl">{points.toLocaleString('en-ZA')}</p>
        <p className="mt-1 text-sm text-white/60">
          points
          {pending > 0 && ` · ${pending.toLocaleString('en-ZA')} pending on orders in progress`}
        </p>
        {!signedIn && (
          <p className="mt-4 max-w-[46ch] text-sm text-white/70">
            These are the orders this browser remembers.{' '}
            <a href="/account" className="underline">
              Sign in
            </a>{' '}
            and your points follow you to any phone.
          </p>
        )}
        {signedIn && points === 0 && pending === 0 && (
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
