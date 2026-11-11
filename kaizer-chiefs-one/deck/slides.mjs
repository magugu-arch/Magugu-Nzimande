/**
 * The deck's slides, as HTML. Copy lives here; every commercial number comes
 * from figures.mjs.
 *
 * Ground rules carried over from the app brief:
 *  - nothing here is presented as a club figure: scenarios are labelled
 *    illustrative and are replaced with real numbers in discovery;
 *  - no fixtures, scores, prices, member terms or reward values are invented;
 *  - the crest is never drawn: the club's name is typeset;
 *  - every photograph is a concept image and is labelled as one.
 */
import {
  DATED,
  EDITIONS,
  FAMILY,
  FAMILY_ITEMS,
  DAY_RATE,
  MILESTONES,
  PAYBACK_MONTHS,
  PAYBACK_SUPPORTERS,
  RATE_PER_HOUR,
  RUN_HIGH,
  RUN_LOW,
  RUN_PLANNING,
  RUN_YEAR,
  THREE_YEARS,
  VALID_UNTIL,
  YEAR_ONE,
  num,
  payback,
  rand,
} from './figures.mjs';

const DOC = 'Marketing and investment strategy';
const AGENCY = 'LegacyLeverage Creative Agency';

// ---------- Icons (line, 24 x 24) ----------
const svg = (cls, d, extra = '') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ARROW = svg('arrow', '<path d="M5.5 18.5 18.5 5.5M8 5.5h10.5V16"/>');
const I = {
  engine: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M9 6v12M14 10h3M14 14h3"/>',
  megaphone: '<path d="M4 10v4l10 4V6L4 10ZM14 9a3 3 0 0 1 0 6M7 15v3.5"/>',
  flag: '<path d="M6 21V4M6 5h11l-2.5 3.5L17 12H6"/>',
  chart: '<path d="M4 20h16M7 20v-6M12 20V6M17 20v-9"/>',
  calendar:
    '<rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  person: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/>',
  phone: '<rect x="7.5" y="3" width="9" height="18" rx="2.2"/><path d="M11 18h2"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17"/>',
};
const ic = (name) => `<span class="ic">${svg('', I[name])}</span>`;
const GO = svg('go', '<path d="M5.5 18.5 18.5 5.5M8 5.5h10.5V16"/>');

// ---------- Shared pieces ----------
const SECTIONS = [
  ['engine', 'Club engine'],
  ['megaphone', 'Marketing engine'],
  ['flag', 'Launch plan'],
  ['chart', 'Investment'],
];
const nav = (active) =>
  `<div class="nav">${SECTIONS.map(
    ([icon, label], i) =>
      `<span class="chip${i === active ? ' on' : ''}">${ic(icon)}${label}</span>`,
  ).join('')}</div>`;

const top = (section) =>
  `<header class="top"><div class="brand"><i class="dot"></i><b>Kaizer Chiefs One</b><span>· ${DOC}</span></div><div>${section}</div><div class="page">{{page}}</div></header>`;

const head = (eyebrow, title, lede = '') =>
  `<div class="head"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${lede ? `<p class="lede">${lede}</p>` : ''}</div>`;

const card = ({ title, sub, text, numLabel, dark, arrow = true, cls = '' }) =>
  `<section class="card${dark ? ' dark' : ''}${cls ? ` ${cls}` : ''}">${numLabel ? `<p class="num">${numLabel}</p>` : ''}<h3>${title}</h3>${arrow ? ARROW : ''}${sub ? `<p class="sub">${sub}</p>` : ''}${text ? `<p class="txt">${text}</p>` : ''}</section>`;

const points = (items) => `<ul class="pts">${items.map((t) => `<li>${t}</li>`).join('')}</ul>`;

const content = (section, headHtml, body, { note = '', bodyStyle = '' } = {}) =>
  `<section class="slide">${top(section)}${headHtml}<div class="body" style="${bodyStyle}">${body}</div>${note ? `<p class="note">${note}</p>` : ''}</section>`;

const photo = ({
  image,
  alt,
  tl,
  tr,
  title,
  subline,
  cta,
  footer,
  low = false,
  deep = false,
  footStyle = '',
}) =>
  `<section class="slide photo"><div class="frame${low ? ' low' : ''}${deep ? ' deep' : ''}${cta ? ' has-cta' : ''}"><img src="images/${image}.jpg" alt="${alt}"><div class="scrim"></div><div class="tl">${tl}</div><div class="tr">${tr}</div><span class="tag">Concept image</span><h1>${title}</h1><p class="subline">${subline}</p>${cta ? `<div class="cta">${ic('calendar')}<span>${cta}</span>${GO}</div>` : ''}</div><footer class="foot" style="${footStyle}"><div class="mark"><i></i></div>${footer}</footer></section>`;

const strip = (image, alt) =>
  `<div class="strip"><img src="images/${image}.jpg" alt="${alt}"><span class="tag">Concept image</span></div>`;

const CONCEPT_NOTE = 'Concept imagery, not club photography.';

// ---------- 01 Cover ----------
const cover = photo({
  image: 'cover',
  alt: 'A supporter in black and gold laughing in the stands, arms raised. Concept image.',
  tl: DOC,
  tr: 'November 2026',
  title: 'Kaizer Chiefs One —<br>every Khosi, known to the club.',
  subline:
    'A strategy for the app as a commercial engine, and as the club’s own marketing channel.',
  cta: 'Prepared for Kaizer Chiefs',
  footer: `${nav(-1)}<div class="credit">Prepared by ${AGENCY}<br>${DATED} · A proposal, not a club document</div>`,
});

// ---------- 02 Executive summary ----------
const summary = content(
  'Executive summary',
  head(
    'Executive summary',
    'One app. An owned channel that turns<br>support into a known, growing family.',
    'Kaizer Chiefs is built on the people who follow it. The app turns that following into an owned, measurable relationship with every supporter who says yes, so each match, ticket and message becomes the start of the next.',
  ),
  [
    card({
      title: `${rand(FAMILY.price)}<br>to build`,
      text: `Family edition, fixed price excluding VAT. A Matchday edition starts at ${rand(EDITIONS.matchday.price)}.`,
    }),
    card({
      title: `${FAMILY.weeks} weeks<br>to launch`,
      text: `A closed pilot on a test build at week ${FAMILY.pilotWeek}. Both app stores at week ${FAMILY.weeks}.`,
    }),
    card({
      title: 'About R20 a year<br>per known supporter',
      text: `What each of ${num(100000)} known supporters needs to add to recover the build and a year of running costs (illustrative). Under R2 a month.`,
      dark: true,
    }),
    card({
      title: 'App, code<br>and data: the club’s',
      text: 'Transferred to the club on final payment. Supporter data is collected under POPIA, with a clear yes for marketing.',
    }),
    card({
      title: `${rand(RUN_LOW)}–${rand(RUN_HIGH)}<br>a month to run`,
      text: 'Estimated hosting, messaging and store accounts at launch volumes. Data-feed, ticketing and payment fees sit under the club’s own contracts.',
    }),
    card({
      title: `A week-${FAMILY.gateWeek} gate<br>before the build`,
      text: 'Content, match-data, ticketing and membership providers are confirmed before build spend. If they differ, we re-scope with you first.',
    }),
  ].join(''),
  { bodyStyle: 'grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr)' },
);

