import { topics } from '@/content/taxonomy';
import { getBooks, getContent, getEvents, getPrograms } from './content';
import { contentHref } from './links';
import type { SearchDoc } from './search';

const pages: SearchDoc[] = [
  {
    id: 'p-about',
    kind: 'Page',
    title: 'About Myron Golden',
    href: '/about',
    summary: 'His story, teaching pillars and portraits.',
    keywords: ['biography', 'bio', 'story', 'faith', 'polio'],
  },
  {
    id: 'p-work',
    kind: 'Page',
    title: 'Work With Myron',
    href: '/work-with-myron',
    summary: 'Every way to learn from Myron, side by side.',
    keywords: ['start', 'coaching', 'mastermind', 'help'],
  },
  {
    id: 'p-programs',
    kind: 'Page',
    title: 'Programs',
    href: '/programs',
    summary: 'Challenges, coaching and mastermind programs.',
    keywords: ['courses', 'offers'],
  },
  {
    id: 'p-books',
    kind: 'Page',
    title: 'Books',
    href: '/books',
    summary: 'Books by Myron Golden.',
    keywords: ['read', 'buy'],
  },
  {
    id: 'p-learn',
    kind: 'Page',
    title: 'Free learning',
    href: '/learn',
    summary: 'Free videos, articles and resources.',
    keywords: ['training', 'videos', 'youtube', 'free'],
  },
  {
    id: 'p-insights',
    kind: 'Page',
    title: 'Insights',
    href: '/insights',
    summary: 'Articles on offers, sales and growth.',
    keywords: ['articles', 'blog'],
  },
  {
    id: 'p-events',
    kind: 'Page',
    title: 'Events',
    href: '/events',
    summary: 'Upcoming live teaching and workshops.',
    keywords: ['calendar', 'tickets', 'live'],
  },
  {
    id: 'p-speaking',
    kind: 'Page',
    title: 'Speaking',
    href: '/speaking',
    summary: 'Invite Myron to speak at your event.',
    keywords: ['keynote', 'booking', 'enquiry', 'conference'],
  },
  {
    id: 'p-press',
    kind: 'Page',
    title: 'Press kit',
    href: '/press',
    summary: 'Approved bios and press contact.',
    keywords: ['media', 'headshot', 'interview'],
  },
  {
    id: 'p-contact',
    kind: 'Page',
    title: 'Contact',
    href: '/contact',
    summary: 'Customer support, partnerships and general questions.',
    keywords: ['support', 'help', 'email', 'refund'],
  },
  {
    id: 'p-login',
    kind: 'Page',
    title: 'Member login',
    href: '/login',
    summary: 'Access your courses on the member platform.',
    keywords: ['account', 'sign in', 'course access'],
  },
  {
    id: 'p-privacy',
    kind: 'Page',
    title: 'Privacy Policy',
    href: '/privacy',
    summary: 'How personal information is handled.',
    keywords: ['data'],
  },
  {
    id: 'p-refunds',
    kind: 'Page',
    title: 'Refund Policy',
    href: '/refunds',
    summary: 'Refunds and returns.',
    keywords: ['return', 'money back'],
  },
];

/** Everything a visitor can search, from published records only. */
export function buildSearchIndex(): SearchDoc[] {
  return [
    ...pages,
    ...getPrograms().map((p) => ({
      id: p.id,
      kind: 'Program' as const,
      title: p.title,
      href: `/programs/${p.slug}`,
      summary: p.summary,
      keywords: [p.category, ...p.focus],
    })),
    ...getBooks().map((b) => ({
      id: b.id,
      kind: 'Book' as const,
      title: b.title,
      href: `/books/${b.slug}`,
      summary: b.synopsis,
      keywords: b.topics,
    })),
    ...getEvents().map((e) => ({
      id: e.id,
      kind: 'Event' as const,
      title: e.title,
      href: `/events/${e.slug}`,
      summary: e.description,
      keywords: [e.type, e.format, e.location],
    })),
    ...getContent().map((c) => ({
      id: c.id,
      kind: (c.type === 'video'
        ? 'Video'
        : c.type === 'article'
          ? 'Article'
          : 'Resource') as SearchDoc['kind'],
      title: c.title,
      href: contentHref(c),
      summary: c.excerpt,
      keywords: [topics[c.topic].label],
    })),
  ];
}
