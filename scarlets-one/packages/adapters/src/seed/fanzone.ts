import { tx, type FanActivity, type QuizActivity, type SupporterStory } from '@scarlets/domain';
import { EXAMPLE_KICKOFF, SIM_KICKOFF } from '../demo';
import { EXAMPLE_FIXTURE_ID, SIM_FIXTURE_ID, SIM_FULL_TIME_ELAPSED } from './fixtures';

/**
 * DEMO FAN ZONE.
 *
 * Structured participation only: predictions, polls, a quiz, Fan Cam and a
 * venue challenge. There is no open chat and no messaging between supporters.
 * Predictions carry no stake, odds or prize of chance.
 */

const minutesAfter = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

const PARTNER_SLOT = 'Official partner (to be confirmed)';

const quiz: QuizActivity = {
  id: 'quiz-rugby-basics',
  kind: 'quiz',
  title: tx('Rugby in five questions', 'Rygbi mewn pum cwestiwn'),
  prompt: tx(
    'New to the game, or think you know it all?',
    'Newydd i’r gêm, neu’n meddwl eich bod yn gwybod y cyfan?',
  ),
  opensAt: '2026-08-01T00:00:00Z',
  closesAt: '2027-12-31T00:00:00Z',
  sponsorship: null,
  requiresSignIn: false,
  demo: true,
  // Question banks are approved by the club's editorial team before release.
  editorialStatus: 'awaiting_approval',
  questions: [
    {
      id: 'q1',
      prompt: tx('How many points is a try worth?', 'Faint o bwyntiau yw gwerth cais?'),
      options: [
        { id: 'a', label: tx('3') },
        { id: 'b', label: tx('5') },
        { id: 'c', label: tx('7') },
      ],
      answerId: 'b',
      explanation: tx('A try is five points. The conversion that follows adds two.'),
    },
    {
      id: 'q2',
      prompt: tx(
        'How many players does each side have on the field in rugby union?',
        'Faint o chwaraewyr sydd gan bob tîm ar y cae mewn rygbi’r undeb?',
      ),
      options: [
        { id: 'a', label: tx('13') },
        { id: 'b', label: tx('15') },
        { id: 'c', label: tx('11') },
      ],
      answerId: 'b',
      explanation: tx('Fifteen: eight forwards and seven backs.'),
    },
    {
      id: 'q3',
      prompt: tx('What does the Welsh word "ymlaen" mean?', 'Beth yw ystyr "ymlaen" yn Saesneg?'),
      options: [
        { id: 'a', label: tx('Forward', 'Forward') },
        { id: 'b', label: tx('Together', 'Together') },
        { id: 'c', label: tx('Home', 'Home') },
      ],
      answerId: 'a',
      explanation: tx('Ymlaen means forward, or onward.'),
    },
    {
      id: 'q4',
      prompt: tx(
        'How many points is a penalty goal worth?',
        'Faint o bwyntiau yw gwerth gôl gosb?',
      ),
      options: [
        { id: 'a', label: tx('2') },
        { id: 'b', label: tx('3') },
        { id: 'c', label: tx('5') },
      ],
      answerId: 'b',
      explanation: tx('Three points, the same as a drop goal.'),
    },
    {
      id: 'q5',
      prompt: tx(
        'Which shirt number does the scrum-half wear?',
        'Pa rif crys mae’r mewnwr yn ei wisgo?',
      ),
      options: [
        { id: 'a', label: tx('9') },
        { id: 'b', label: tx('10') },
        { id: 'c', label: tx('7') },
      ],
      answerId: 'a',
      explanation: tx('Nine. The fly-half outside them wears ten.'),
    },
  ],
};

