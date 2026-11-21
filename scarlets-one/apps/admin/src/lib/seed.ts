import {
  SIM_FIXTURE_ID,
  campaignSeed,
  contentSeed,
  fixtureSeeds,
  scenarios,
  storySeed,
} from '@scarlets/adapters';
import { tx, type Campaign, type ContentItem, type SupporterStory } from '@scarlets/domain';
import type {
  CampaignRecord,
  ContentRecord,
  FixtureRecord,
  ModerationCase,
  PushNotification,
  Segment,
  StaffUser,
} from './types';

/**
 * DEMO SEED for the operations console.
 *
 * Everything here is mock data. The supporter-facing seed comes from
 * @scarlets/adapters; this file adds only what a back office needs on top:
 * staff accounts, a few unpublished drafts, a moderation queue and some
 * scheduled pushes. No sponsor, person or club fact is invented: partners
 * stay placeholder slots, staff are named after their role, and audience
 * figures are round numbers labelled DEMO.
 */

/** The demo clock starts here (the "two weeks out" scenario), so dates below sit around it. */
export const DEMO_START = scenarios.pre_match.startsAt;

export const SEED_AUTHOR = 'Demo seed';
const CREDIT = 'Concept image. Replace pending club media approval.';

export const SCHEDULER_ID = 'svc-scheduler';

export const staffSeed: StaffUser[] = [
  {
    id: 'u-club-admin',
    name: 'Demo Club Admin',
    email: 'club.admin@demo.invalid',
    role: 'club_admin',
    system: false,
    demo: true,
  },
  {
    id: 'u-ops-lead',
    name: 'Demo Operations Lead',
    email: 'operations@demo.invalid',
    role: 'club_admin',
    system: false,
    demo: true,
  },
  {
    id: 'u-editor',
    name: 'Demo Editor',
    email: 'editor@demo.invalid',
    role: 'editor',
    system: false,
    demo: true,
  },
  {
    id: 'u-editor-cy',
    name: 'Demo Welsh Editor',
    email: 'golygydd@demo.invalid',
    role: 'editor',
    system: false,
    demo: true,
  },
  {
    id: 'u-moderator',
    name: 'Demo Moderator',
    email: 'moderator@demo.invalid',
    role: 'moderator',
    system: false,
    demo: true,
  },
  {
    id: 'u-partner-admin',
    name: 'Demo Partner Admin',
    email: 'partner.admin@demo.invalid',
    role: 'partner_admin',
    system: false,
    demo: true,
  },
  {
    id: SCHEDULER_ID,
    name: 'Scheduler',
    email: 'scheduler@demo.invalid',
    role: 'service',
    system: true,
    demo: true,
  },
];

/* -------------------------------------------------------------- content */

const consoleItem = (
  draft: Pick<
    ContentItem,
    'id' | 'category' | 'title' | 'summary' | 'body' | 'mediaId' | 'publishAt' | 'status'
  >,
): ContentItem => ({
  kind: 'feature',
  credit: CREDIT,
  expireAt: null,
  pinned: false,
  translation: draft.title.cy ? 'draft' : 'missing',
  demo: true,
  ...draft,
});

/** Unpublished sample items, so the publishing workflow has something to work on. */
const unpublished: ContentRecord[] = [
  {
    item: consoleItem({
      id: 'draft-venue-guide',
      category: 'matchday',
      status: 'draft',
      title: tx(
        'Find your way with the venue guide',
        'Dewch o hyd i’ch ffordd gyda chanllaw’r lleoliad',
      ),
      summary: tx(
        'Entrances, facilities and help points on one map, to look at before you travel.',
        'Mynedfeydd, cyfleusterau a mannau cymorth ar un map, i’w weld cyn i chi deithio.',
      ),
      body: [
        tx(
          'The venue guide shows your entrance, the nearest facilities and where to find help on the day.',
        ),
        tx('Open it from the Matchday tab before you leave, while you still have a good signal.'),
        tx('Every point on the map is published only once the venue team has approved it.'),
      ],
      mediaId: 'volunteer-welcome',
      publishAt: DEMO_START,
    }),
    updatedAt: '2026-11-20T15:20:00Z',
    updatedBy: 'Demo Editor',
    review: null,
    approval: null,
  },
  {
    item: consoleItem({
      id: 'draft-fan-zone-guide',
      category: 'club',
      status: 'draft',
      title: tx('How the Fan Zone works'),
      summary: tx(
        'Predictions, polls, the quiz and Fan Cam: what each one is and how to take part.',
      ),
      body: [
        tx(
          'The Fan Zone is structured: predictions, polls, a quiz, Fan Cam and a venue challenge. There is no open chat.',
        ),
        tx('Predictions are for fun only, with no stakes and no prizes of chance.'),
        tx('Every Fan Cam photo is checked by a moderator before anyone else sees it.'),
      ],
      mediaId: 'fan-cam-spotlight',
      publishAt: DEMO_START,
    }),
    updatedAt: '2026-11-21T08:45:00Z',
    updatedBy: 'Demo Editor',
    review: { requestedBy: 'Demo Editor', requestedAt: '2026-11-21T08:45:00Z' },
    approval: null,
  },
  {
    item: consoleItem({
      id: 'sched-travel-checklist',
      category: 'matchday',
      status: 'scheduled',
      title: tx('Five things to check before you travel', 'Pum peth i’w gwirio cyn teithio'),
      summary: tx(
        'Ticket, route, meeting point, weather and access needs: a short list for the morning of a match.',
        'Tocyn, llwybr, man cyfarfod, y tywydd ac anghenion mynediad: rhestr fer ar gyfer bore’r gêm.',
      ),
      body: [
        tx('Have your ticket ready on your phone before you set off.'),
        tx('Check your route and agree a meeting point with your group.'),
        tx(
          'If you have access needs, look at the Accessibility section in the Matchday tab and contact the club before you travel.',
        ),
      ],
      mediaId: 'meeting-point',
      publishAt: '2026-11-23T09:00:00Z',
    }),
    updatedAt: '2026-11-20T16:05:00Z',
    updatedBy: 'Demo Club Admin',
    review: null,
    approval: { by: 'Demo Club Admin', at: '2026-11-20T16:05:00Z' },
  },
];

