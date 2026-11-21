import {
  tx,
  type Benefit,
  type Mission,
  type Programme,
  type RewardTransaction,
} from '@scarlets/domain';

/**
 * DEMO PASSPORT.
 *
 * What is confirmed: the club's 2026/27 season-ticket page announces YMLAEN
 * as a rewards scheme for members, partners and season-ticket holders, and
 * lists the season-ticket benefits named below. It says more detail is to
 * come.
 *
 * What is not: point values, tiers, earning rules, expiry, the rewards
 * catalogue and who is eligible for what. None of those appear anywhere in
 * this seed. There are no numbers here on purpose.
 */

export const programmeSeed: Programme = {
  name: 'YMLAEN',
  status: 'announced',
  rulesPublished: false,
  balance: null,
  tier: null,
  statement: tx(
    'YMLAEN is the rewards scheme the club has announced for 2026/27, for members, partners and season-ticket holders. Points, tiers and rewards will appear here once the club publishes how the programme works.',
    'YMLAEN yw’r cynllun gwobrwyo y mae’r clwb wedi’i gyhoeddi ar gyfer 2026/27, i aelodau, partneriaid a deiliaid tocynnau tymor. Bydd pwyntiau, haenau a gwobrau’n ymddangos yma pan fydd y clwb yn cyhoeddi sut mae’r rhaglen yn gweithio.',
  ),
};

const PUBLISHED = tx(
  'Listed on the club’s 2026/27 season-ticket page. How to use it appears here once the club supplies the terms.',
  'Wedi’i restru ar dudalen tocynnau tymor 2026/27 y clwb. Bydd sut i’w ddefnyddio’n ymddangos yma pan fydd y clwb yn darparu’r telerau.',
);

const benefitOf = (id: string, icon: string, en: string, cy: string): Benefit => ({
  id,
  icon,
  title: tx(en, cy),
  detail: PUBLISHED,
  source: 'club_published',
  terms: 'awaiting_terms',
  redemption: 'not_available_yet',
});

export const benefitSeed: Benefit[] = [
  benefitOf(
    'home-matches',
    'ticket-outline',
    'Home URC and European pool matches',
    'Gemau cartref URC a grwpiau Ewrop',
  ),
  benefitOf(
    'knockout-priority',
    'trophy-outline',
    'Priority access to knockout tickets',
    'Blaenoriaeth ar gyfer tocynnau rowndiau terfynol',
  ),
  benefitOf(
    'age-grade',
    'people-outline',
    'Age-grade match access',
    'Mynediad i gemau graddau oedran',
  ),
  benefitOf('open-training', 'eye-outline', 'Open training sessions', 'Sesiynau hyfforddi agored'),
  benefitOf(
    'food-drink',
    'restaurant-outline',
    'Food and beverage discounts',
    'Gostyngiadau bwyd a diod',
  ),
  benefitOf(
    'friends-family',
    'heart-outline',
    'Selected friends and family discounts',
    'Gostyngiadau dethol i ffrindiau a theulu',
  ),
  benefitOf('vx3', 'shirt-outline', 'VX3 discount', 'Gostyngiad VX3'),
  benefitOf('crys16', 'ribbon-outline', 'Crys16 membership', 'Aelodaeth Crys16'),
];

const AWAITING_RULES = 'proposed' as const;

export const missionSeed: Mission[] = [
  {
    id: 'attend',
    icon: 'walk-outline',
    title: tx('Attend a home match', 'Mynychu gêm gartref'),
    detail: tx('Recognised when your ticket is scanned at the ground.'),
    verification: tx('Verified by the ticketing provider’s entry scan.'),
    status: AWAITING_RULES,
  },
  {
    id: 'survey',
    icon: 'chatbox-ellipses-outline',
    title: tx('Complete a supporter survey', 'Cwblhau arolwg cefnogwyr'),
    detail: tx('Tell the club how matchday was.'),
    verification: tx('Verified when a club-issued survey is submitted.'),
    status: AWAITING_RULES,
  },
  {
    id: 'community',
    icon: 'hand-left-outline',
    title: tx('Join a club community activity', 'Ymuno â gweithgaredd cymunedol y clwb'),
    detail: tx('Camps, events and volunteering count once the club confirms them.'),
    verification: tx('Verified by the organising team.'),
    status: AWAITING_RULES,
  },
  {
    id: 'official-channel',
    icon: 'bag-handle-outline',
    title: tx('Buy through an official channel', 'Prynu drwy sianel swyddogol'),
    detail: tx('Tickets and retail bought through tracked official journeys.'),
    verification: tx('Verified by the ticketing or commerce provider.'),
    status: AWAITING_RULES,
  },
];

/**
 * Sample history showing each status the ledger can hold. Amounts are null:
 * only the rewards provider can supply one.
 */
export const historySeed: RewardTransaction[] = [
  {
    id: 'txn-1',
    providerTxnId: 'demo-0001',
    type: 'pending',
    title: tx('Home match attendance', 'Presenoldeb mewn gêm gartref'),
    amount: null,
    occurredAt: '2026-11-14T17:10:00Z',
    reference: 'Awaiting provider verification',
  },
  {
    id: 'txn-2',
    providerTxnId: 'demo-0002',
    type: 'earned',
    title: tx('Supporter survey completed', 'Arolwg cefnogwyr wedi’i gwblhau'),
    amount: null,
    occurredAt: '2026-11-03T09:30:00Z',
    reference: null,
  },
  {
    id: 'txn-3',
    providerTxnId: 'demo-0003',
    type: 'redeemed',
    title: tx('Partner offer redeemed', 'Cynnig partner wedi’i ddefnyddio'),
    amount: null,
    occurredAt: '2026-10-31T13:05:00Z',
    reference: 'Redeemed in person',
  },
  {
    id: 'txn-4',
    providerTxnId: 'demo-0004',
    type: 'expired',
    title: tx('Offer expired unused', 'Cynnig wedi dod i ben heb ei ddefnyddio'),
    amount: null,
    occurredAt: '2026-10-20T23:59:00Z',
    reference: null,
  },
  {
    id: 'txn-5',
    providerTxnId: 'demo-0005',
    type: 'reversed',
    title: tx('Duplicate entry reversed', 'Cofnod dyblyg wedi’i wrthdroi'),
    amount: null,
    occurredAt: '2026-10-12T11:20:00Z',
    reference: 'Corrected by the provider',
  },
];