// ---------- 03 The opportunity ----------
const opportunity = content(
  'The opportunity',
  head(
    'The opportunity',
    'Why an app, and why it creates<br>value beyond matchday',
    'What asset does this money create, and how does it earn? The app is a matchday companion, a membership programme and a marketing channel in one. It compounds: every supporter it gains can be reached again.',
  ),
  [
    [
      'Own the relationship',
      'Social reach is rented and rationed. A supporter who opts in can be reached directly with a fixture, a ticket release or a reward, at almost no cost per message.',
    ],
    [
      'Know who is in the stands',
      'A supporter can back the club for decades without the club ever knowing their name. Tickets, membership and Fan Moments turn a crowd into known supporters, with permission.',
    ],
    [
      'Earn between matchdays',
      'A season has a fixed number of home matches. Match Centre, stories, rewards and the shop give supporters a reason to open the app on the days in between.',
    ],
    [
      'Make partner spend provable',
      'Partners value an audience that can be counted. Opted-in reach and tracked redemptions replace estimates with evidence.',
    ],
    [
      'Evidence, not guesswork',
      'Every link, QR code and campaign carries its source through to the ticket or the sign-up, so the club sees which channel actually fills seats, and spends accordingly.',
    ],
    [
      'The club in their pocket',
      'The club’s voice, photography and matchday feeling, carried into an experience as considered as the stadium itself. Black and gold, with the official crest once supplied.',
    ],
  ]
    .map(([title, text], i) =>
      card({ title, text, numLabel: `0${i + 1}`, dark: i === 2, arrow: false }),
    )
    .join(''),
  { bodyStyle: 'grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr)' },
);

// ---------- 04 Strategy on a page ----------
const SYM = {
  plus: '<path d="M12 4v16M4 12h16"/>',
  times: '<path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"/>',
  up: '<path d="M12 21V4M5 10.5 12 3.5l7 7"/>',
  both: '<path d="M4 8.5h15M15 4.5l4 4-4 4M20 15.5H5M9 11.5l-4 4 4 4"/>',
};
const lever = (sym, title, items, dark = false) =>
  `<section class="card lever${dark ? ' dark' : ''}">${svg('sym', SYM[sym])}<h3>${title}</h3>${points(items)}</section>`;
const strategy = content(
  'The strategy',
  head(
    'The strategy on a page',
    'Four levers of supporter revenue.<br>One app pulls all of them.',
    'Supporter revenue is known supporters × how often they engage × what each is worth, plus what partners pay to reach them. Each part of the app is there to move one of those four numbers, and each is measured.',
  ),
  `<div class="body g4" style="margin:0">${[
    lever('plus', 'More known supporters', [
      'Join from a stadium QR code, a ticket, social or a friend’s share',
      'Guest mode first; sign up when it earns something',
      'Every ticket and membership links to a profile',
    ]),
    lever(
      'times',
      'More days with the club',
      [
        'Match Centre on matchday, stories on the days between',
        'Khosi Rewards that count every verified action',
        'Fan Moments that supporters come back to see',
      ],
      true,
    ),
    lever('up', 'More value per supporter', [
      'Tickets, membership and the shop in one place',
      'Offers by segment, not by blanket discount',
      'Renewal and win-back journeys',
    ]),
    lever('both', 'More value for partners', [
      'Opted-in reach, counted rather than estimated',
      'Offers and redemptions tracked to their source',
      'Aggregated reports; personal data stays with the club',
    ]),
  ].join(
    '',
  )}</div><div class="bar"><span class="pill">Positioning</span><p>For supporters who give the club their weekends, Kaizer Chiefs One is the club that knows them back. <em>The app is how it knows.</em></p></div>`,
  { bodyStyle: 'grid-template-rows:1fr auto' },
);

// ---------- 05 Who it serves ----------
const supporter = (image, alt, title, wants, app, measure, dark = false) =>
  `<section class="card pic${dark ? ' dark' : ''}"><div class="ph" style="height:318px"><img src="images/${image}.jpg" alt="${alt}"></div><h3>${title}</h3><p class="facts">Wants: ${wants}<br>App: ${app}<br><b>Measure: ${measure}</b></p></section>`;
const supporters = content(
  'The supporters',
  head(
    'Who it serves',
    'Six supporters the app is built to serve',
    'Each supporter has a job they want done. The app does it for them, and the club gets a measurable result in return.',
  ),
  [
    supporter(
      'p-regular',
      'Supporters cheering in the stands. Concept image.',
      'The matchday regular',
      'a ticket and no queue.',
      'ticket wallet, matchday guide, reminders.',
      'matches attended',
    ),
    supporter(
      'p-faraway',
      'A player’s boots and the ball on the pitch. Concept image.',
      'The far-away Khosi',
      'to feel close from anywhere.',
      'Match Centre, stories, alerts.',
      'active days a month',
    ),
    supporter(
      'p-family',
      'A child smiling as a football is handed over. Concept image.',
      'The family',
      'a safe, easy day out.',
      'tickets together, safeguarded Fan Moments.',
      'group attendance',
      true,
    ),
    supporter(
      'p-member',
      'An older coach talking with young players. Concept image.',
      'The member',
      'to be recognised.',
      'digital card, rewards, benefits set by the club.',
      'renewals',
    ),
    supporter(
      'p-newgen',
      'Young players seen from behind at a training ground. Concept image.',
      'The next generation',
      'to belong and to share.',
      'Fan Moments, squad, short stories.',
      'sign-ups by source',
    ),
    supporter(
      'p-lapsed',
      'A full stadium seen from the stands at night. Concept image.',
      'The lapsed supporter',
      'a reason to come back.',
      'a win-back note, a big-match reminder.',
      'supporters reactivated',
    ),
  ].join(''),
  {
    bodyStyle: 'grid-template-columns:repeat(6,1fr);gap:16px',
    note: `These segments are working hypotheses. Each is sized from real ticketing, membership and app data during discovery, and campaigns are weighted to the segments that prove largest. ${CONCEPT_NOTE}`,
  },
);