export const activitySeed: FanActivity[] = [
  {
    id: `prediction-${EXAMPLE_FIXTURE_ID}`,
    kind: 'prediction',
    title: tx('Call the score', 'Rhagfynegwch y sgôr'),
    prompt: tx(
      'Scarlets v Connacht. Predictions close at kick-off. For fun only: no stakes and no prizes.',
      'Scarlets v Connacht. Mae’r rhagfynegiadau’n cau ar y gic gyntaf. Am hwyl yn unig: dim arian a dim gwobrau.',
    ),
    opensAt: '2026-11-07T09:00:00Z',
    closesAt: EXAMPLE_KICKOFF,
    fixtureId: EXAMPLE_FIXTURE_ID,
    sponsorship: null,
    requiresSignIn: false,
    demo: true,
    homeName: 'Scarlets',
    awayName: 'Connacht',
  },
  {
    id: `prediction-${SIM_FIXTURE_ID}`,
    kind: 'prediction',
    title: tx('Call the score', 'Rhagfynegwch y sgôr'),
    prompt: tx('Scarlets v Demo XV. Predictions close at kick-off.'),
    opensAt: '2026-11-01T09:00:00Z',
    closesAt: SIM_KICKOFF,
    fixtureId: SIM_FIXTURE_ID,
    sponsorship: null,
    requiresSignIn: false,
    demo: true,
    homeName: 'Scarlets',
    awayName: 'Demo XV',
  },
  {
    id: 'poll-looking-forward',
    kind: 'poll',
    title: tx('Matchday poll', 'Pôl diwrnod gêm'),
    prompt: tx(
      'What are you most looking forward to at the next home match?',
      'Beth ydych chi’n edrych ymlaen ato fwyaf yn y gêm gartref nesaf?',
    ),
    opensAt: '2026-11-15T09:00:00Z',
    closesAt: EXAMPLE_KICKOFF,
    fixtureId: EXAMPLE_FIXTURE_ID,
    sponsorship: null,
    requiresSignIn: false,
    demo: true,
    options: [
      { id: 'atmosphere', label: tx('The atmosphere', 'Yr awyrgylch') },
      { id: 'rugby', label: tx('Open, attacking rugby', 'Rygbi agored, ymosodol') },
      { id: 'friends', label: tx('Catching up with friends', 'Dal i fyny â ffrindiau') },
      { id: 'someone-new', label: tx('Bringing someone new', 'Dod â rhywun newydd') },
    ],
  },
  {
    id: `potm-${SIM_FIXTURE_ID}`,
    kind: 'poll',
    title: tx('Player of the Match', 'Chwaraewr y Gêm'),
    prompt: tx(
      'Vote by shirt number. One vote each. Voting closes 20 minutes after full time.',
      'Pleidleisiwch yn ôl rhif crys. Un bleidlais yr un. Mae’r pleidleisio’n cau 20 munud ar ôl amser llawn.',
    ),
    // Opens on the hour mark of the simulated match.
    opensAt: minutesAfter(SIM_KICKOFF, 75),
    closesAt: minutesAfter(SIM_KICKOFF, SIM_FULL_TIME_ELAPSED + 20),
    fixtureId: SIM_FIXTURE_ID,
    sponsorship: { label: tx('Sponsored', 'Noddir'), partnerName: PARTNER_SLOT },
    requiresSignIn: false,
    demo: true,
    options: [
      { id: 'n8', label: tx('No. 8 · Number 8', 'Rhif 8 · Wythwr') },
      { id: 'n10', label: tx('No. 10 · Fly-half', 'Rhif 10 · Maswr') },
      { id: 'n14', label: tx('No. 14 · Right wing', 'Rhif 14 · Asgellwr de') },
      { id: 'n20', label: tx('No. 20 · Replacement', 'Rhif 20 · Eilydd') },
    ],
  },
  quiz,
  {
    id: `fancam-${EXAMPLE_FIXTURE_ID}`,
    kind: 'fan_cam',
    title: tx('Fan Cam', 'Camera’r Cefnogwyr'),
    prompt: tx(
      'Send a photo from the ground. A moderator checks every photo before anyone else sees it.',
      'Anfonwch lun o’r maes. Mae cymedrolwr yn gwirio pob llun cyn i neb arall ei weld.',
    ),
    opensAt: minutesAfter(EXAMPLE_KICKOFF, -240),
    closesAt: minutesAfter(EXAMPLE_KICKOFF, 180),
    fixtureId: EXAMPLE_FIXTURE_ID,
    sponsorship: { label: tx('Sponsored', 'Noddir'), partnerName: PARTNER_SLOT },
    requiresSignIn: true,
    demo: true,
    minimumAge: 18,
  },
  {
    id: `fancam-${SIM_FIXTURE_ID}`,
    kind: 'fan_cam',
    title: tx('Fan Cam', 'Camera’r Cefnogwyr'),
    prompt: tx(
      'Send a photo from the ground. A moderator checks every photo before anyone else sees it.',
      'Anfonwch lun o’r maes. Mae cymedrolwr yn gwirio pob llun cyn i neb arall ei weld.',
    ),
    opensAt: minutesAfter(SIM_KICKOFF, -240),
    closesAt: minutesAfter(SIM_KICKOFF, 180),
    fixtureId: SIM_FIXTURE_ID,
    sponsorship: { label: tx('Sponsored', 'Noddir'), partnerName: PARTNER_SLOT },
    requiresSignIn: true,
    demo: true,
    minimumAge: 18,
  },
  {
    id: 'challenge-reaction-wall',
    kind: 'challenge',
    title: tx('Reaction wall challenge', 'Her y wal ymateb'),
    prompt: tx(
      'Visit the Fan Zone activation in the Supporters Village and beat the lights.',
      'Ewch i weithgaredd Parth y Cefnogwyr ym Mhentref y Cefnogwyr a churwch y goleuadau.',
    ),
    opensAt: '2026-11-01T09:00:00Z',
    closesAt: '2027-05-31T00:00:00Z',
    sponsorship: {
      label: tx('Partner activation', 'Gweithgaredd partner'),
      partnerName: PARTNER_SLOT,
    },
    requiresSignIn: false,
    demo: true,
    steps: [
      { id: 'visit', label: tx('Find the reaction wall', 'Dewch o hyd i’r wal ymateb') },
      { id: 'play', label: tx('Have a go', 'Rhowch gynnig arni') },
    ],
    accessibleAlternative: tx(
      'Prefer not to queue or move around the venue? Answer the challenge question from your seat instead and it counts the same.',
    ),
  },
];

