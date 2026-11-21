import { tx, type ClubSection, type ContentItem, type Faq } from '@scarlets/domain';
import { officialLinks } from '../config';
import { SIM_FIXTURE_ID } from './fixtures';

/**
 * DEMO EDITORIAL.
 *
 * Sample stories that show how club content would sit in the app. They are
 * written to be evergreen and to assert no club facts: no results, quotes,
 * signings, dates or names. In production every item comes from the club's
 * content system, with human approval and both language slots.
 */

const CREDIT = 'Concept image. Replace pending club media approval.';

type Draft = Omit<
  ContentItem,
  'credit' | 'expireAt' | 'status' | 'demo' | 'pinned' | 'translation'
> &
  Partial<Pick<ContentItem, 'pinned' | 'translation' | 'expireAt' | 'status'>>;

const item = (draft: Draft): ContentItem => ({
  credit: CREDIT,
  expireAt: null,
  status: 'published',
  pinned: false,
  translation: draft.title.cy ? 'draft' : 'missing',
  demo: true,
  ...draft,
});

export const contentSeed: ContentItem[] = [
  item({
    id: 'story-matchday-sorted',
    kind: 'feature',
    category: 'matchday',
    pinned: true,
    title: tx('Your matchday, sorted', 'Eich diwrnod gêm, yn barod'),
    summary: tx(
      'Tickets, travel, where to meet and where to eat: everything for the day in one place.',
      'Tocynnau, teithio, ble i gwrdd a ble i fwyta: popeth ar gyfer y diwrnod mewn un lle.',
    ),
    body: [
      tx(
        'A good matchday starts before you leave the house. Have your ticket ready on your phone, check how you are getting there and agree where your group will meet.',
      ),
      tx(
        'The Matchday tab keeps all of it together: your ticket link, travel guidance, the venue guide, food and drink, and help with access needs. Tick things off as you go.',
      ),
      tx(
        'Arrive with time to spare. The build-up is part of the day, and the stand sounds better when it is full for kick-off.',
      ),
    ],
    mediaId: 'arrival-family',
    publishAt: '2026-11-20T09:00:00Z',
  }),
  item({
    id: 'story-red-wall',
    kind: 'feature',
    category: 'club',
    title: tx(
      'Scarves up: the Red Wall in full voice',
      'Sgarffiau i fyny: y Wal Goch yn ei llawn hwyl',
    ),
    summary: tx(
      'What the stand sounds like when everyone arrives early and stays loud.',
      'Sut mae’r eisteddle’n swnio pan fydd pawb yn cyrraedd yn gynnar ac yn aros yn uchel.',
    ),
    body: [
      tx(
        'There is a moment before kick-off when the scarves go up and the noise turns from chatter into something with one voice. It is the reason people bring friends.',
      ),
      tx(
        'Scarlets One is built around that feeling: one region, one roar. Use the Fan Zone to join the matchday poll, make your prediction and share your photo for the big screen.',
      ),
    ],
    mediaId: 'scarves-raised-wide',
    publishAt: '2026-11-19T12:00:00Z',
  }),
  item({
    id: 'story-first-visit',
    kind: 'feature',
    category: 'matchday',
    title: tx('First time at the Parc? Start here', 'Tro cyntaf yn y Parc? Dechreuwch yma'),
    summary: tx('A simple guide for families and first-time visitors.'),
    body: [
      tx(
        'Bringing someone to their first match is one of the best things about following a club. A little planning makes it easy.',
      ),
      tx(
        'Look at the venue guide before you travel so you know which entrance is yours, where the nearest facilities are and where to find help on the day.',
      ),
      tx(
        'Agree a meeting point in the app and share it with your group, so nobody is left looking.',
      ),
    ],
    mediaId: 'first-visit',
    publishAt: '2026-11-18T10:00:00Z',
  }),
  item({
    id: 'story-accessible',
    kind: 'feature',
    category: 'matchday',
    title: tx('Accessible matchdays: how to get help', 'Diwrnodau gêm hygyrch: sut i gael cymorth'),
    summary: tx(
      'Access information sits inside matchday planning, not at the bottom of a help page.',
    ),
    body: [
      tx(
        'Access is part of planning the day. The Matchday tab has its own Accessibility section, covering viewing areas, step-free routes, facilities and how to contact the team before you travel.',
      ),
      tx(
        'Everything in that section is published only once the venue team has approved it. Until then the app says so plainly and points you to the club for an answer.',
      ),
    ],
    mediaId: 'accessible-matchday',
    publishAt: '2026-11-17T10:00:00Z',
  }),
  item({
    id: 'story-womens-pathway',
    kind: 'feature',
    category: 'women',
    title: tx("Women's rugby: the pathway in focus", 'Rygbi menywod: y llwybr dan sylw'),
    summary: tx(
      'Fixtures, stories and the route into the game, given the same weight as the first team.',
    ),
    body: [
      tx(
        "Women's rugby has its own hub in Scarlets One, with fixtures, results and stories given the same prominence as the senior men's side.",
      ),
      tx(
        'Follow the pathway from the More menu and it is pinned to your Home screen, so its news reaches you first.',
      ),
    ],
    mediaId: 'womens-action',
    publishAt: '2026-11-16T10:00:00Z',
  }),
  item({
    id: 'story-pathway-night',
    kind: 'feature',
    category: 'academy',
    title: tx('Inside a pathway training night', 'Y tu mewn i noson hyfforddi’r llwybr'),
    summary: tx('Where the next generation learns the habits that carry them forward.'),
    body: [
      tx(
        'Cones out, balls pumped, coach waiting. A pathway session is quieter than a matchday and every bit as important.',
      ),
      tx(
        'The Academy and Pathway section brings age-grade fixtures, development stories and registration information together.',
      ),
    ],
    mediaId: 'pathway-training',
    publishAt: '2026-11-15T10:00:00Z',
  }),
  item({
    id: 'story-community',
    kind: 'feature',
    category: 'community',
    title: tx('Coaching the next generation', 'Hyfforddi’r genhedlaeth nesaf'),
    summary: tx('Community rugby is where the region’s game begins.'),
    body: [
      tx(
        'Long before a player runs out at the Parc, somebody taught them to pass on a village pitch. Community rugby is where it starts.',
      ),
      tx(
        'The Community section lists camps, events, local clubs and ways to volunteer as they are published.',
      ),
    ],
    mediaId: 'grassroots-coaching',
    publishAt: '2026-11-14T10:00:00Z',
  }),
  item({
    id: 'story-volunteers',
    kind: 'feature',
    category: 'community',
    title: tx('The people who make matchday', 'Y bobl sy’n gwneud diwrnod gêm'),
    summary: tx('A welcome, a map and a point in the right direction.'),
    body: [
      tx(
        'The first face you see on a matchday is often a volunteer. They know the ground, and they are there to help you find your way.',
      ),
    ],
    mediaId: 'volunteer-welcome',
    publishAt: '2026-11-13T10:00:00Z',
  }),
  item({
    id: 'story-archive',
    kind: 'feature',
    category: 'history',
    title: tx('Under glass: what the archive keeps', 'Dan wydr: yr hyn mae’r archif yn ei gadw'),
    summary: tx('Old leather, folded wool and team photographs: the club’s memory, preserved.'),
    body: [
      tx(
        'A club is its people and its stories. The History section is where archive pieces, landmark seasons and former-player profiles will live.',
      ),
      tx('Every archive story is checked against the club’s own records before it is published.'),
    ],
    mediaId: 'legacy-archive',
    publishAt: '2026-11-12T10:00:00Z',
  }),
  item({
    id: 'story-generations',
    kind: 'feature',
    category: 'history',
    title: tx('Three generations, one stand', 'Tair cenhedlaeth, un eisteddle'),
    summary: tx('The seat next to you matters as much as the view.'),
    body: [
      tx(
        'Ask most supporters who first brought them and you get a name and a story. Support is handed down.',
      ),
    ],
    mediaId: 'generations',
    publishAt: '2026-11-11T10:00:00Z',
  }),
  item({
    id: 'story-global',
    kind: 'feature',
    category: 'club',
    title: tx('Watching from afar', 'Gwylio o bell'),
    summary: tx('For supporters who follow from another town, or another continent.'),
    body: [
      tx(
        'Not everyone can be in the ground. Match Centre, alerts and official audio and video links keep away and overseas supporters close to the team.',
      ),
    ],
    mediaId: 'global-watch',
    publishAt: '2026-11-10T10:00:00Z',
  }),
  item({
    id: 'story-west-wales',
    kind: 'feature',
    category: 'club',
    title: tx('One region', 'Un rhanbarth'),
    summary: tx('From the coast to the valleys, this is where the support comes from.'),
    body: [
      tx(
        'The club belongs to a place as much as to a ground. That sense of belonging is the thread through everything in Scarlets One.',
      ),
    ],
    mediaId: 'west-wales',
    publishAt: '2026-11-09T10:00:00Z',
  }),
  item({
    id: 'report-sim',
    kind: 'report',
    category: 'first_team',
    fixtureId: SIM_FIXTURE_ID,
    title: tx('Demo match report: Scarlets 25, Demo XV 20'),
    summary: tx(
      'A sample report for the simulated match, showing where post-match coverage appears.',
    ),
    body: [
      tx(
        'This is a sample report for a simulated match against a synthetic opponent. It shows where the club’s own report, reaction and gallery appear after full time.',
      ),
      tx(
        'In the simulation the home side led 15-10 at the break, fell behind early in the second half and won it with a converted try six minutes from time.',
      ),
      tx('Real reports are written and approved by the club’s editorial team.'),
    ],
    mediaId: 'tryline-moment',
    // Published a little after the simulated final whistle.
    publishAt: '2026-11-14T16:39:00Z',
  }),
  item({
    id: 'video-interview',
    kind: 'video',
    category: 'first_team',
    title: tx('Behind the scenes: interview day', 'Y tu ôl i’r llenni: diwrnod cyfweld'),
    summary: tx('Opens on the club’s official channel.'),
    body: [],
    mediaId: 'interview-bts',
    publishAt: '2026-11-18T15:00:00Z',
    link: { url: officialLinks.media.url, label: officialLinks.media.label },
    durationLabel: 'Video',
    captions: true,
  }),
  item({
    id: 'video-tunnel',
    kind: 'video',
    category: 'first_team',
    title: tx('Tunnel focus: the last minute before kick-off', 'Ffocws y twnnel'),
    summary: tx('Opens on the club’s official channel.'),
    body: [],
    mediaId: 'tunnel-huddle',
    publishAt: '2026-11-17T15:00:00Z',
    link: { url: officialLinks.media.url, label: officialLinks.media.label },
    durationLabel: 'Video',
    captions: true,
  }),
  item({
    id: 'video-potm',
    kind: 'video',
    category: 'first_team',
    title: tx('Player of the Match: the lap of thanks'),
    summary: tx('Opens on the club’s official channel.'),
    body: [],
    mediaId: 'player-of-match',
    publishAt: '2026-11-16T15:00:00Z',
    link: { url: officialLinks.media.url, label: officialLinks.media.label },
    durationLabel: 'Video',
    captions: false,
  }),
  item({
    id: 'audio-preview',
    kind: 'audio',
    category: 'first_team',
    title: tx('Matchday preview', 'Rhagolwg diwrnod gêm'),
    summary: tx('Audio. Opens on the club’s official channel.'),
    body: [],
    mediaId: 'stadium-bowl',
    publishAt: '2026-11-19T08:00:00Z',
    link: { url: officialLinks.media.url, label: officialLinks.media.label },
    durationLabel: 'Audio',
  }),
];

