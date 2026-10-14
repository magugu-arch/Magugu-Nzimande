import type { SocialAccount } from './types';

export const site = {
  name: 'Myron Golden',
  legalEntity: 'MG Ventures LLC',
  /** Draft positioning line — awaiting owner approval (brief §6, Home). */
  tagline: 'Business growth strategist, author and speaker',
  description:
    'Business growth, offer creation and sales strategy, taught on timeless principles. Free training, books, programs and speaking from Myron Golden.',
  /** Research snapshot the copy was checked against. */
  researchedOn: '2026-10-13',
} as const;

export interface NavItem {
  label: string;
  href: string;
}

/** Brief §5: Home | About | Work With Myron | Programs | Books | Learn | Events | Contact. */
export const primaryNav: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Work With Myron', href: '/work-with-myron' },
  { label: 'Programs', href: '/programs' },
  { label: 'Books', href: '/books' },
  { label: 'Learn', href: '/learn' },
  { label: 'Events', href: '/events' },
  { label: 'Contact', href: '/contact' },
];

export const primaryCta: NavItem = { label: 'Start here', href: '/work-with-myron' };

export const footerNav: { title: string; items: NavItem[] }[] = [
  {
    title: 'Explore',
    items: [
      { label: 'About Myron', href: '/about' },
      { label: 'Work With Myron', href: '/work-with-myron' },
      { label: 'Programs', href: '/programs' },
      { label: 'Books', href: '/books' },
    ],
  },
  {
    title: 'Learn',
    items: [
      { label: 'Free learning', href: '/learn' },
      { label: 'Insights', href: '/insights' },
      { label: 'Events', href: '/events' },
      { label: 'Speaking', href: '/speaking' },
    ],
  },
  {
    title: 'Support',
    items: [
      { label: 'Contact', href: '/contact' },
      { label: 'Press', href: '/press' },
      { label: 'Member login', href: '/login' },
      { label: 'Search', href: '/search' },
    ],
  },
  {
    title: 'Legal',
    items: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      { label: 'Cookies', href: '/cookies' },
      { label: 'Refunds', href: '/refunds' },
      { label: 'Disclosures', href: '/disclosures' },
    ],
  },
];

/**
 * Social accounts. Only `verified` ones are rendered. TikTok was confirmed by
 * the requester on 13 October 2026; @onlymanifested and any other handle from
 * third-party link hubs must not be substituted (brief §3).
 */
export const socialAccounts: SocialAccount[] = [
  {
    platform: 'TikTok',
    handle: '@myrongoldenofficial',
    url: 'https://www.tiktok.com/@myrongoldenofficial',
    verified: true,
    verifiedBy: 'Requester confirmation',
    verifiedOn: '2026-10-13',
  },
  {
    platform: 'YouTube',
    handle: null,
    url: null,
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
  },
  {
    platform: 'Instagram',
    handle: null,
    url: null,
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
  },
  {
    platform: 'Facebook',
    handle: null,
    url: null,
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
  },
  { platform: 'X', handle: null, url: null, verified: false, verifiedBy: null, verifiedOn: null },
  {
    platform: 'LinkedIn',
    handle: null,
    url: null,
    verified: false,
    verifiedBy: null,
    verifiedOn: null,
  },
];

export const verifiedSocials = socialAccounts.filter(
  (s): s is SocialAccount & { url: string; handle: string } => s.verified && !!s.url && !!s.handle,
);

/** Official destinations from the brief's research register (§16). */
export const official = {
  home: 'https://myrongolden.com/',
  about: 'https://myrongolden.com/mg-or-about',
  vipDay: 'https://myrongolden.com/mg-or-vip-day-w-myron',
  kingSolomonsCourt: 'https://myrongolden.com/mg-or-king-s-solomon-s-court',
  makeMoreOffers: 'https://www.makemoreofferschallenge.com/',
  bossMoves: 'https://www.bossmovesbook.com/',
  trashManCashMan: 'https://www.trashmantocashman.com/',
  returnPolicy: 'https://myrongolden.com/mg-or-return-policy',
  terms: 'https://myrongolden.com/mg-or-terms-and-use',
} as const;

/**
 * Where each kind of message goes. Inbox addresses are deliberately absent:
 * the team supplies them, and until then forms deliver to the webhook in
 * ENQUIRY_WEBHOOK_URL (or, in preview, are only logged).
 */
export const contactRoutes = [
  {
    id: 'support',
    title: 'Customer support',
    body: 'Questions about a purchase, a program you are enrolled in, or access to course material.',
  },
  {
    id: 'speaking',
    title: 'Speaking and events',
    body: 'Invite Myron to keynote, teach or join a conversation at your event.',
  },
  {
    id: 'partnership',
    title: 'Partnerships',
    body: 'Collaborations, affiliate questions and business proposals.',
  },
  {
    id: 'press',
    title: 'Press and media',
    body: 'Interviews, approved biographies and photography for publication.',
  },
  {
    id: 'general',
    title: 'Something else',
    body: 'Anything that does not fit above. The team will route it to the right person.',
  },
] as const;

export type ContactRouteId = (typeof contactRoutes)[number]['id'];