export const pollBaseline: Record<string, Record<string, number>> = {
  'poll-looking-forward': { atmosphere: 412, rugby: 356, friends: 188, 'someone-new': 97 },
  [`potm-${SIM_FIXTURE_ID}`]: { n8: 301, n10: 244, n14: 198, n20: 276 },
};

export const storySeed: SupporterStory[] = [
  {
    id: 'ss-generations',
    title: tx('Same seats, forty years on', 'Yr un seddi, ddeugain mlynedd yn ddiweddarach'),
    body: tx('Sample supporter story. Real stories are published with the supporter’s permission.'),
    mediaId: 'generations',
    attribution: tx('Demo supporter story'),
    moderation: 'approved',
    demo: true,
  },
  {
    id: 'ss-meeting',
    title: tx('The usual spot before kick-off', 'Y man arferol cyn y gic gyntaf'),
    body: tx('Sample supporter story. Real stories are published with the supporter’s permission.'),
    mediaId: 'meeting-point',
    attribution: tx('Demo supporter story'),
    moderation: 'approved',
    demo: true,
  },
  {
    id: 'ss-travel',
    title: tx('The walk to the ground', 'Y daith i’r maes'),
    body: tx('Sample supporter story. Real stories are published with the supporter’s permission.'),
    mediaId: 'travel-together',
    attribution: tx('Demo supporter story'),
    moderation: 'approved',
    demo: true,
  },
  {
    id: 'ss-screen',
    title: tx('Made the big screen', 'Ar y sgrin fawr'),
    body: tx('Sample supporter story. Real stories are published with the supporter’s permission.'),
    mediaId: 'big-screen-celebration',
    attribution: tx('Demo supporter story'),
    moderation: 'approved',
    demo: true,
  },
];
