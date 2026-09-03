import { REWARDS_RULES } from '@bbq/seed';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ButtonLink } from '@/components/ui/Button';
import { DemoFlag, DemoNotice } from '@/components/ui/DemoValue';
import { api } from '@/lib/api';
import { RewardsBalance } from '@/components/rewards/RewardsBalance';
import { currentAccountFromCookies } from '@/lib/accounts/session';
import { tierFor } from '@/lib/rewards';

/**
 * Rendered per request, so a signed-in customer sees their own balance.
 *
 * The page was prerendered and the balance was counted in the browser, which
 * meant the number under "your balance" was whatever orders that device
 * remembered — zero on a phone they had not ordered from, and a different
 * figure from the one on their account page.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rewards',
  description: 'Earn a point for every rand spent, on delivery, collection and dine-in.',
};

export default async function RewardsPage() {
  const { rewards } = api.getRewards();
  const account = await currentAccountFromCookies(cookies);
  // Only for a signed-in customer: a guest's balance is this browser's, and a
  // tier that changes with the device is not a tier.
  const standing = account ? tierFor(account.points) : null;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-10">
      <p className="display inline-flex items-center gap-2.5 text-sm tracking-[0.16em] text-red">
        <span aria-hidden="true" className="block h-0.5 w-5 bg-red" />
        bb.q Rewards
      </p>
      <h1 className="display mt-2 text-[clamp(2.1rem,5vw,3.4rem)]">
        Every rand earns a point
      </h1>
      <p className="mt-3 flex max-w-[56ch] items-start text-sm text-muted">
        <span>
          Points post once your order is completed, on every fulfilment mode, and can be spent on
          anything you have reached.
        </span>
        <DemoFlag />
      </p>

      <RewardsBalance rewards={rewards} accountPoints={account?.points ?? null} />

      <section className="mt-12">
        <h2 className="display text-2xl">Tiers</h2>
        {/*
          The ladder used to be shown with no "you are here" on it, and the
          account page showed a number with no ladder. Marked only for somebody
          signed in: a guest's balance lives in one browser, and telling them
          they are Silver on this phone and Bronze on the next one is worse than
          not saying.
        */}
        {standing && (
          <p className="mt-1 text-sm text-muted">
            You are on <span className="font-bold text-black">{standing.current.name}</span>
            {standing.next
              ? ` — ${standing.toNext.toLocaleString('en-ZA')} points to ${standing.next.name}.`
              : ', the top of the ladder.'}
          </p>
        )}
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {REWARDS_RULES.tiers.map((tier) => {
            const reached = standing?.current.name === tier.name;
            return (
              <li
                key={tier.name}
                aria-current={reached ? 'true' : undefined}
                className={[
                  'rounded-md border bg-white p-5',
                  reached ? 'border-red' : 'border-line',
                ].join(' ')}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="display text-xl text-red">{tier.name}</h3>
                  {reached && (
                    <span className="rounded-full bg-red px-2.5 py-1 text-[11px] font-bold text-white">
                      You
                    </span>
                  )}
                </div>
                <p className="tabular mt-1 text-sm font-bold">
                  {tier.from.toLocaleString('en-ZA')} points
                </p>
                <p className="mt-2 text-xs text-muted">
                  {tier.from === 0
                    ? 'Where every account starts.'
                    : `Reached at ${tier.from.toLocaleString('en-ZA')} lifetime points.`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-10 rounded-md border border-line bg-white p-5">
        <DemoNotice className="max-w-3xl" />
      </div>

      <div className="mt-8">
        <ButtonLink href="/menu">Start earning</ButtonLink>
      </div>
    </div>
  );
}