// ---------- 06 Part one ----------
const partOne = photo({
  image: 'part-one',
  alt: 'Players in gold and black joining hands in a huddle. Concept image.',
  tl: 'Part one',
  tr: '{{page}}',
  title: 'What the app does<br>for the club',
  subline:
    'Tickets, membership, rewards, retail and one view of every supporter: the engine that runs underneath the badge.',
  footer: `${nav(0)}<div class="credit">Kaizer Chiefs One<br>${DOC}</div>`,
  low: true,
});

// ---------- 07, 08 Club engine ----------
const engineOne = content(
  'Club engine · 1 of 2',
  head('Club engine', 'Fill the stadium, and know who is in it'),
  `${strip('strip-crowd', 'Supporters cheering in the stands. Concept image.')}<div class="body g3" style="margin:0">${[
    card({
      title: 'Match Centre',
      sub: 'The daily habit',
      text: 'Fixtures, results, squad and live match events from a licensed data feed, each with the time it was last updated. Nothing is shown that the feed has not confirmed.',
    }),
    card({
      title: 'Tickets in the pocket',
      sub: 'Wallet and entry',
      text: 'Tickets from the club’s ticketing partner sit in a wallet. The entry code is issued at the moment it is shown and expires within five minutes, so a screenshot cannot be passed on.',
    }),
    card({
      title: 'Sell beyond the gate',
      sub: 'Membership, shop, rewards',
      text: 'Membership, the official shop and partner rewards sit one tap from the match, so interest on matchday becomes revenue on the days after it.',
      dark: true,
    }),
  ].join('')}</div>`,
  { bodyStyle: 'grid-template-rows:160px 1fr' },
);

const engineTwo = content(
  'Club engine · 2 of 2',
  head('Club engine', 'Bring supporters back, and know who they are'),
  `${strip('strip-hands', 'Hands joined together in a huddle. Concept image.')}<div class="body g3" style="margin:0">${[
    card({
      title: 'Khosi Rewards',
      sub: 'Every verified action',
      text: 'Points for matches attended, purchases and membership, with rules set by the club. Every point sits in an auditable ledger and is never earned twice.',
    }),
    card({
      title: 'One supporter, one profile',
      sub: 'With consent',
      text: 'Tickets, membership, preferences and rewards in one place, with marketing consent recorded per channel under POPIA. Supporters see and change what they receive.',
    }),
    card({
      title: 'Fan Moments, moderated',
      sub: 'Reviewed before publishing',
      text: 'Supporters share photos and short videos from the stands. Each one is reviewed by the club before anyone else sees it, and anything showing children goes to a safeguarding check.',
      dark: true,
    }),
  ].join('')}</div>`,
  { bodyStyle: 'grid-template-rows:160px 1fr' },
);

// ---------- 09 The supporter journey ----------
const step = (n, title, does, gets, dark = false) =>
  `<section class="card step${dark ? ' dark' : ''}"><p class="n">${n}</p><h3>${title}</h3><p class="io"><b>Supporter</b>${does}<b class="gets">The club gets</b>${gets}</p></section>`;
const journey = content(
  'The supporter journey',
  head(
    'The supporter journey',
    'From first tap to next matchday,<br>one connected flow',
    'Each step is something the supporter wants to do. Each one also hands the club something it can use: a source, a known supporter, a filled seat, a reason to return.',
  ),
  `<div class="body g7" style="margin:0">${[
    step(
      '01',
      'Discover',
      'Finds the app from a stadium QR code, social or a friend’s share.',
      'The source of every sign-up.',
    ),
    step(
      '02',
      'Join',
      'Browses as a guest, then signs up when it earns something.',
      'A known supporter, with consent.',
    ),
    step(
      '03',
      'Follow',
      'Checks fixtures, squad and stories through the week.',
      'A daily habit, measured.',
    ),
    step(
      '04',
      'Book',
      'Gets a ticket through the club’s ticketing partner.',
      'A seat sold, linked to a profile.',
    ),
    step(
      '05',
      'Attend',
      'Shows the entry code at the gate and shares a moment.',
      'A verified attendance.',
      true,
    ),
    step(
      '06',
      'Reward',
      'Earns points and sees what they unlock.',
      'A reason to return, without discounting.',
    ),
    step(
      '07',
      'Return',
      'Comes back for the next match, a renewal or the shop.',
      'Repeat attendance and spend, measured.',
    ),
  ].join(
    '',
  )}</div><div class="bar"><span class="pill">Underneath</span><p>Every step writes to one supporter record and one event stream. <em>That is how a ticket triggers its reminder, an attendance earns its points and a campaign proves it worked.</em></p></div>`,
  { bodyStyle: 'grid-template-rows:1fr auto' },
);

// ---------- 10 The staff console ----------
const consoleSlide = content(
  'Operations',
  head(
    'One console for the club',
    'Run the club’s channel<br>from one screen',
    'Staff manage content, moderation and campaigns in one place, with every action checked against their role and written to an audit log.',
  ),
  `<section class="card shotcard"><div class="shot"><img src="screens/console-dashboard.jpg" alt="The staff console dashboard: items awaiting review, safeguarding holds, open reports and the health of each integration, all marked as demo data."></div><p class="caption">Working concept · Staff console · Sample data</p></section><div class="body" style="margin:0;grid-template-rows:repeat(3,1fr)">${[
    card({
      title: 'Content and campaigns',
      text: 'Stories and notifications are drafted, scheduled and published by the roles allowed to. One dashboard shows the health of every provider.',
    }),
    card({
      title: 'Moderation and safeguarding',
      text: 'A review queue for Fan Moments: approve, reject, hide or escalate. Every decision needs a reason.',
    }),
    card({
      title: 'Every action on the record',
      text: 'Five staff roles, enforced on the server and again in the database. The audit log can be read, never edited.',
      dark: true,
    }),
  ].join('')}</div>`,
  { bodyStyle: 'grid-template-columns:1.92fr 1fr' },
);

// ---------- 11 Part two ----------
const partTwo = photo({
  image: 'part-two',
  alt: 'A crowd of supporters in black and gold cheering. Concept image.',
  tl: 'Part two',
  tr: '{{page}}',
  title: 'The app as the club’s<br>own marketing channel',
  subline:
    'Every match, ticket and shared moment is designed to bring in the next supporter, and to show the club exactly where they came from.',
  footer: `${nav(1)}<div class="credit">Kaizer Chiefs One<br>${DOC}</div>`,
  deep: true,
});

