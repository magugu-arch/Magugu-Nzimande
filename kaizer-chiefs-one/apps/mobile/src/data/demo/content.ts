import {
  contentItemSchema,
  homeModuleSchema,
  ok,
  unavailable,
  type ContentItem,
  type ContentProvider,
  type HomeModule,
} from '@kc-one/contracts';
import { demoProvenance, latency, SAMPLE_NOTE } from './common';

/**
 * Sample editorial cards. They describe the app's own features or carry
 * neutral, generic themes; none of them reports club news, results, signings
 * or announcements.
 */
const items: ContentItem[] = [
  {
    id: 'demo-hero',
    kind: 'campaign',
    eyebrow: 'Amakhosi · One App',
    title: 'Every Khosi matters.',
    summary:
      'Club news, matchday, membership and Fan Moments in one digital home that brings every Khosi closer to the club.',
    body: [SAMPLE_NOTE],
    heroImageKey: 'stadium',
    status: 'published',
    publishAt: null,
    unpublishAt: null,
    provenance: demoProvenance('hero'),
  },
  {
    id: 'demo-matchday-guide',
    kind: 'article',
    eyebrow: 'Matchday · Sample',
    title: 'Your matchday, in one place',
    summary:
      'How fixtures, the Match Centre and your Ticket Wallet will work together on a matchday.',
    body: [
      'On a matchday the app is meant to do three things well: tell you what is happening, get you into the stadium, and let you share the moment.',
      'Fixtures and the Match Centre will show verified information from the club’s licensed data feed, with a clear note whenever anything is out of date.',
      'Your Ticket Wallet will open your tickets from the official ticketing provider. Entry codes are fetched at the gate and expire within minutes, so a screenshot cannot be reused.',
      SAMPLE_NOTE,
    ],
    heroImageKey: 'fanCam',
    status: 'published',
    publishAt: null,
    unpublishAt: null,
    provenance: demoProvenance('matchday-guide'),
  },
  {
    id: 'demo-academy',
    kind: 'article',
    eyebrow: 'Academy · Sample',
    title: 'Where the next generation learns the game',
    summary: 'A sample feature showing how approved academy stories could appear in the app.',
    body: [
      'Academy and youth stories need the most care of anything the club publishes. Every image of a young player needs consent from a parent or guardian, and the club decides what is shown.',
      SAMPLE_NOTE,
    ],
    heroImageKey: 'youthAcademy',
    status: 'published',
    publishAt: null,
    unpublishAt: null,
    provenance: demoProvenance('academy'),
  },
  {
    id: 'demo-women',
    kind: 'article',
    eyebrow: 'Women’s football · Sample',
    title: 'Together before kick-off',
    summary: 'Layout sample for women’s team stories, fixtures and squad pages.',
    body: [
      'Women’s football will have the same standing in the app as the men’s first team: its own fixtures, squad and Match Centre, from the same verified sources.',
      SAMPLE_NOTE,
    ],
    heroImageKey: 'womensTeam',
    status: 'published',
    publishAt: null,
    unpublishAt: null,
    provenance: demoProvenance('women'),
  },
  {
    id: 'demo-community',
    kind: 'article',
    eyebrow: 'Community · Sample',
    title: 'Football in the neighbourhood',
    summary: 'Layout sample for the club’s community and development stories.',
    body: [SAMPLE_NOTE],
    heroImageKey: 'community',
    status: 'published',
    publishAt: null,
    unpublishAt: null,
    provenance: demoProvenance('community'),
  },
];

const modules: HomeModule[] = [
  {
    id: 'm-hero',
    type: 'hero',
    order: 0,
    title: null,
    contentIds: ['demo-hero'],
    status: 'published',
    publishAt: null,
    unpublishAt: null,
  },
  {
    id: 'm-fixture',
    type: 'next_fixture',
    order: 1,
    title: 'Next match',
    contentIds: [],
    status: 'published',
    publishAt: null,
    unpublishAt: null,
  },
  {
    id: 'm-links',
    type: 'quick_links',
    order: 2,
    title: null,
    contentIds: [],
    status: 'published',
    publishAt: null,
    unpublishAt: null,
  },
  {
    id: 'm-news',
    type: 'news_rail',
    order: 3,
    title: 'Latest',
    contentIds: ['demo-matchday-guide', 'demo-women', 'demo-academy', 'demo-community'],
    status: 'published',
    publishAt: null,
    unpublishAt: null,
  },
  {
    id: 'm-fan',
    type: 'fan_moments',
    order: 4,
    title: 'Fan Moments',
    contentIds: [],
    status: 'published',
    publishAt: null,
    unpublishAt: null,
  },
  {
    id: 'm-promo',
    type: 'promo',
    order: 5,
    title: null,
    contentIds: [],
    status: 'published',
    publishAt: null,
    unpublishAt: null,
  },
];

// Validate the sample set against the shared contract at load, so a demo item
// can never carry something the contract forbids.
items.forEach((i) => contentItemSchema.parse(i));
modules.forEach((m) => homeModuleSchema.parse(m));

export const demoContent: ContentProvider = {
  async getHomeFeed() {
    return latency(ok({ modules, items, provenance: demoProvenance() }, demoProvenance()));
  },
  async getArticle(id) {
    const item = items.find((i) => i.id === id);
    return latency(
      item ? ok(item, item.provenance) : unavailable('error', 'That story is not available.'),
    );
  },
};
