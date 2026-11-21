import { tx, type LocalizedText } from '@scarlets/domain';

export const OFFICIAL_SITE = 'https://www.scarlets.wales/';

export interface Destination {
  url: string;
  label: LocalizedText;
  /**
   * True for the four pages named in the product brief (checked 21 November
   * 2026). False where the club still has to supply the exact destination;
   * those open the official site's front page and say so.
   */
  confirmed: boolean;
}

/**
 * Every outbound destination in one place, so the club can repoint any of
 * them without touching a screen. Nothing here is scraped or fetched.
 */
export const officialLinks = {
  site: { url: OFFICIAL_SITE, label: tx('scarlets.wales', 'scarlets.wales'), confirmed: true },
  tickets: {
    url: 'https://www.scarlets.wales/tickets-ticket-information/',
    label: tx('Official ticket information', 'Gwybodaeth swyddogol am docynnau'),
    confirmed: true,
  },
  seasonTickets: {
    url: 'https://www.scarlets.wales/seasontickets/',
    label: tx('Season tickets 2026/27', 'Tocynnau tymor 2026/27'),
    confirmed: true,
  },
  fixtures: {
    url: 'https://www.scarlets.wales/fixtures/',
    label: tx('Official fixtures and results', 'Gemau a chanlyniadau swyddogol'),
    confirmed: true,
  },
  rugby: {
    url: 'https://www.scarlets.wales/rugby/',
    label: tx('Squads and pathway', 'Carfanau a llwybr'),
    confirmed: true,
  },
  travel: { url: OFFICIAL_SITE, label: tx('Official travel guidance'), confirmed: false },
  accessibility: {
    url: OFFICIAL_SITE,
    label: tx('Official accessibility information'),
    confirmed: false,
  },
  hospitality: {
    url: OFFICIAL_SITE,
    label: tx('Official hospitality enquiries'),
    confirmed: false,
  },
  shop: { url: OFFICIAL_SITE, label: tx('Official club shop'), confirmed: false },
  media: { url: OFFICIAL_SITE, label: tx('Official video and audio channels'), confirmed: false },
  community: { url: OFFICIAL_SITE, label: tx('Community and foundation'), confirmed: false },
  contact: { url: OFFICIAL_SITE, label: tx('Contact the club'), confirmed: false },
  privacy: { url: OFFICIAL_SITE, label: tx('Privacy notice'), confirmed: false },
} as const satisfies Record<string, Destination>;

export type OfficialLinkId = keyof typeof officialLinks;

/**
 * Configuration gates. Each integration stays on its mock until the named
 * owner supplies what is listed. Nothing moves to "configured" on assumption:
 * an integration is only live once tested against an authorised sandbox.
 */
export interface IntegrationGate {
  id: string;
  provider: string;
  status: 'mock' | 'configured';
  owner: string;
  needs: string[];
}

export const integrationGates: IntegrationGate[] = [
  {
    id: 'ticketing',
    provider: 'TicketingProvider',
    status: 'mock',
    owner: 'Club ticketing lead and ticketing vendor',
    needs: [
      'Approved deep links or SDK',
      'SSO or account-link model',
      'Attribution reporting terms',
    ],
  },
  {
    id: 'fixtures',
    provider: 'FixturesProvider',
    status: 'mock',
    owner: 'Club rugby operations',
    needs: ['Approved fixtures feed', 'Competition and venue identifiers', 'Update cadence'],
  },
  {
    id: 'live_match',
    provider: 'LiveMatchProvider',
    status: 'mock',
    owner: 'Club rugby operations and data provider',
    needs: [
      'Licensed live data contract',
      'Redistribution rights for mobile',
      'Attribution wording',
    ],
  },
  {
    id: 'cms',
    provider: 'CMSProvider',
    status: 'mock',
    owner: 'Digital and editorial lead',
    needs: [
      'Content system of record',
      'Welsh and English workflow',
      'Correction and takedown SLA',
    ],
  },
  {
    id: 'membership',
    provider: 'MembershipProvider',
    status: 'mock',
    owner: 'Ticketing and membership operations',
    needs: ['Member identity matching', 'Eligibility source', 'Renewal dates'],
  },
  {
    id: 'rewards',
    provider: 'RewardsProvider',
    status: 'mock',
    owner: 'YMLAEN programme owner',
    needs: ['Programme rules and terms', 'Rewards API', 'Fraud controls and support process'],
  },
  {
    id: 'commerce',
    provider: 'CommerceProvider',
    status: 'mock',
    owner: 'Commercial lead',
    needs: ['Store platform and approved links', 'Stock and price source'],
  },
  {
    id: 'hospitality',
    provider: 'HospitalityProvider',
    status: 'mock',
    owner: 'Commercial lead',
    needs: ['Approved packages', 'Enquiry or booking destination'],
  },
  {
    id: 'notifications',
    provider: 'NotificationProvider',
    status: 'mock',
    owner: 'Digital lead and data protection officer',
    needs: ['APNs and FCM credentials', 'Consent model', 'Frequency caps'],
  },
  {
    id: 'venue',
    provider: 'VenueProvider',
    status: 'mock',
    owner: 'Stadium operations and accessibility representative',
    needs: [
      'Approved venue map',
      'Step-free routes',
      'Disabled supporters policy',
      'Facility list',
    ],
  },
];