export function seedContent(): ContentRecord[] {
  const published: ContentRecord[] = contentSeed.map((item) => ({
    item: structuredClone(item),
    updatedAt: item.publishAt,
    updatedBy: SEED_AUTHOR,
    review: null,
    approval: null,
  }));
  return [...structuredClone(unpublished), ...published];
}

/* ------------------------------------------------------------- fixtures */

export function seedFixtures(): FixtureRecord[] {
  return fixtureSeeds.map((fixture) => ({
    fixture: structuredClone(fixture),
    visible: true,
    notice: null,
    updatedAt: null,
    updatedBy: null,
  }));
}

/* ------------------------------------------------------------ campaigns */

const draftCampaigns: Campaign[] = [
  {
    id: 'cmp-draft-home-community',
    partnerId: 'slot-community',
    label: 'partner_feature',
    placement: 'home',
    title: tx('A community activation goes here', 'Mae gweithgaredd cymunedol yn mynd yma'),
    body: tx(
      'Sample draft from a partner admin. It asks for Home, which already has an approved campaign.',
    ),
    mediaId: 'grassroots-coaching',
    startsAt: '2026-12-01T00:00:00Z',
    endsAt: '2027-01-05T00:00:00Z',
    cta: null,
    terms: null,
    priority: 10,
    demo: true,
  },
  {
    id: 'cmp-draft-match-centre',
    partnerId: 'slot-principal',
    label: 'sponsored',
    placement: 'match_centre',
    title: tx('A sponsored Match Centre panel goes here', 'Mae panel noddedig yn mynd yma'),
    body: tx('Sample draft from a partner admin. Match Centre has no campaign yet.'),
    mediaId: 'stadium-bowl',
    startsAt: '2026-12-01T00:00:00Z',
    endsAt: '2027-03-01T00:00:00Z',
    cta: null,
    terms: null,
    priority: 10,
    demo: true,
  },
];

export function seedCampaigns(): CampaignRecord[] {
  const approved: CampaignRecord[] = campaignSeed.map((campaign) => ({
    campaign: structuredClone(campaign),
    status: 'approved',
    approval: null,
    updatedAt: campaign.startsAt,
    updatedBy: SEED_AUTHOR,
  }));
  const drafts: CampaignRecord[] = draftCampaigns.map((campaign) => ({
    campaign: structuredClone(campaign),
    status: 'draft',
    approval: null,
    updatedAt: '2026-11-20T11:30:00Z',
    updatedBy: 'Demo Partner Admin',
  }));
  return [...drafts, ...approved];
}

/* ----------------------------------------------------------- moderation */

const FAN_CAM_ACTIVITY = `fancam-${SIM_FIXTURE_ID}`;
const CONSENT = { ageOrGuardian: true, peopleInPhoto: true, displayAndModeration: true } as const;

const fanCam = (
  n: number,
  mediaId: string,
  submittedAt: string,
  caption: string | null,
  reviewerPrompt: string | null = null,
): ModerationCase => ({
  id: `mod-fancam-0${n}`,
  kind: 'fan_cam',
  state: 'pending',
  activityId: FAN_CAM_ACTIVITY,
  mediaId,
  caption,
  submitter: `Demo supporter ${n}`,
  consent: CONSENT,
  reviewerPrompt,
  submittedAt,
  decision: null,
  demo: true,
});