// ---------- 12 Marketing engine ----------
const marketing = content(
  'Marketing engine',
  head(
    'Marketing engine',
    'Six ways the app markets<br>the club, every day',
    'An app is usually treated as a cost of service. Built well, it is the most efficient marketing channel a club can own.',
  ),
  [
    [
      'Every matchday is a sign-up day',
      'A QR code on the big screen, the seat and the ticket: “Join and earn for today’s match.” The best moment to ask is when the supporter is already in the stands.',
    ],
    [
      'Supporters become known',
      'Guest mode lets anyone in. Tickets, rewards and Fan Moments each give a reason to create a profile, so the known base grows with every match.',
    ],
    [
      'Fan Moments that recruit',
      'An approved moment is made to be shared. Each share carries the club, and a tracked link, into a supporter’s own circle.',
    ],
    [
      'One page, one action',
      'Campaign pages for matchday, membership, a kit launch and rewards, each with one button and a tracked link for social, email, QR and WhatsApp.',
    ],
    [
      'Reach without rent',
      'Push, in-app and email reach opted-in supporters at almost no cost per message, with frequency caps and quiet hours so every message is welcome.',
    ],
    [
      'Partners, proven',
      'Partner offers inside Khosi Rewards are counted from view to redemption, so the club reports results to a sponsor rather than impressions.',
    ],
  ]
    .map(([title, text], i) =>
      card({ title, text, numLabel: `0${i + 1}`, dark: i === 1, arrow: false }),
    )
    .join(''),
  { bodyStyle: 'grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr)' },
);

