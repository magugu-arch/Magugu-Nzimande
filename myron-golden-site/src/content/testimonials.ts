import type { Enquiry, Testimonial } from './types';

/**
 * DEMO ONLY placeholders (brief §7). No quote, name or result is written
 * here: a testimonial is published only with the client's own words, their
 * written consent and its context. Until then the section shows these empty
 * slots in preview and disappears in production.
 */
export const testimonials: Testimonial[] = [1, 2, 3, 4].map((n) => ({
  id: `testimonial-placeholder-${n}`,
  name: null,
  role: null,
  quote: null,
  mediaUrl: null,
  context: null,
  consentReference: null,
  approved: false,
  isDemo: true,
  source: 'Placeholder — awaiting an approved client story',
  lastReviewed: '2026-10-14',
  needsConfirmation: ['Client’s exact words', 'Signed permission', 'Context and any disclosure'],
}));

/**
 * DEMO ONLY enquiries for the review screen, so the team can see how inbound
 * leads will be listed. Names are obviously fictional.
 */
export const demoEnquiries: Enquiry[] = [
  ['speaking', 'Demo Organiser A', 'Demo Association', 'Annual conference keynote, 400 attendees'],
  ['speaking', 'Demo Organiser B', 'Demo Church Network', 'Leadership retreat, half-day session'],
  ['speaking', 'Demo Organiser C', 'Demo University', 'Entrepreneurship week, virtual talk'],
  ['support', 'Demo Customer D', null, 'Cannot find challenge replay link'],
  ['support', 'Demo Customer E', null, 'Question about a book order'],
  ['general', 'Demo Visitor F', null, 'Where to start with the free training'],
  ['partnership', 'Demo Partner G', 'Demo Studio', 'Podcast collaboration proposal'],
  ['press', 'Demo Journalist H', 'Demo Business Weekly', 'Interview request and headshots'],
  [
    'speaking',
    'Demo Organiser I',
    'Demo Chamber of Commerce',
    'Breakfast talk on small business growth',
  ],
  ['general', 'Demo Visitor J', null, 'Accessibility question about live events'],
].map(([category, name, organisation, summary], i) => ({
  id: `enq-demo-${i + 1}`,
  category: category as Enquiry['category'],
  name: name as string,
  organisation: organisation,
  summary: summary as string,
  sourcePage: category === 'speaking' ? '/speaking' : '/contact',
  createdAt: new Date(Date.UTC(2026, 9, 13 - i, 15, 0)).toISOString(),
  status: i < 3 ? 'new' : i < 7 ? 'in-review' : 'replied',
  assignedTo: i < 3 ? null : 'Team (demo)',
  isDemo: true,
}));