export function seedCases(): ModerationCase[] {
  return [
    fanCam(
      1,
      'fan-cam-spotlight',
      '2026-11-14T14:42:00Z',
      'Demo caption: scarves up before kick-off',
    ),
    fanCam(2, 'scarves-celebration', '2026-11-14T15:13:00Z', 'Demo caption: loud and proud'),
    fanCam(
      3,
      'first-visit',
      '2026-11-14T15:31:00Z',
      'Demo caption: her first match',
      'A child is in this photo. Approve only if you are satisfied a parent or guardian sent it; if in doubt, escalate.',
    ),
    fanCam(4, 'generations', '2026-11-14T15:58:00Z', null),
    fanCam(
      5,
      'big-screen-celebration',
      '2026-11-14T16:21:00Z',
      'Demo caption: made the big screen',
    ),
    {
      id: 'mod-story-01',
      kind: 'story_report',
      state: 'pending',
      storyId: 'ss-meeting',
      reason: 'privacy',
      note: 'Demo report: someone in this photo has asked for it to be taken down.',
      reporter: 'Demo supporter 6',
      submittedAt: '2026-11-20T19:05:00Z',
      decision: null,
      demo: true,
    },
    {
      id: 'mod-story-02',
      kind: 'story_report',
      state: 'pending',
      storyId: 'ss-screen',
      reason: 'spam',
      note: 'Demo report: this reads like an advert.',
      reporter: 'Demo supporter 7',
      submittedAt: '2026-11-21T07:40:00Z',
      decision: null,
      demo: true,
    },
  ];
}

/** Reports about privacy or safety hold the story at once; the rest stay up until reviewed. */
export const HOLD_ON_REPORT = ['privacy', 'safety'] as const;

export function seedStories(): SupporterStory[] {
  const held = new Set(
    seedCases()
      .filter(
        (c) =>
          c.kind === 'story_report' && (HOLD_ON_REPORT as readonly string[]).includes(c.reason),
      )
      .map((c) => (c.kind === 'story_report' ? c.storyId : '')),
  );
  return storySeed.map((story) => ({
    ...structuredClone(story),
    moderation: held.has(story.id) ? 'pending' : story.moderation,
  }));
}

/* -------------------------------------------------------- notifications */

export const segmentSeed: Segment[] = [
  {
    id: 'following_first_team',
    label: 'Following first team',
    description: 'Supporters who follow the first team in the app.',
    pushEnabled: 1000,
    marketingConsent: 400,
    demo: true,
  },
  {
    id: 'season_members',
    label: 'Season members',
    description: 'Supporters the membership provider reports as season members.',
    pushEnabled: 400,
    marketingConsent: 180,
    demo: true,
  },
  {
    id: 'matchday_attendees',
    label: 'Matchday attendees',
    description: 'Supporters holding a ticket for the next home match.',
    pushEnabled: 250,
    marketingConsent: 90,
    demo: true,
  },
];

export function seedNotifications(): PushNotification[] {
  return [
    {
      id: 'ntf-seed-01',
      title: tx('Demo: a member offer', 'Demo: cynnig i aelodau'),
      body: tx('Sample marketing push. It went only to members who opted in to marketing.'),
      segment: 'season_members',
      category: 'marketing',
      sendAt: '2026-11-18T12:00:00Z',
      status: 'sent',
      recipients: 180,
      createdBy: 'Demo Club Admin',
      createdAt: '2026-11-17T10:00:00Z',
      demo: true,
    },
    {
      id: 'ntf-seed-02',
      title: tx('Demo: a partner offer', 'Demo: cynnig gan bartner'),
      body: tx('Sample marketing push waiting to go. It will reach only members who opted in.'),
      segment: 'season_members',
      category: 'marketing',
      sendAt: '2026-11-23T12:00:00Z',
      status: 'scheduled',
      recipients: 180,
      createdBy: 'Demo Club Admin',
      createdAt: '2026-11-20T10:00:00Z',
      demo: true,
    },
    {
      id: 'ntf-seed-03',
      title: tx('Demo: matchday information', 'Demo: gwybodaeth diwrnod gêm'),
      body: tx('Sample service message for supporters holding a ticket for the next home match.'),
      segment: 'matchday_attendees',
      category: 'service',
      sendAt: '2026-12-05T13:00:00Z',
      status: 'scheduled',
      recipients: 250,
      createdBy: 'Demo Club Admin',
      createdAt: '2026-11-20T10:05:00Z',
      demo: true,
    },
  ];
}

export const TEST_DEVICE = 'Demo test device (simulator)';
export const TEST_PROVIDER = 'NotificationProvider mock';