const AWAITING = 'awaiting_approval' as const;

export const clubSections: ClubSection[] = [
  {
    id: 'first-team',
    title: tx('First team', 'Tîm cyntaf'),
    intro: tx(
      'Squad profiles, interviews and official announcements for the senior side.',
      'Proffiliau’r garfan, cyfweliadau a chyhoeddiadau swyddogol y tîm hŷn.',
    ),
    mediaId: 'squad-portrait',
    category: 'first_team',
    panels: [
      {
        id: 'squad',
        title: tx('Squad profiles', 'Proffiliau’r garfan'),
        body: tx(
          'Approved portraits, positions and biographies appear here from the official squad feed. The portrait shown is a layout template, not a named player.',
        ),
        mediaId: 'player-portrait',
        approval: AWAITING,
      },
      {
        id: 'management',
        title: tx('Coaches and management', 'Hyfforddwyr a rheolwyr'),
        body: tx('Published from the club’s official management listing.'),
        approval: AWAITING,
      },
    ],
  },
  {
    id: 'women',
    title: tx("Women's rugby", 'Rygbi menywod'),
    intro: tx(
      'A dedicated hub for the women’s pathway, with equal editorial treatment and its own fixtures.',
      'Hwb pwrpasol ar gyfer llwybr y menywod, gyda’r un sylw golygyddol a’i gemau ei hun.',
    ),
    mediaId: 'womens-action',
    category: 'women',
    panels: [
      {
        id: 'pathway',
        title: tx('The pathway', 'Y llwybr'),
        body: tx('Teams, age groups and how to get involved, as published by the club.'),
        approval: AWAITING,
      },
    ],
  },
  {
    id: 'academy',
    title: tx('Academy and pathway', 'Academi a llwybr'),
    intro: tx(
      'Age-grade fixtures, development stories and registration information.',
      'Gemau graddau oedran, straeon datblygu a gwybodaeth gofrestru.',
    ),
    mediaId: 'pathway-training',
    category: 'academy',
    panels: [
      {
        id: 'age-grade',
        title: tx('Age-grade rugby', 'Rygbi graddau oedran'),
        body: tx('Fixtures and results for the age-grade sides listed on the club’s rugby pages.'),
        approval: AWAITING,
      },
      {
        id: 'register',
        title: tx('Getting involved', 'Cymryd rhan'),
        body: tx('Registration routes and contacts, supplied by the pathway team.'),
        approval: AWAITING,
      },
    ],
  },
  {
    id: 'community',
    title: tx('Community', 'Cymuned'),
    intro: tx(
      'Camps, events, local clubs and volunteering across the region.',
      'Gwersylloedd, digwyddiadau, clybiau lleol a gwirfoddoli ar draws y rhanbarth.',
    ),
    mediaId: 'grassroots-coaching',
    category: 'community',
    panels: [
      {
        id: 'club-finder',
        title: tx('Find a local club', 'Dod o hyd i glwb lleol'),
        body: tx(
          'A club finder will list junior and community clubs once the directory is supplied.',
        ),
        approval: AWAITING,
      },
      {
        id: 'volunteer',
        title: tx('Volunteer', 'Gwirfoddoli'),
        body: tx('Opportunities to help on matchdays and in the community.'),
        mediaId: 'volunteer-welcome',
        approval: AWAITING,
      },
    ],
  },
  {
    id: 'history',
    title: tx('History and heritage', 'Hanes a threftadaeth'),
    intro: tx(
      'Archive stories, landmark seasons and the people who built the club.',
      'Straeon o’r archif, tymhorau nodedig a’r bobl a adeiladodd y clwb.',
    ),
    mediaId: 'legacy-archive',
    category: 'history',
    panels: [
      {
        id: 'ambassadors',
        title: tx('Former players and ambassadors', 'Cyn-chwaraewyr a llysgenhadon'),
        body: tx(
          'Profiles and oral histories, published with each person’s permission. The portrait shown is a layout template.',
        ),
        mediaId: 'ambassador-portrait',
        approval: AWAITING,
      },
    ],
  },
  {
    id: 'leadership',
    title: tx('Club leadership', 'Arweinyddiaeth y clwb'),
    intro: tx(
      'Official management, governance updates and published statements.',
      'Rheolaeth swyddogol, diweddariadau llywodraethu a datganiadau cyhoeddedig.',
    ),
    mediaId: 'parc-exterior',
    category: 'club',
    panels: [
      {
        id: 'statements',
        title: tx('Statements and updates', 'Datganiadau a diweddariadau'),
        body: tx('Published statements appear here exactly as the club issues them.'),
        approval: AWAITING,
      },
    ],
  },
];

