import type { Route } from 'next';
import { activities } from './catalog';

export type NavLink = { href: Route; label: string };

/** Desktop header, left to right. "Book your jump" sits apart as the one primary action. */
export const primaryNav: NavLink[] = [
  { href: '/adventures', label: 'Adventures' },
  { href: '/groups', label: 'Groups' },
  { href: '/events', label: 'Events' },
  { href: '/restaurant', label: 'Restaurant' },
  { href: '/gift', label: 'Gift a Jump' },
  { href: '/visit', label: 'Plan your visit' },
];

export const secondaryNav: NavLink[] = [
  { href: '/safety', label: 'Safety' },
  { href: '/faq', label: 'FAQ' },
  { href: '/find-my-jump', label: 'Find my jump' },
  { href: '/journal', label: 'Journal' },
  { href: '/about', label: 'About & crew' },
  { href: '/partners', label: 'Partner with us' },
  { href: '/contact', label: 'Contact' },
];

export const footerColumns: { title: string; links: NavLink[] }[] = [
  {
    title: 'Adventures',
    // Straight from the catalog, so a new adventure appears in the footer automatically.
    links: activities.map((a) => ({ href: `/adventures/${a.id}` as Route, label: a.name })),
  },
  {
    title: 'Plan',
    links: [
      { href: '/book', label: 'Book your jump' },
      { href: '/gift', label: 'Gift a Jump vouchers' },
      { href: '/visit', label: 'Hours & getting here' },
      { href: '/safety', label: 'Safety' },
      { href: '/faq', label: 'FAQ' },
      { href: '/restaurant', label: 'Restaurant' },
      { href: '/events', label: 'Events' },
    ],
  },
  {
    title: 'Soweto Towers',
    links: [
      { href: '/groups', label: 'Groups & team days' },
      { href: '/partners', label: 'Partner with us' },
      { href: '/about', label: 'About & crew' },
      { href: '/journal', label: 'Journal' },
      { href: '/find-my-jump', label: 'Find my jump' },
      { href: '/contact', label: 'Contact' },
    ],
  },
];

export const legalNav: NavLink[] = [
  { href: '/legal/terms', label: 'Terms' },
  { href: '/legal/privacy', label: 'Privacy (POPIA)' },
  { href: '/legal/indemnity', label: 'Indemnity' },
];
