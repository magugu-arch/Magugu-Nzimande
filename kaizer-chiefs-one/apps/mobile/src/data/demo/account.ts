import {
  memberAccountSchema,
  ok,
  productSchema,
  rewardSchema,
  ticketSummarySchema,
  unavailable,
  type CommerceProvider,
  type MembershipProvider,
  type Product,
  type Reward,
  type RewardsProvider,
  type TicketProvider,
  type TicketSummary,
} from '@kc-one/contracts';
import { demoProvenance, latency } from './common';

/**
 * Membership in demo mode: the account shell only. The contract forbids a
 * demo account from claiming verified status, and there are no entitlements.
 */
export const demoMembership: MembershipProvider = {
  async getMember() {
    const m = memberAccountSchema.parse({
      verificationState: 'not_linked',
      memberNumberLast4: null,
      tier: null,
      validUntil: null,
      renewalUrl: null,
      provenance: demoProvenance(),
    });
    return latency(ok(m, m.provenance));
  },
  async getEntitlements() {
    return latency(
      unavailable(
        'integration_pending',
        'Benefits appear here once your membership is verified by the club’s membership system.',
      ),
    );
  },
};

/**
 * One DEMO ticket, to show the wallet layout. Its detail screen never shows
 * a scannable code: getSecureTicket refuses in demo mode.
 */
const demoTicket: TicketSummary = ticketSummarySchema.parse({
  id: 'demo-ticket-1',
  providerRef: 'DEMO',
  fixtureId: 'demo-fx-1',
  eventName: 'Kaizer Chiefs v Opponent A',
  eventStart: null,
  seat: { gate: null, block: null, row: null, seat: null },
  status: 'active',
  provenance: demoProvenance('demo-ticket-1'),
});

export const demoTickets: TicketProvider = {
  async listTickets() {
    return latency(ok([demoTicket], demoProvenance()));
  },
  async getSecureTicket() {
    return latency(
      unavailable(
        'demo_restricted',
        'Entry codes come only from the official ticketing provider, at the gate. This demo ticket is not valid for entry.',
      ),
    );
  },
};

const rewardTerms =
  'Sample terms. Real eligibility, points values and partner conditions come from the Khosi Rewards programme once it is connected.';

const rewards: Reward[] = (
  [
    [
      'demo-rw-1',
      'Matchday experience',
      'experience',
      'fanCam',
      'A sample of how a matchday experience reward could be presented.',
    ],
    [
      'demo-rw-2',
      'Retail voucher',
      'merchandise',
      'merchandise',
      'A sample retail reward for the official store.',
    ],
    ['demo-rw-3', 'Stadium tour', 'experience', 'stadium', 'A sample behind-the-scenes reward.'],
    [
      'demo-rw-4',
      'Community day',
      'community',
      'community',
      'A sample reward that gives back to the community.',
    ],
  ] as const
).map(([id, title, category, imageKey, summary]) =>
  rewardSchema.parse({
    id,
    title,
    summary,
    category,
    imageKey,
    pointsCost: null,
    eligibility: [
      'Registered supporter (sample rule)',
      'Verified member for some rewards (sample rule)',
    ],
    terms: rewardTerms,
    partnerName: null,
    provenance: demoProvenance(id),
  }),
);

export const demoRewards: RewardsProvider = {
  async getWallet() {
    return latency(
      unavailable(
        'integration_pending',
        'Your points balance comes from the Khosi Rewards programme. There is no demo balance.',
      ),
    );
  },
  async listRewards() {
    return latency(ok(rewards, demoProvenance()));
  },
  async redeem() {
    return latency(
      unavailable(
        'demo_restricted',
        'Nothing was redeemed. Redemption needs the Khosi Rewards provider.',
      ),
    );
  },
};

export function findDemoReward(id: string) {
  return rewards.find((r) => r.id === id) ?? null;
}

const products: Product[] = (
  [
    ['demo-p-1', 'Home jersey', 'kit'],
    ['demo-p-2', 'Supporter scarf', 'accessories'],
    ['demo-p-3', 'Cap', 'lifestyle'],
    ['demo-p-4', 'Mug', 'gifts'],
    ['demo-p-5', 'Lanyard', 'accessories'],
    ['demo-p-6', 'Wristband', 'accessories'],
  ] as const
).map(([id, name, category]) =>
  productSchema.parse({
    id,
    name,
    category,
    imageKey: 'merchandise',
    priceText: null,
    productUrl: null,
    provenance: demoProvenance(id),
  }),
);

export const demoCommerce: CommerceProvider = {
  async getProducts() {
    return latency(ok(products, demoProvenance()));
  },
  async getProductLink() {
    return latency(
      unavailable(
        'integration_pending',
        'The official store link is added once the club confirms its shop.',
      ),
    );
  },
};