// ---------- 13 The self-marketing loop ----------
const LOOP = { w: 760, h: 600, cx: 380, cy: 300, r: 218 };
const at = (deg, r = LOOP.r) => [
  LOOP.cx + r * Math.cos((deg * Math.PI) / 180),
  LOOP.cy + r * Math.sin((deg * Math.PI) / 180),
];
const loopNodes = [
  'Join',
  'Follow the match',
  'Attend and scan',
  'Earn and return',
  'Share a moment',
  'A new Khosi joins',
];
const loopSvg = (() => {
  const arcs = loopNodes
    .map((_, i) => {
      const a0 = -90 + i * 60 + 19;
      const a1 = -90 + i * 60 + 41;
      const [x0, y0] = at(a0);
      const [x1, y1] = at(a1);
      return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${LOOP.r} ${LOOP.r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" marker-end="url(#tip)"/>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${LOOP.w} ${LOOP.h}" aria-hidden="true"><defs><marker id="tip" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#7d5a0b"/></marker></defs><circle cx="${LOOP.cx}" cy="${LOOP.cy}" r="${LOOP.r}" fill="none" stroke="rgba(26,25,23,.14)" stroke-width="1.5"/><g fill="none" stroke="#7d5a0b" stroke-width="2.2">${arcs}</g></svg>`;
})();
const loop = content(
  'The self-marketing loop',
  head('The self-marketing loop', 'Each supporter brings in the next one'),
  `<section class="card loop"><div style="position:relative;width:${LOOP.w}px;height:${LOOP.h}px;display:grid;place-items:center">${loopSvg}${loopNodes
    .map((label, i) => {
      const [x, y] = at(-90 + i * 60);
      const cls = i === 0 ? ' first' : i === loopNodes.length - 1 ? ' last' : '';
      return `<span class="node${cls}" style="left:${x.toFixed(1)}px;top:${y.toFixed(1)}px">${i + 1} · ${label}</span>`;
    })
    .join(
      '',
    )}<p class="centre">One Khosi in,<em>many returns</em></p></div></section><div class="body" style="margin:0;grid-template-rows:1.25fr 1fr 1fr">${[
    card({
      title: 'How it compounds',
      text: 'Paid media buys a supporter’s attention once. The loop keeps what the first sign-up earned: the match, the reward and the shared moment each carry the club to someone new. The app tracks every turn, so the club can see which step to strengthen.',
      dark: true,
    }),
    card({
      title: 'A ticket is rarely for one',
      text: 'Supporters come in groups. Each ticket passed to a friend or a family member is an invitation to join.',
    }),
    card({
      title: 'A moment is an invitation',
      text: 'The supporter does the telling. The club’s moderation keeps it safe.',
    }),
  ].join('')}</div>`,
  { bodyStyle: 'grid-template-columns:1.16fr 1fr' },
);

// ---------- 14 Campaign playbook ----------
const campaign = (image, alt, title, rows, dark = false) =>
  `<section class="card pic${dark ? ' dark' : ''}"><div class="ph" style="height:296px"><img src="images/${image}.jpg" alt="${alt}"></div><h3>${title}</h3><dl>${rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join('')}</dl></section>`;
const campaigns = content(
  'Campaign playbook',
  head(
    'Campaign playbook',
    'Five campaigns, ready for the season',
    'Each campaign has one job, one audience and one button. Together they cover the match week, the season and the retail year.',
  ),
  [
    campaign('c-matchday', 'A full stadium at night. Concept image.', 'Matchday countdown', [
      ['Goal', 'Fill the home match'],
      ['Who', 'Supporters within reach of the stadium'],
      ['Where', 'Push, social, WhatsApp share'],
      ['Measure', 'Tickets by source'],
    ]),
    campaign(
      'c-membership',
      'A supporter laughing in the stands. Concept image.',
      'Membership drive',
      [
        ['Goal', 'New and renewed members'],
        ['Who', 'Known supporters without a card'],
        ['Where', 'In-app, email'],
        ['Measure', 'Members linked, renewals'],
      ],
    ),
    campaign(
      'c-moment',
      'A supporter shown on the stadium big screen. Concept image.',
      'Fan Moment of the week',
      [
        ['Goal', 'Sharing that recruits'],
        ['Who', 'Supporters who attended'],
        ['Where', 'In-app, social'],
        ['Measure', 'Shares, new sign-ups'],
      ],
      true,
    ),
    campaign('c-kit', 'Players in black and gold kit in a tunnel. Concept image.', 'Kit launch', [
      ['Goal', 'Retail sales, a first look'],
      ['Who', 'Rewards members first'],
      ['Where', 'Push, in-app, email'],
      ['Measure', 'Shop visits, sales by source'],
    ]),
    campaign('c-bring', 'Players joining hands. Concept image.', 'Bring a Khosi', [
      ['Goal', 'New supporters, invited'],
      ['Who', 'Regulars and families'],
      ['Where', 'WhatsApp, stadium QR'],
      ['Measure', 'Invites accepted'],
    ]),
  ].join(''),
  {
    bodyStyle: 'grid-template-columns:repeat(5,1fr)',
    note: `Sample campaign structures. Final copy, offers, prices and dates are written with and approved by the club before anything goes live. ${CONCEPT_NOTE}`,
  },
);

// ---------- 15 Lifecycle journeys ----------
const stop = (title, when, channels, marketingMsg = false) =>
  `<div><i${marketingMsg ? ' class="mk"' : ''}></i><h4>${title}</h4><p>${when}</p><small>${channels}</small></div>`;
const msg = (when, title, text, marketingMsg = false) =>
  `<div class="msg"><div class="from"><span class="app">KC</span><span>KC One</span><span class="when${marketingMsg ? ' mk' : ''}">${when}</span></div><b>${title}</b><p>${text}</p></div>`;
const lifecycle = content(
  'Lifecycle journeys',
  head('Lifecycle journeys', 'The right message at the right<br>moment, and never one too many'),
  `<section class="card life"><div class="legend"><span><i></i>Service message: always sent</span><span><i class="mk"></i>Marketing message: only with consent</span></div><div class="track">${[
    stop('Welcome', 'When a supporter opts in', 'Email · Push', true),
    stop('Match reminder', 'For fixtures they follow', 'Push'),
    stop('Ticket ready', 'When a ticket is issued', 'In-app · Email · Push'),
    stop('Thank you', 'After a verified attendance', 'In-app · Email'),
    stop('Reward earned or expiring', 'On earn, before expiry', 'In-app · Push · Email'),
    stop('Renewal', 'Before a membership lapses', 'Email · Push', true),
    stop('Win-back', 'After a quiet spell the club sets', 'Email · Push · WhatsApp*', true),
  ].join(
    '',
  )}</div><p class="label" style="margin-top:auto">What supporters receive</p><div class="msgs">${[
    msg(
      'Now',
      'Your ticket is ready',
      'Kaizer Chiefs v Opponent A. Your ticket is in your wallet. Show the entry code at the gate.',
    ),
    msg(
      'Day before',
      'Matchday tomorrow',
      'Kick-off and gate details are in the app. Your entry code appears when you arrive.',
    ),
    msg(
      'Full-time',
      'Thank you for being there',
      'Your attendance has been added to Khosi Rewards. See what it unlocks.',
    ),
    msg(
      'With consent',
      'It has been a while',
      'The next home match is coming up. Your seat is a few taps away.',
      true,
    ),
  ].join(
    '',
  )}</div><p class="note">Sample messages with a placeholder fixture; final wording, reward values and timings are set by the club. *WhatsApp and SMS switch on only once the club approves the provider, the sender, the templates and the consent wording.</p></section><section class="card dark"><h3>Guardrails, built in</h3>${ARROW}${points(
    [
      'Consent recorded per channel and purpose, with wording and version',
      'A global suppression list, checked again just before every send',
      'Frequency caps and quiet hours',
      'Every campaign approved by a second person',
      'Service messages never carry promotions',
      'One-tap opt-out, honoured immediately',
    ],
  )}</section>`,
  { bodyStyle: 'grid-template-columns:2.05fr 1fr' },
);

// ---------- 16 Partner value ----------
const partner = (title, items, dark = false) =>
  `<section class="card lever${dark ? ' dark' : ''}"><h3>${title}</h3>${points(items)}</section>`;
const partners = content(
  'Partner value',
  head(
    'Partner value',
    'A known audience is worth more<br>to every partner',
    'Sponsorship is sold on reach. The app lets the club sell results as well: how many opted-in supporters saw an offer, and how many acted on it.',
  ),
  `<div class="body g4" style="margin:0">${[
    partner('Counted reach', [
      'Opted-in supporters by segment and region',
      'Real numbers, not follower counts',
      'Reported for every campaign',
    ]),
    partner('Proven response', [
      'Offers tracked from view to redemption',
      'QR and link attribution, at the stadium and online',
      'Holdout groups show what a campaign added',
    ]),
    partner('New inventory', [
      'Placements in the rewards catalogue',
      'Matchday moments and story series',
      'Every partner placement labelled as one',
    ]),
    partner(
      'The club keeps the data',
      [
        'Partners receive aggregated reports only',
        'Personal data is never sold or handed over',
        'Consent per purpose, under POPIA',
        'Every partner and offer approved by the club',
      ],
      true,
    ),
  ].join(
    '',
  )}</div><div class="bar"><span class="pill">Principle</span><p>Partners buy access to an audience through the club, never the audience itself. <em>That is what keeps supporters opted in.</em></p></div>`,
  { bodyStyle: 'grid-template-rows:1fr auto' },
);

// ---------- 17 Launch marketing ----------
const phase = (when, title, items, dark = false) =>
  `<section class="card${dark ? ' dark' : ''}"><p class="num">${when}</p><h3>${title}</h3>${ARROW}${points(items)}</section>`;
const launch = content(
  'Launch marketing',
  head(
    'Launch marketing',
    'The first 90 days: seed,<br>launch, compound',
    'Launches fail quietly when the app is ready but the stadium is not. The plan starts with the people at the gates, not with an advert.',
  ),
  `${strip('strip-pitch', 'A player’s boots and the ball on the pitch. Concept image.')}<div class="body g3" style="margin:0">${[
    phase('Weeks −6 to 0', 'Seed', [
      'A briefing for stewards, ticket office and shop staff',
      'QR codes on tickets, seats and the big screen, tracked by location',
      'Links on the club’s website and social profiles',
      'App Store and Google Play listings, screenshots and privacy labels',
      'A first look for supporters who already said yes to email',
    ]),
    phase(
      'Days 1 to 30',
      'Launch',
      [
        'A home match as launch day',
        'A founding-supporter welcome, value set by the club',
        '“Scan to join” at every gate and on the big screen',
        'Launch content from approved photography, with tracked links',
        'A weekly review: fix whatever slows supporters down',
      ],
      true,
    ),
    phase('Days 31 to 90', 'Compound', [
      'Rotate the five campaigns around the fixture list',
      'A membership drive to known supporters',
      'Post-match and win-back journeys on, after legal sign-off',
      'A/B tests on campaign pages, with holdout groups',
      'A 90-day review: move spend to the channels that fill seats',
    ]),
  ].join('')}</div>`,
  { bodyStyle: 'grid-template-rows:156px 1fr' },
);

// ---------- 18 Proof ----------
const phoneShot = (file, label, alt) =>
  `<figure><div class="phone"><img src="screens/${file}.jpg" alt="${alt}"></div><figcaption>${label}</figcaption></figure>`;
const proof = content(
  'Proof before payment',
  head(
    'Proof before payment',
    'The app already works. This<br>investment takes it live.',
    'A working concept built from the product brief, running on labelled demo data. The build starts here, not from a blank page.',
  ),
  `<div class="phones">${[
    phoneShot(
      'phone-home',
      'Home',
      'The Home screen: One club. One family. A labelled concept image and demo content.',
    ),
    phoneShot('phone-match', 'Match', 'The Match screen with placeholder fixtures marked as demo.'),
    phoneShot(
      'phone-fan',
      'Fan Moments',
      'The Fan Moments screen: share a moment, reviewed before publishing.',
    ),
    phoneShot(
      'phone-tickets',
      'Ticket wallet',
      'The ticket wallet with a demo ticket marked not valid for entry.',
    ),
    phoneShot(
      'phone-membership',
      'Membership',
      'The digital membership screen, not linked in the demo.',
    ),
    phoneShot('phone-rewards', 'Khosi Rewards', 'The Khosi Rewards screen with no demo balance.'),
  ].join('')}</div><div class="body g4" style="margin:0">${[
    ['132 automated tests', 'Design tokens, data contracts, app, console and database policies.'],
    ['30 screens checked', 'Every route rendered at two phone widths.'],
    ['37 data-access tests', 'Supporters cannot read or change each other’s data.'],
    ['One offline file', 'The whole concept in 1.5 MB, shared by WhatsApp or email.'],
  ]
    .map(([title, text], i) => card({ title, text, dark: i === 3, arrow: false, cls: 'stat' }))
    .join('')}</div>`,
  { bodyStyle: 'grid-template-rows:auto 1fr;gap:20px' },
);

// ---------- 19 Investment options ----------
const edition = (key, text, recommended = false) => {
  const e = EDITIONS[key];
  return `<section class="card${recommended ? ' dark' : ''}"><h3 style="display:flex;align-items:center;gap:16px">${e.name}${recommended ? '<span class="pill" style="padding:7px 12px 6px;border-radius:99px;background:rgba(224,180,60,.2);font-size:10.5px;font-weight:600;letter-spacing:.19em;color:var(--gold)">Recommended</span>' : ''}</h3>${ARROW}<p style="margin-top:12px;font-size:44px;font-weight:600;line-height:1;letter-spacing:-.01em;font-variant-numeric:tabular-nums">${rand(e.price)}</p><p class="sub">${e.days} days · Live in ${e.weeks} weeks</p><p class="txt" style="max-width:430px">${text}</p></section>`;
};
const options = content(
  'Investment options',
  head('Investment options', 'Three ways to start.<br>We recommend Family.'),
  `${strip('strip-ball', 'A football handed from one pair of hands to another. Concept image.')}<div class="body g3" style="margin:0">${[
    edition(
      'matchday',
      'Native apps on the App Store and Google Play. News and stories from the club’s CMS, Match Centre on a licensed data feed, ticket handoff to the ticketing partner, notifications with consent, and the staff console.',
    ),
    edition(
      'family',
      'Everything in Matchday, plus the ticket wallet, digital membership, Khosi Rewards with partner offers, Fan Moments with moderation, shop integration, lifecycle journeys, and campaign pages with attribution.',
      true,
    ),
    edition(
      'nation',
      'Everything in Family, plus in-app payments once a provider is approved, partner reporting tools, CRM and data-warehouse integration, additional languages, and a data-light matchday mode.',
    ),
  ].join('')}</div>`,
  {
    bodyStyle: 'grid-template-rows:156px 1fr',
    note: `Fixed prices excluding VAT, at the same senior rate as our current proposals (R${RATE_PER_HOUR} an hour), confirmed at the week-${FAMILY.gateWeek} gate. Valid until ${VALID_UNTIL}.`,
  },
);

// ---------- 20 The costing ----------
const costRows = (items, offset) =>
  items
    .map(
      ([name, covers, days], i) =>
        `<tr><td>${String(offset + i + 1).padStart(2, '0')}</td><td><b>${name}</b><span>${covers}</span></td><td class="r d">${days}</td><td class="r p">${rand(days * DAY_RATE)}</td></tr>`,
    )
    .join('');
const costTable = (items, offset) =>
  `<section class="card tcard"><table class="cost"><thead><tr><th></th><th>Deliverable</th><th class="r">Days</th><th class="r">Price</th></tr></thead><tbody>${costRows(items, offset)}</tbody></table></section>`;
const costing = content(
  'The costing',
  head('The costing', `Family edition, ${rand(FAMILY.price)}, itemised`),
  `<div class="body" style="margin:0;grid-template-columns:1fr 1fr">${costTable(FAMILY_ITEMS.slice(0, 8), 0)}${costTable(FAMILY_ITEMS.slice(8), 8)}</div><section class="card dark totals"><div><small>Subtotal</small><div>${FAMILY.days} days · ${rand(FAMILY.subtotal)}</div></div><div><small>Rounding</small><div>${rand(FAMILY.rounding)}</div></div><div><small>VAT at 15%, if applicable</small><div>${rand(FAMILY.vat)}</div></div><div class="grand"><small>Total, fixed price, excluding VAT</small><div>${rand(FAMILY.price)}</div></div></section>`,
  {
    bodyStyle: 'grid-template-rows:1fr auto',
    note: `Effort is in person-days for a senior team: ${num(FAMILY.hours)} hours at R${RATE_PER_HOUR} an hour. The Matchday edition is ${EDITIONS.matchday.days} days; the Nation edition is ${EDITIONS.nation.days} days.`,
  },
);

// ---------- 21 Cost of ownership ----------
const ownership = content(
  'Cost of ownership',
  head(
    'Cost of ownership',
    'What it costs to build,<br>run and own',
    'The build is paid once. Running costs grow with supporters, and some costs sit with the club’s own suppliers. All three are shown, so the full picture is clear before signature.',
  ),
  `<section class="card tcard"><h4>Three-year view, Family edition</h4><table class="own" style="margin-top:20px"><thead><tr><th>Year</th><th class="r">Build</th><th class="r">Run</th><th class="r">Total</th></tr></thead><tbody><tr><td><b>Year one</b><small>Build, launch and a year of running</small></td><td class="r">${rand(FAMILY.price)}</td><td class="r">${rand(RUN_YEAR)}</td><td class="r">${rand(YEAR_ONE)}</td></tr><tr><td><b>Year two</b><small>Running costs only</small></td><td class="r">–</td><td class="r">${rand(RUN_YEAR)}</td><td class="r">${rand(RUN_YEAR)}</td></tr><tr><td><b>Year three</b><small>Running costs only</small></td><td class="r">–</td><td class="r">${rand(RUN_YEAR)}</td><td class="r">${rand(RUN_YEAR)}</td></tr><tr class="sum"><td><b>Three years</b></td><td class="r">${rand(FAMILY.price)}</td><td class="r">${rand(RUN_YEAR * 3)}</td><td class="r">${rand(THREE_YEARS)}</td></tr></tbody></table><p class="note" style="margin-top:auto">Running costs use a planning figure of ${rand(RUN_PLANNING)} a month, inside the estimated range of ${rand(RUN_LOW)}–${rand(RUN_HIGH)} at launch volumes, and are confirmed in discovery. Excluding VAT. Third-party prices are set by those suppliers. New features after launch are quoted separately, at the same rate, only if the club wants them.</p></section><div class="body" style="margin:0;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr">${[
    card({
      title: 'Build, once',
      text: `${rand(FAMILY.price)} fixed, in four milestone payments. Includes 30 days of hypercare and handover.`,
    }),
    card({
      title: 'Run, monthly',
      text: `${rand(RUN_LOW)}–${rand(RUN_HIGH)} estimated: hosting and database, push and email delivery, monitoring and build services, billed at cost to accounts in the club’s name.`,
    }),
    card({
      title: 'Under the club’s own contracts',
      text: 'Match-data licence, ticketing and payment fees, SMS or WhatsApp sending, and the Apple and Google developer accounts. Not included; confirmed in discovery.',
    }),
    card({
      title: 'The club’s team',
      text: 'An editor for content, moderators on matchdays and a campaign owner. The console is built so the club’s communications staff can run it.',
      dark: true,
    }),
  ].join('')}</div>`,
  { bodyStyle: 'grid-template-columns:1fr 1.06fr' },
);

// ---------- 22 Return on investment ----------
const roiRows = PAYBACK_SUPPORTERS.map(
  (s) =>
    `<tr><td>${num(s)}</td>${PAYBACK_MONTHS.map((m) => `<td class="r${s === 100000 && m === 12 ? ' hl' : ''}">${rand(payback(s, m))}</td>`).join('')}</tr>`,
).join('');
const returns = content(
  'Return on investment',
  head(
    'Return on investment',
    'The app pays for itself at about<br>R20 a year per known supporter',
    'Break-even is simple arithmetic: the cost divided by the supporters the club can reach. The table shows what each known supporter needs to contribute, across a range of scenarios.',
  ),
  `<section class="card tcard"><h4>Contribution needed per known supporter, per year</h4><table class="roi" style="margin-top:20px"><thead><tr><th>Known supporters</th>${PAYBACK_MONTHS.map((m) => `<th class="r">Recover in ${m} months</th>`).join('')}</tr></thead><tbody>${roiRows}</tbody></table><p class="note" style="margin-top:auto">Contribution needed = (${rand(FAMILY.price)} build + ${rand(RUN_PLANNING)} a month to run, over the period) ÷ years ÷ known supporters, rounded to the rand. Contribution is revenue less the direct cost of earning it. The supporter numbers are illustrative scenarios, not club figures or forecasts, and are replaced with real numbers in discovery. Count only contribution that would not have happened without the app, measured with holdout groups.</p></section>${card(
    {
      title: 'In the middle case:<br>under R2 a month each',
      text: `With ${num(100000)} known supporters, each needs to add about R20 of contribution in year one to recover the build and a year of running costs. Everything above that is return, and the base keeps growing.`,
      dark: true,
    },
  )}<div class="body g4" style="margin:0;grid-column:1 / -1">${[
    'Stronger partner renewals',
    'Lower cost to reach supporters',
    'Attendance planned ahead',
    'Supporter data the club owns',
  ]
    .map(
      (t) =>
        `<section class="card mini"><p class="sub">Value beyond payback</p><h3>${t}</h3></section>`,
    )
    .join('')}</div>`,
  { bodyStyle: 'grid-template-columns:1.55fr 1fr;grid-template-rows:1fr auto' },
);

// ---------- 23 Timeline and payments ----------
const WEEKS = 28;
const lane = (name, sub, start, end, kind = '') =>
  `<div class="name">${name}${sub ? `<small>${sub}</small>` : ''}</div><div class="lane"><i${kind ? ` class="${kind}"` : ''} style="left:calc(${((start - 1) / WEEKS) * 100}% + 2px);width:calc(${((end - start + 1) / WEEKS) * 100}% - 5px)"></i></div>`;
const timeline = content(
  'Timeline and payments',
  head('Timeline and payments', 'Twenty-four weeks to launch,<br>with a gate before the build'),
  `<section class="card tcard"><div class="gantt"><div></div>${Array.from({ length: WEEKS }, (_, i) => `<div class="wk">${i + 1}</div>`).join('')}${[
    lane('Discovery and providers', 'Gate: go / re-scope', 1, FAMILY.gateWeek, 'gate'),
    lane('Brand system and design', '', 2, 6),
    lane('Identity, content, Match Centre', '', 4, 12),
    lane('Tickets, membership, rewards', '', 8, 17),
    lane('Fan Moments, journeys, console', '', 10, 18),
    lane('Campaigns, attribution, kit', '', 14, 20),
    lane(
      'Closed pilot on a test build',
      'Milestone 2',
      FAMILY.pilotWeek,
      FAMILY.pilotWeek + 1,
      'gate',
    ),
    lane('Quality, load and store review', '', 19, 23),
    lane(
      'Public launch, both stores',
      'Milestone 3 · Launch campaign',
      FAMILY.weeks,
      FAMILY.weeks,
      'gate',
    ),
    lane('Hypercare, 30 days', 'Milestone 4', FAMILY.weeks + 1, FAMILY.hypercareEndWeek, 'care'),
  ].join(
    '',
  )}</div><p class="note" style="margin-top:auto">Weeks from signature. Gold bars mark the points where the club sees and approves progress. Plan the signature date so that the launch lands on a home match.</p></section><div class="body" style="margin:0;grid-template-rows:1fr auto"><section class="card tcard"><h4>Four milestone payments</h4><table class="pay" style="margin-top:16px"><thead><tr><th>Milestone</th><th class="r">Share</th><th class="r">Amount</th></tr></thead><tbody>${MILESTONES.map(
    (m) =>
      `<tr><td><b>${m.name}</b><span>${m.when}</span></td><td class="r">${Math.round(m.share * 100)}%</td><td class="r">${rand(m.amount)}</td></tr>`,
  ).join(
    '',
  )}<tr class="sum"><td><b>Total</b></td><td class="r">100%</td><td class="r">${rand(FAMILY.price)}</td></tr></tbody></table></section>${card(
    {
      title: 'Nothing is paid for work you have not seen',
      text: 'After the first payment, each one follows something the club can use: a test build on its own phones, the app live in both stores, and a month of live operation.',
      dark: true,
      arrow: false,
      cls: 'stat',
    },
  )}</div>`,
  { bodyStyle: 'grid-template-columns:1.6fr 1fr' },
);

// ---------- 24 Measurement ----------
const measurement = content(
  'Measurement',
  head(
    'Measurement',
    'Measured monthly, from day one',
    'Business outcomes, not vanity metrics. Baselines are measured in month one, targets are agreed with the club in discovery, and every estimate is labelled as one.',
  ),
  [
    [
      'Sign-ups<br>by source',
      'New profiles by QR code, link, campaign and share, so spend follows what works.',
    ],
    [
      'Active days<br>per supporter',
      'The days each known supporter opens the app in a month, on matchdays and between them.',
    ],
    [
      'Known-supporter<br>base',
      'Supporters with a profile and a recorded yes. The north-star measure of this strategy.',
    ],
    [
      'Matchday<br>conversion',
      'Tickets issued to known supporters, and attendances verified at the gate, by campaign.',
    ],
    [
      'Opt-in and<br>opt-out',
      'Consent gained and withdrawn, per channel. A rising opt-out rate means fewer, better messages.',
    ],
    [
      'Incremental<br>revenue',
      'Proven with holdout groups and agreed attribution windows, never claimed from last click alone.',
    ],
  ]
    .map(([title, text], i) => card({ title, text, dark: i === 2 }))
    .join(''),
  { bodyStyle: 'grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr)' },
);

// ---------- 25 Protection ----------
const protection = content(
  'Protection',
  head('Protection', 'How the investment is protected'),
  `<section class="card tcard"><table class="risk"><thead><tr><th>Risk</th><th>How we manage it</th></tr></thead><tbody>${[
    [
      'Providers differ from our assumption',
      `Week-${FAMILY.gateWeek} gate: content, match-data, ticketing and membership providers, their APIs and test access are confirmed before build spend, and re-scoped with you if needed.`,
    ],
    [
      'Low adoption after launch',
      'Stadium QR codes, a briefing at the gates, a founding-supporter welcome and tracked campaigns drive sign-ups. The console shows what is working every week.',
    ],
    [
      'Supporters feel over-messaged',
      'Consent per channel, frequency caps, quiet hours and one-tap opt-out. The opt-out rate is a reported measure.',
    ],
    [
      'Privacy and POPIA',
      'Data is minimised, consent is recorded with its wording and version, and marketing is switched on only after the club’s legal sign-off.',
    ],
    [
      'Brand and image rights',
      'Only the club’s approved crest, kit marks and licensed photography ship. Concept imagery stays labelled until it is replaced.',
    ],
    [
      'Matchday peaks',
      'Load tests at kick-off volumes before launch, and the last confirmed match data stays on screen, with its time, if the stadium signal drops.',
    ],
    [
      'Scope grows during the build',
      'Fixed price for the listed scope. Anything new goes through a written change request with its own price, approved first.',
    ],
    [
      'App store review delays',
      'Store rules are built in from the start, two weeks are planned for review, and the apps are submitted under the club’s own developer accounts.',
    ],
  ]
    .map(([risk, how]) => `<tr><td>${risk}</td><td>${how}</td></tr>`)
    .join(
      '',
    )}</tbody></table></section><section class="card dark"><h3>What this rests on</h3>${ARROW}${points(
    [
      `The club confirms its content, match-data, ticketing and membership providers by week ${FAMILY.gateWeek}`,
      'The club supplies its approved crest, CI manual and licensed photography',
      'Apple, Google and messaging accounts open in the club’s name, paid at cost',
      'Fixtures, scores, prices and member status always come from the club’s systems',
      'English at launch',
      'On final payment, the club owns the code, designs and data',
    ],
  )}</section>`,
  { bodyStyle: 'grid-template-columns:1.82fr 1fr' },
);

// ---------- 26 Next step ----------
const contact = (icon, label) => `<span class="chip">${ic(icon)}${label}</span>`;
const next = photo({
  image: 'closing',
  alt: 'Two coaches crouching to talk with young players at sunset. Concept image.',
  tl: 'Next step',
  tr: 'To talk',
  title: 'See the working app —<br>here and now.',
  subline: `Approve the Family edition and discovery starts within five working days. Nothing beyond it is spent until the week-${FAMILY.gateWeek} gate confirms the plan.`,
  cta: 'Book a walkthrough',
  footer: `<div class="nav" style="gap:14px;justify-content:center">${[
    contact('person', 'Magugu S. Nzimande · Founder &amp; CEO'),
    contact('phone', '+27 73 225 7761'),
    contact('mail', 'info@legacyleverage.co.za'),
    contact('globe', 'www.legacyleverage.co.za'),
  ].join(
    '',
  )}</div><div class="credit">Concept imagery · Sample content<br>Not a club document · {{page}}</div>`,
  low: true,
  footStyle: 'grid-template-columns:auto 1fr auto;gap:22px',
});

export const SLIDES = [
  cover,
  summary,
  opportunity,
  strategy,
  supporters,
  partOne,
  engineOne,
  engineTwo,
  journey,
  consoleSlide,
  partTwo,
  marketing,
  loop,
  campaigns,
  lifecycle,
  partners,
  launch,
  proof,
  options,
  costing,
  ownership,
  returns,
  timeline,
  measurement,
  protection,
  next,
];

export const TITLE = 'Kaizer Chiefs One: Marketing and Investment Strategy';
export const DESCRIPTION =
  'A proposal for the Kaizer Chiefs One App: what it does for the club, how it markets itself, the launch plan, the costings and the return. Not an official club document.';

export function html() {
  const total = SLIDES.length;
  const pages = SLIDES.map((s, i) =>
    s.replaceAll('{{page}}', `${String(i + 1).padStart(2, '0')} / ${total}`),
  ).join('\n');
  return `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta name="author" content="${AGENCY}">
<link rel="stylesheet" href="deck.css">
</head>
<body>
${pages}
</body>
</html>
`;
}
