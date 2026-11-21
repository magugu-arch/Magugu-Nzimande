import { tx, type Campaign, type Partner } from '@scarlets/domain';
import { officialLinks } from '../config';

/**
 * DEMO PARTNERS.
 *
 * No sponsor is invented. Each entry is a named SLOT that stands where an
 * approved partner will go, and says so. Every campaign carries a visible
 * placement label, and there is at most one per screen area.
 */

const slot = (
  id: string,
  name: string,
  category: [string, string],
  description: string,
): Partner => ({
  id,
  name,
  category: tx(category[0], category[1]),
  description: tx(description),
  approved: false,
  cta: null,
});

export const partnerSeed: Partner[] = [
  slot(
    'slot-principal',
    'Principal partner slot',
    ['Principal partner', 'Prif bartner'],
    'Reserved for the club’s approved principal partner: logo, description and one approved link.',
  ),
  slot(
    'slot-kit',
    'Kit partner slot',
    ['Kit and retail', 'Cit a manwerthu'],
    'Reserved for the approved kit and retail partner.',
  ),
  slot(
    'slot-matchday',
    'Matchday partner slot',
    ['Matchday experience', 'Profiad diwrnod gêm'],
    'Reserved for a partner that adds something to the day, such as a Fan Zone activation.',
  ),
  slot(
    'slot-community',
    'Community partner slot',
    ['Community', 'Cymuned'],
    'Reserved for a partner supporting community and pathway rugby.',
  ),
];

const SEASON = { startsAt: '2026-08-01T00:00:00Z', endsAt: '2027-06-30T00:00:00Z' };

export const campaignSeed: Campaign[] = [
  {
    id: 'cmp-home-reaction-wall',
    partnerId: 'slot-matchday',
    label: 'partner_feature',
    placement: 'home',
    title: tx('Beat the lights in the Fan Zone', 'Curwch y goleuadau ym Mharth y Cefnogwyr'),
    body: tx(
      'A sample partner activation: the reaction wall in the Supporters Village.',
      'Gweithgaredd partner enghreifftiol: y wal ymateb ym Mhentref y Cefnogwyr.',
    ),
    mediaId: 'fan-zone-activation',
    ...SEASON,
    cta: null,
    terms: null,
    priority: 10,
    demo: true,
  },
  {
    id: 'cmp-passport-offer',
    partnerId: 'slot-kit',
    label: 'partner_offer',
    placement: 'passport',
    title: tx('A member offer goes here', 'Mae cynnig i aelodau’n mynd yma'),
    body: tx(
      'Eligibility and how to redeem are supplied by the partner and shown in full before you use it.',
    ),
    mediaId: 'reward-redemption',
    ...SEASON,
    cta: null,
    // No terms supplied yet, so no redemption is offered.
    terms: null,
    priority: 10,
    demo: true,
  },
  {
    id: 'cmp-fanzone-fancam',
    partnerId: 'slot-matchday',
    label: 'sponsored',
    placement: 'fan_zone',
    title: tx('Fan Cam on the big screen', 'Camera’r Cefnogwyr ar y sgrin fawr'),
    body: tx('A sample sponsored Fan Cam moment.'),
    mediaId: 'big-screen-celebration',
    ...SEASON,
    cta: null,
    terms: null,
    priority: 10,
    demo: true,
  },
  {
    id: 'cmp-matchday-hospitality',
    partnerId: 'slot-principal',
    label: 'partner_feature',
    placement: 'matchday',
    title: tx('Make a day of it', 'Gwnewch ddiwrnod ohoni'),
    body: tx('Hospitality packages for partners and guests.'),
    mediaId: 'partner-hospitality',
    ...SEASON,
    cta: { label: officialLinks.hospitality.label, url: officialLinks.hospitality.url },
    terms: null,
    priority: 10,
    demo: true,
  },
  {
    id: 'cmp-shop',
    partnerId: 'slot-kit',
    label: 'official_shop',
    placement: 'partner_world',
    title: tx('Official club shop', 'Siop swyddogol y clwb'),
    body: tx('Opens the club’s official store. Prices and stock are shown there, not here.'),
    mediaId: 'shirt-reference',
    ...SEASON,
    cta: { label: officialLinks.shop.label, url: officialLinks.shop.url },
    terms: null,
    priority: 10,
    demo: true,
  },
];