export const faqSeed: Faq[] = [
  {
    id: 'faq-official',
    topic: 'app',
    question: tx('Is this an official Scarlets app?', 'Ai ap swyddogol y Scarlets yw hwn?'),
    answer: tx(
      'No. Scarlets One is a product concept. Fixtures, scores, rewards and venue details in this build are demo data and are labelled DEMO wherever they appear.',
    ),
  },
  {
    id: 'faq-tickets',
    topic: 'tickets',
    question: tx('Where do I buy tickets?', 'Ble ydw i’n prynu tocynnau?'),
    answer: tx(
      'Through the club’s official ticketing service. Scarlets One opens that journey for you. It does not sell tickets, take payment or store your ticket barcode.',
    ),
  },
  {
    id: 'faq-wallet',
    topic: 'tickets',
    question: tx('Can I add my ticket to my phone’s wallet?'),
    answer: tx(
      'Where the ticketing service supports it, you add the pass from your official ticket account. The Matchday tab links you there.',
    ),
  },
  {
    id: 'faq-account',
    topic: 'account',
    question: tx('Do I need an account?', 'Oes angen cyfrif arnaf?'),
    answer: tx(
      'No. Fixtures, news, Match Centre and the venue guide are open to everyone. You are asked to sign in only for Passport, saved preferences and taking part in the Fan Zone.',
    ),
  },
  {
    id: 'faq-delete',
    topic: 'account',
    question: tx('How do I delete my account?', 'Sut ydw i’n dileu fy nghyfrif?'),
    answer: tx(
      'Go to Settings, then Privacy and data, then Request account deletion. Your request is sent to the club and your data is removed in line with its retention policy.',
    ),
  },
  {
    id: 'faq-map',
    topic: 'matchday',
    question: tx('Can I rely on the venue map?'),
    answer: tx(
      'Only once it is marked as venue approved. The layout in this build is an illustration and must not be used to navigate.',
    ),
  },
  {
    id: 'faq-access',
    topic: 'accessibility',
    question: tx('Where is the accessibility information?', 'Ble mae’r wybodaeth hygyrchedd?'),
    answer: tx(
      'In the Matchday tab, under Accessibility. It covers viewing areas, step-free routes, facilities and how to contact the team, and is published only with the venue’s approval.',
    ),
  },
  {
    id: 'faq-data',
    topic: 'privacy',
    question: tx('What does the app know about me?', 'Beth mae’r ap yn ei wybod amdanaf?'),
    answer: tx(
      'As little as it needs. Your language and preferences stay on your device. Location is asked for only when a travel or map feature needs it, never in the background. Marketing consent is separate from service messages and is off by default.',
    ),
  },
  {
    id: 'faq-fancam',
    topic: 'privacy',
    question: tx('What happens to a Fan Cam photo I send?'),
    answer: tx(
      'It goes to a moderation queue. Nothing is shown publicly or on a stadium screen until a moderator approves it, and you can withdraw it at any time.',
    ),
  },
];
