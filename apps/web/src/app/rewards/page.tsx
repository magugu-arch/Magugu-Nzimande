import { REWARDS_RULES } from '@bbq/seed';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ButtonLink } from '@/components/ui/Button';
import { DemoFlag, DemoNotice } from '@/components/ui/DemoValue';
import { api } from '@/lib/api';
import { RewardsBalance } from '@/components/rewards/RewardsBalance';
import { currentAccountFromCookies } from '@/lib/accounts/session';

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
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {REWARDS_RULES.tiers.map((tier) => (
            <li key={tier.name} className="rounded-md border border-line bg-white p-5">
              <h3 className="display text-xl text-red">{tier.name}</h3>
              <p className="tabular mt-1 text-sm font-bold">
                {tier.from.toLocaleString('en-ZA')} points
              </p>
              <p className="mt-2 text-xs text-muted">
                {tier.from === 0
                  ? 'Where every account starts.'
                  : `Reached at ${tier.from.toLocaleString('en-ZA')} lifetime points.`}
              </p>
            </li>
          ))}
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
