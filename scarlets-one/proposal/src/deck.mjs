// Writes the proposal deck as one HTML page, 28 slides of 1920 x 1080.
// render.mjs prints it to PDF. All numbers come from data.mjs.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  disciplineBars,
  k,
  money,
  ownershipBars,
  ownershipLegend,
  partnerBars,
  returnLegend,
  returnLines,
  waterfall,
} from './charts.mjs';
import {
  DAY_RATE,
  HOME_MATCHES,
  PROPOSER,
  TODAY,
  currency,
  audit,
  build,
  deliverables,
  partnerCases,
  partners,
  payments,
  phases,
  returns,
  roleTotals,
  roles,
  running,
  runningMonthly,
  runningSuppliers,
  runningTeam,
  seasonValue,
  threeYearCost,
  timeline,
  valueFootnote,
  valueLines,
  yearOneCost,
} from './data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'build');
const TOTAL = 28;
const IMG = '../../assets/reference';
const SCREENS = '../img/screens';

const pad = (n) => String(n).padStart(2, '0');
const pct = (share) => `${Math.round(share * 100)}%`;
const arrow = '<svg class="arrow"><use href="#ar"/></svg>';
const concept = '<span class="concept">Concept image</span>';

const hdr = (section, n) =>
  `<div class="hdr"><div class="brand"><i></i><b>Scarlets One</b><span>· Fan app proposal and costing</span></div><div>${section}</div><div class="pg">${pad(n)} / ${TOTAL}</div></div>`;

const head = (eyebrow, title, lede = '') =>
  `<div class="head"><div><div class="eyebrow">${eyebrow}</div><h1 class="t">${title}</h1></div>${lede ? `<p class="lede">${lede}</p>` : ''}</div>`;

const slide = (n, section, inner) =>
  `\n<!-- ${pad(n)} ${section} -->\n<section class="slide">${hdr(section, n)}${inner}</section>`;

const card = ({ dark, cls = '', num, title, sub, txt, bul, noArrow, style = '' }) =>
  `<div class="card ${dark ? 'dark' : ''} ${cls}"${style ? ` style="${style}"` : ''}>${noArrow ? '' : arrow}${num ? `<div class="num">${num}</div>` : ''}<h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}${txt ? `<p class="txt">${txt}</p>` : ''}${bul ? `<ul class="bul">${bul.map((item) => `<li>${item}</li>`).join('')}</ul>` : ''}</div>`;

const NAV = [
  ['i-phone', 'The fan app'],
  ['i-loop', 'How it grows'],
  ['i-star', 'Partners'],
  ['i-chart', 'Cost and return'],
];
const nav = (on) =>
  `<div class="navp">${NAV.map(([icon, label], i) => `<span${i === on ? ' class="on"' : ''}><svg><use href="#${icon}"/></svg>${label}</span>`).join('')}</div>`;

/** A full-bleed photo slide: the cover, the four part dividers and the close. */
const photo = ({ n, image, position = 'center', tl, tr, h1, h1Class, br, cta, on, foot }) =>
  `\n<!-- ${pad(n)} ${tl} -->\n<section class="slide"><div class="frame"><img src="${IMG}/${image}" style="object-position:${position}" alt=""><div class="ov"></div><div class="tl">${tl}</div>${concept}<div class="tr">${tr}</div><h1 class="${h1Class}">${h1}</h1><p class="br">${br}</p>${cta ? `<div class="cta"><span class="ic"><svg><use href="#i-cal"/></svg></span><span>${cta}</span><svg><use href="#ar"/></svg></div>` : ''}</div><div class="foot"><div class="dotbtn"><i></i></div>${foot ?? nav(on)}<div class="meta">${on === undefined && !foot ? `Prepared by ${PROPOSER}<br>${TODAY} · A proposal, not a club document` : foot ? `Concept imagery · Sample content<br>Not a club document · ${pad(n)} / ${TOTAL}` : 'Scarlets One<br>Fan app proposal and costing'}</div></div></section>`;

const base = returns.base;
const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
];
const slides = [];

/* 01 ---------------------------------------------------------------- cover */
slides.push(
  photo({
    n: 1,
    image: '03-red-wall-hero.jpg',
    position: '70% 40%',
    tl: 'Fan app proposal and costing',
    tr: 'November 2026',
    h1Class: 'top cover',
    h1: 'Scarlets One —<br>one region, one roar, <em>one app.</em>',
    br: 'A proposal to build the full supporter app for Scarlets: what it does, what it costs, and what it returns.',
    cta: 'Prepared for Scarlets',
  }),
);

/* 02 ---------------------------------------------------- executive summary */
slides.push(
  slide(
    2,
    'Executive summary',
    `${head(
      'Executive summary',
      'One fan app. An owned channel that fills the Parc and pays its own way.',
      'Scarlets are followed well beyond Llanelli. Scarlets One turns that following into a known relationship, and the relationship into tickets, members, partner revenue and reach the club owns.',
    )}
<div class="body"><div class="g3 rows2">
${card({ title: `${money(build.price)}<br>to build`, txt: 'The full fan app: iOS, Android and web from one codebase, in Welsh and English. Fixed price, excluding VAT.' })}
${card({ title: `${timeline.weeksToLaunch} weeks<br>to launch`, txt: `A closed pilot at week ${timeline.pilotWeek}. Both app stores and the web at week ${timeline.weeksToLaunch}, on a home match day.` })}
${card({ dark: true, title: `About ${money(seasonValue.base)}<br>of value a season`, txt: `Base case, illustrative: tickets, memberships, store, partners and reach. Pays back in about ${NUMBER_WORDS[Math.round(base.paybackMonths)]} months of a full season.` })}
${card({ title: 'The cost is audited<br>three ways', txt: `By deliverable, by discipline and by phase. Every one of the ${build.days} days is accounted for, and running costs are shown apart.` })}
${card({ title: 'App, code and data:<br>the club’s', txt: 'Handed over on final payment. Supporter data is collected under UK GDPR, with a clear yes for marketing.' })}
${card({ title: 'A week-3 gate<br>before the build', txt: 'Ticketing, membership, match-data and venue providers are confirmed first, or we re-scope with you.' })}
</div></div>`,
  ),
);

/* 03 ------------------------------------------------------- the opportunity */
slides.push(
  slide(
    3,
    'The opportunity',
    `${head(
      'The opportunity',
      'Why a fan app, and why it creates value beyond matchday',
      'A matchday companion, a rewards home, a partner platform and a marketing channel in one. It compounds: every supporter it gains can be reached again.',
    )}
<div class="body"><div class="g3 rows2">
${card({ noArrow: true, num: '01', title: 'Own the relationship', txt: 'Social reach is rented. A supporter who opts in can be reached directly, at almost no cost per message.' })}
${card({ noArrow: true, num: '02', title: 'Know who is in the stands', txt: 'Tickets, membership and the Passport turn an anonymous crowd into known supporters, with their permission.' })}
${card({ noArrow: true, dark: true, num: '03', title: 'Turn first-timers<br>into regulars', txt: 'The north star is repeat verified attendance. The app plans the first visit and gives a reason for the second.' })}
${card({ noArrow: true, num: '04', title: 'Earn between matchdays', txt: `About ${HOME_MATCHES} home matches a season. Match Centre, stories, the Fan Zone and the store fill the days between.` })}
${card({ noArrow: true, num: '05', title: 'Make partner spend<br>provable', txt: 'Opted-in reach and verified redemptions replace estimates with evidence partners can count.' })}
${card({ noArrow: true, num: '06', title: 'Cymraeg and English,<br>as equals', txt: 'Every screen in both languages, switched in place. The Welsh is translated professionally and approved by the club.' })}
</div></div>`,
  ),
);

/* 04 --------------------------------------------------------- the strategy */
const lever = (glyph, title, items, dark) =>
  `<div class="card ${dark ? 'dark' : ''}"><div class="num" style="font-size:34px;font-weight:300;letter-spacing:0">${glyph}</div><h3>${title}</h3><ul class="bul">${items.map((item) => `<li>${item}</li>`).join('')}</ul></div>`;
slides.push(
  slide(
    4,
    'The strategy',
    `${head(
      'The strategy on a page',
      'Four levers of supporter revenue. One app pulls all of them.',
      'Supporter revenue is known supporters × how often they come × what each is worth, plus what partners pay to reach them. Each part of the app moves one of those four numbers, and each is measured.',
    )}
<div class="body" style="display:grid;grid-template-rows:1fr auto;gap:22px"><div class="g4">
${lever('+', 'More known<br>supporters', ['Join from a stadium QR code, a ticket or a friend’s invite', 'Guest mode first; sign up when it earns something', 'Every ticket and membership links to a profile'])}
${lever('×', 'More matches<br>per supporter', ['A first-match guide and planner', 'Bring a group, and a reason for the second match', 'Passport stamps for every verified visit'], true)}
${lever('↑', 'More value<br>per supporter', ['Tickets, membership, YMLAEN and the store in one place', 'Offers by segment, not by blanket discount', 'Renewal and win-back journeys'])}
${lever('⇄', 'More value<br>for partners', ['Opted-in reach, counted rather than estimated', 'Offers and redemptions tracked to their source', 'Totals for partners; personal data stays with the club'])}
</div>
<div class="card strip"><span class="tag">North star</span><p>Repeat verified attendance: the supporter who comes back. <em>Every feature, campaign and partner is judged by it.</em></p></div></div>`,
  ),
);

/* 05 ------------------------------------------------------- the supporters */
const person = (image, title, wants, app, measure, dark, position = 'center') =>
  `<div class="card pcard ${dark ? 'dark' : ''}"><div class="ph"><img src="${IMG}/${image}" style="object-position:${position}" alt=""></div><h3>${title}</h3><div class="meta"><p>Wants: ${wants}</p><p>App: ${app}</p><p><b>Measure: ${measure}</b></p></div></div>`;
slides.push(
  slide(
    5,
    'The supporters',
    `${head(
      'Who it serves',
      'Six supporters the app<br>is built to serve',
      'Each supporter has a job they want done. The app does it for them, and the club gets a measurable result in return.',
    )}
<div class="body fnote"><div class="g6 fill">
${person('22-fan-cam-spotlight.jpg', 'The matchday<br>regular', 'a ticket and no queue.', 'the pass, gate and seat, Passport stamps.', 'matches attended', false, '50% 20%')}
${person('08-first-visit.jpg', 'The first-timer', 'to find the gate, the seat and the food.', 'first-match guide, planner, stadium map.', 'a second verified visit', false, '50% 20%')}
${person('29-generations.jpg', 'The family', 'a safe, easy day out.', 'family guide, meeting point, step-free routes.', 'family attendance', true, '50% 25%')}
${person('25-reward-redemption.jpg', 'The member', 'to be recognised.', 'membership link, Passport, YMLAEN.', 'renewals', false, '30% 30%')}
${person('09-accessible-matchday.jpg', 'The disabled<br>supporter', 'to know the route before leaving home.', 'step-free routes, access contacts, help.', 'plans completed', false, '50% 30%')}
${person('31-global-watch.jpg', 'The far-away<br>Scarlet', 'to feel close from anywhere.', 'Match Centre, local kick-off times, watch parties.', 'active days a month', false, '35% 40%')}
</div></div>
<p class="fn">These segments are working hypotheses. Each is sized from the club’s ticketing, membership and app data in discovery, and campaigns are weighted to the segments that prove largest. Concept imagery, not club photography.</p>`,
  ),
);

/* 06 ------------------------------------------------------------- part one */
slides.push(
  photo({
    n: 6,
    image: '23-scarves-raised-wide.jpg',
    position: '50% 35%',
    tl: 'Part one',
    tr: `06 / ${TOTAL}`,
    h1Class: 'low',
    h1: 'A fan app first.<br><em>Everything else follows.</em>',
    br: 'Supporters open an app that solves their matchday. The club’s marketing, partner and revenue engine runs underneath, on the trust that earns.',
    on: 0,
  }),
);

/* 07 ------------------------------------------------------ matchday features */
const feature = (title, sub, txt, dark) => card({ title, sub, txt, dark });
slides.push(
  slide(
    7,
    'The fan app · 1 of 2',
    `${head('The fan app · Matchday', 'Your matchday, sorted: from ticket to seat')}
<div class="body hi" style="display:grid;grid-template-rows:auto 1fr;gap:22px">
<div class="banner"><img src="${IMG}/07-arrival-family.jpg" style="object-position:50% 53%" alt="">${concept}</div>
<div class="g3">
${feature('Tickets and the pass', 'Official seller, verified entry', 'Tickets come only from the official seller. The app shows the fixture, gate and seat; payment and the entry code stay with the seller.')}
${feature('The matchday planner', 'Checklist, travel, meeting point', 'A checklist for the day, the club’s travel guidance and a meeting point to share with the group. Nothing tracks where a supporter is.')}
${feature('Parc y Scarlets guide and help', 'Gates, seats, step-free routes', 'A venue-approved map of gates, food, first aid and step-free routes, and a real person for entry, access and safety.', true)}
</div></div>`,
  ),
);

/* 08 ---------------------------------------------------- belonging features */
slides.push(
  slide(
    8,
    'The fan app · 2 of 2',
    `${head('The fan app · Belonging', 'Belong, play and follow, every day of the week')}
<div class="body hi" style="display:grid;grid-template-rows:auto 1fr;gap:22px">
<div class="banner"><img src="${IMG}/32-fan-zone-activation.jpg" style="object-position:50% 42%" alt="">${concept}</div>
<div class="g3">
${feature('Match Centre', 'The daily habit', 'Fixtures, results and live events from a licensed feed, each with its source and time. Nothing unconfirmed is shown.')}
${feature('Fan Zone', 'Play, vote, share', 'A score predictor, polls, a club quiz and Player of the Match votes, with no betting and no open chat. Every photo is moderated before anyone sees it.')}
${feature('Scarlets Passport and YMLAEN', 'Every verified visit counts', 'Membership, benefits and YMLAEN rewards in one place. Points and tiers appear only as the club publishes them, on a ledger that can be audited.', true)}
</div></div>`,
  ),
);

/* 09 ------------------------------------------------------------ the journey */
const journey = [
  ['Discover', 'Finds the app from a stadium QR code or a friend.', 'The source of every sign-up.'],
  ['Join', 'Browses as a guest, then signs up.', 'A known supporter, with consent.'],
  ['Plan', 'Plans the day, the travel and the group.', 'Matchday intent, a week early.'],
  [
    'Book',
    'Buys from the official seller and links the ticket.',
    'A seat sold, linked to a profile.',
  ],
  ['Attend', 'Shows the seller’s entry code at the gate.', 'A verified attendance.'],
  ['Earn', 'Gets a Passport stamp.', 'A reason to return, without discounts.'],
  ['Return', 'Comes back, renews or shops.', 'Repeat attendance and spend, measured.'],
];
slides.push(
  slide(
    9,
    'The supporter journey',
    `${head(
      'The supporter journey',
      'From first tap to next matchday, one connected flow',
      'Each step is something the supporter wants to do. Each one also hands the club something it can use: a source, a known supporter, a filled seat, a reason to return.',
    )}
<div class="body" style="display:grid;grid-template-rows:1fr auto;gap:22px"><div class="g7">
${journey.map(([title, supporter, club], i) => `<div class="card step ${i === 4 ? 'dark' : ''}"><div class="n">${pad(i + 1)}</div><h3>${title}</h3><div class="who"><b>Supporter</b><p>${supporter}</p><b class="g">The club gets</b><p>${club}</p></div></div>`).join('')}
</div>
<div class="card strip"><span class="tag">Underneath</span><p>Every step writes to one supporter record. <em>That is how a ticket triggers its reminder, a visit earns its stamp and a campaign proves it worked.</em></p></div></div>`,
  ),
);

/* 10 -------------------------------------------------- proof before payment */
const phone = (file, caption) =>
  `<div><div class="phone"><div class="scr"><img src="${SCREENS}/${file}-dark.jpg" alt=""></div></div><div class="pcap">${caption}</div></div>`;
slides.push(
  slide(
    10,
    'Proof before payment',
    `${head(
      'Proof before payment',
      'The app already works. This investment takes it live.',
      'A working fan app built from the brief, running on labelled demo data, with all 39 supplied images reviewed. The build starts here, not from a blank page.',
    )}
<div class="body" style="display:grid;grid-template-rows:1fr auto;gap:26px">
<div class="g6" style="gap:58px;padding:0 12px;align-items:start">
${phone('welcome', 'Welcome')}${phone('home', 'Home')}${phone('match-centre', 'Match Centre')}${phone('matchday', 'Matchday')}${phone('passport', 'Passport')}${phone('fan-zone', 'Fan Zone')}
</div>
<div class="g4">
${card({ noArrow: true, cls: 'stat', title: '19 screens', txt: 'Phone and desktop, in light and dark.' })}
${card({ noArrow: true, cls: 'stat', title: '536 automated tests', txt: 'Rules, screens, console and database. All passing.' })}
${card({ noArrow: true, cls: 'stat', title: 'Cymraeg and English', txt: 'Switched in place. The Welsh is a 56% draft.' })}
${card({ noArrow: true, cls: 'stat', dark: true, title: 'One offline file', txt: 'The whole app in 7.5 MB, shared by WhatsApp.' })}
</div></div>`,
  ),
);

/* 11 ------------------------------------------------------------- part two */
slides.push(
  photo({
    n: 11,
    image: '33-big-screen-celebration.jpg',
    position: '50% 60%',
    tl: 'Part two',
    tr: `11 / ${TOTAL}`,
    h1Class: 'low',
    h1: 'The app as the club’s<br>own <em>marketing system.</em>',
    br: 'Every fixture, ticket and shared moment is designed to bring in the next supporter, and to show the club exactly where they came from.',
    on: 1,
  }),
);

/* 12 ------------------------------------------------- the self-marketing loop */
function loop() {
  const cx = 480;
  const cy = 372;
  const r = 268;
  const steps = [
    '1 · Join',
    '2 · Plan the match',
    '3 · Bring the group',
    '4 · Attend and verify',
    '5 · Earn and share',
    '6 · A new Scarlet joins',
  ];
  const widths = [134, 258, 262, 290, 262, 316];
  let svg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E1DCD4" stroke-width="1.5"/>`;
  steps.forEach((label, i) => {
    const angle = (-90 + i * 60) * (Math.PI / 180);
    const next = (-90 + (i + 1) * 60) * (Math.PI / 180);
    // an arrow along the arc towards the next step
    const mid = (angle + next) / 2;
    const a1 = mid - 0.16;
    const a2 = mid + 0.16;
    const p = (a) => `${cx + r * Math.cos(a)} ${cy + r * Math.sin(a)}`;
    svg += `<path d="M${p(a1)} A${r} ${r} 0 0 1 ${p(a2)}" fill="none" stroke="#C8102E" stroke-width="2.5" marker-end="url(#tip)"/>`;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const w = widths[i];
    const fill = i === 0 ? '#3B101B' : i === 5 ? '#E7C683' : '#fff';
    svg += `<rect x="${x - w / 2}" y="${y - 26}" width="${w}" height="52" rx="26" fill="${fill}" stroke="${i === 0 || i === 5 ? 'none' : '#E1DCD4'}"/>`;
    svg += `<text x="${x}" y="${y + 6}" text-anchor="middle" style="${i === 0 ? 'fill:#fff' : ''}">${label}</text>`;
  });
  svg += `<text x="${cx}" y="${cy - 6}" text-anchor="middle" style="font-size:38px;font-weight:300;letter-spacing:0">One supporter in,</text>`;
  svg += `<text x="${cx}" y="${cy + 42}" text-anchor="middle" style="font-size:38px;font-weight:300;letter-spacing:0;fill:#C8102E">a whole group back.</text>`;
  return `<svg class="loop" viewBox="0 0 960 744" width="900" height="698" role="img" aria-label="The self-marketing loop"><defs><marker id="tip" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#C8102E"/></marker></defs>${svg}</svg>`;
}
slides.push(
  slide(
    12,
    'The self-marketing loop',
    `${head('The self-marketing loop', 'Each supporter brings in the next one')}
<div class="body hi" style="display:grid;grid-template-columns:1.13fr 1fr;gap:22px">
<div class="card" style="align-items:center;justify-content:center;padding:20px">${loop()}</div>
<div class="stack" style="grid-template-rows:1.2fr 1fr 1fr">
${card({ dark: true, title: 'How it compounds', txt: 'Paid media buys attention once. The loop keeps it: the plan, the group, the stamp and the shared moment each carry the club to someone new, and the app tracks every turn.' })}
${card({ title: 'A ticket is rarely for one', txt: 'An invitation rewards the inviter only when the friend’s entry is verified, never for a click.' })}
${card({ title: 'A moment is an invitation', txt: 'An approved fan photo or prediction card carries the club, with a tracked link, into a supporter’s own circle.' })}
</div></div>`,
  ),
);

/* 13 ------------------------------------------------------ growth calendar */
const calendar = [
  [
    'T−28 to T−21',
    'Reveal',
    '“I haven’t heard about it.”',
    'Fixture reveal and a shareable page.',
    'Fixture page visits',
  ],
  [
    'T−20 to T−14',
    'Explain',
    '“How does the day work?”',
    'Ticket route, travel and family information.',
    'Ticket taps',
  ],
  [
    'T−13 to T−7',
    'Commit',
    '“Give me a reason.”',
    'Group invitations and supporter-club pushes.',
    'Tickets by source',
  ],
  [
    'T−6 to T−2',
    'Organise',
    '“Let’s sort the details.”',
    'Planner, meeting point, reminders.',
    'Plans completed',
  ],
  [
    'T−1 to kick-off',
    'Arrive',
    '“Help me get in.”',
    'Pass, gate, seat and venue notices.',
    'Verified attendance',
  ],
  [
    'Matchday',
    'Enjoy',
    '“Make it a great day.”',
    'Predictor, food, Player of the Match vote.',
    'Participation',
  ],
  [
    'T+1 to T+3',
    'Relive',
    '“Let me relive it.”',
    'Highlights, a stamp and a one-question survey.',
    'Return visits',
  ],
  [
    'T+4 onward',
    'Return',
    '“Bring me back.”',
    'A second-match reason and the next fixture.',
    'Repeat attendance',
  ],
];
slides.push(
  slide(
    13,
    'The growth calendar',
    `${head(
      'The system for every home match',
      'Every home match runs the same eight-step growth calendar',
      'Each home match is worked from four weeks out to the next fixture. Every step answers a supporter’s question and has one measure, so the club sees which step to strengthen.',
    )}
<div class="body" style="display:grid;grid-template-rows:1fr auto;gap:22px"><div class="g8">
${calendar.map(([when, title, question, app, measure], i) => `<div class="card step ${i === 7 ? 'dark' : ''}" style="padding:30px 20px"><div class="when">${when}</div><h3>${title}</h3><p class="q">${question}</p><div class="who"><b>The app</b><p>${app}</p><b class="g">Measure</b><p>${measure}</p></div></div>`).join('')}
</div>
<div class="card strip"><span class="tag">A season</span><p>${HOME_MATCHES} home matches × 8 steps = ${HOME_MATCHES * 8} planned moments, <em>each one drafted, approved and measured.</em></p></div></div>`,
  ),
);

/* 14 --------------------------------------------------- lifecycle journeys */
const messages = [
  ['Welcome', 'When a supporter opts in', 'Email · Push', true],
  ['Fixture reveal', 'Four weeks out', 'Push · Email', true],
  ['Ticket ready', 'When a ticket is linked', 'In-app · Email · Push', false],
  ['Matchday morning', 'Gate and route', 'Push · In-app', false],
  ['Thank you', 'After a verified attendance', 'In-app · Push', false],
  ['Second-match invite', 'After a first visit', 'Push · Email', true],
  ['Win-back', 'After a quiet spell', 'Email · Push', true],
];
const notes = [
  [
    'Now',
    'Your seat is ready',
    'Scarlets v Opponent A. Your gate and block are in the app. Your entry code is in the seller’s wallet.',
  ],
  [
    'Day before',
    'Matchday tomorrow',
    'Kick-off 17:00 at Parc y Scarlets. Your plan and meeting point are in the app.',
  ],
  ['Full-time', 'Thank you for being there', 'Your visit is verified: a new Passport stamp.'],
  ['With consent', 'It has been a while', 'The next home match is close. Bring a friend along.'],
];
slides.push(
  slide(
    14,
    'Lifecycle journeys',
    `${head('Lifecycle journeys', 'The right message at the right moment,<br>and never one too many')}
<div class="body" style="display:grid;grid-template-columns:2.02fr 1fr;gap:22px">
<div class="card" style="padding:36px 36px 30px">
<div class="key"><span>Service message: always sent</span><span class="mk">Marketing message: only with consent</span></div>
<div class="msgs">${messages.map(([title, when, channels, marketing]) => `<div${marketing ? ' class="mk"' : ''}><h4>${title}</h4><p>${when}</p><small>${channels}</small></div>`).join('')}</div>
<div class="cap" style="margin:auto 0 16px;color:var(--muted)">What supporters receive</div>
<div class="notes" style="margin-top:0">${notes.map(([when, title, body]) => `<div><small><span>Scarlets One</span><span>${when}</span></small><b>${title}</b><p>${body}</p></div>`).join('')}</div>
<p class="note" style="margin-top:0">Sample messages; the club sets final wording and timings, in Welsh and English.</p>
</div>
${card({ dark: true, title: 'Guardrails, built in', bul: ['Consent recorded per channel and purpose, with its wording and version', 'A suppression list, checked again just before every send', 'Frequency caps and quiet hours', 'Every campaign approved by a second person', 'Service and safety messages never carry promotions', 'One-tap opt-out, honoured immediately'] })}
</div>`,
  ),
);

/* 15 ----------------------------------------------------------- part three */
slides.push(
  photo({
    n: 15,
    image: '11-hospitality-lounge.jpg',
    position: '50% 45%',
    tl: 'Part three',
    tr: `15 / ${TOTAL}`,
    h1Class: 'low',
    h1: 'Partners: sponsorship<br><em>built into the app.</em>',
    br: 'Useful experiences supporters choose, and evidence partners can take to their boards. Access through the app, never the audience itself.',
    on: 2,
  }),
);

/* 16 --------------------------------------------------- partner properties */
slides.push(
  slide(
    16,
    'Partner properties',
    `${head(
      'Partner properties',
      `Six partner properties, worth up to ${money(partnerCases.stretch)} a season`,
      'Each property funds something supporters use, so the partner is remembered for helping. Fees are indicative, for planning, and are set after a rights audit against the club’s existing partners.',
    )}
<div class="body fnote" style="display:grid;grid-template-columns:2.8fr 1fr;gap:22px">
<div class="card" style="padding:32px 36px"><table class="tbl">
<tr><th></th><th>Property</th><th>Supporters get</th><th>The partner gets, and proves</th><th class="r">Season fee</th></tr>
${partners.map((p, i) => `<tr><td class="ix">${pad(i + 1)}</td><td class="nm" style="width:31%">${p.name}</td><td style="width:23%;padding-right:18px">${p.gets}</td><td style="padding-right:18px">${p.proves}</td><td class="r">${money(p.fee)}</td></tr>`).join('')}
<tr class="sum"><td></td><td class="nm">All six, a season</td><td></td><td></td><td class="r big">${money(partnerCases.stretch)}</td></tr>
</table></div>
<div class="stack" style="grid-template-rows:1.15fr 1fr">
${card({ dark: true, num: 'Base case', title: `Three properties,<br>${money(partnerCases.base)} a season`, txt: 'Presenting, Passport and Matchday Experience: the three most used every day.' })}
${card({ num: 'Conservative case', title: `Two smaller ones,<br>${money(partnerCases.conservative)} a season`, txt: 'Matchday Experience and Fan Zone only.' })}
</div></div>
<p class="fn">Indicative season fees for planning, excluding VAT. No partner is named or implied; categories are cleared against existing club, league and venue rights before anything is offered.</p>`,
  ),
);

/* 17 -------------------------------------------------- partner-funded build */
slides.push(
  slide(
    17,
    'Partner-funded build',
    `${head(
      'Partner-funded build',
      'Partners can carry most of the build, every season',
      `In the base case, three properties bring ${money(partnerCases.base)} a season against a ${money(build.price)} build: ${pct(partnerCases.base / build.price)} of it, every season they are sold. It is the app’s largest value line, and one the club can sell before launch.`,
    )}
<div class="body" style="display:grid;grid-template-columns:1.66fr 1fr;gap:22px">
<div class="card" style="padding:32px 40px 24px"><div class="cap">Partner fees against the build, ${currency.symbol} thousands</div>${partnerBars()}</div>
<div class="stack">
${card({ dark: true, title: 'Sell the launch as<br>a partnership', txt: `Offer the presenting partner three seasons at ${money(partners[0].fee)}: ${money(partners[0].fee * 3)}, ${pct((partners[0].fee * 3) / build.price)} of the build, signed before the build starts.` })}
${card({ title: 'Reports, not impressions', txt: 'Reach, engagement, conversion and return visits, proven with holdout groups. A claim is not a redemption.' })}
</div></div>`,
  ),
);

/* 18 ------------------------------------------------------------ part four */
slides.push(
  photo({
    n: 18,
    image: '19-womens-action.jpg',
    position: '50% 30%',
    tl: 'Part four',
    tr: `18 / ${TOTAL}`,
    h1Class: 'low',
    h1: 'The cost, audited.<br><em>The value and the return.</em>',
    br: `${money(build.price)} to build. About ${money(seasonValue.base)} of value a season in the base case, with the numbers reported every month.`,
    on: 3,
  }),
);

/* 19 --------------------------------------------------------- the costing */
const costTable = (lines) =>
  `<div class="card" style="padding:30px 36px 14px"><table class="tbl tight"><tr><th></th><th>Deliverable</th><th class="r">Days</th><th class="r" style="width:118px">Price</th></tr>${lines.map((line) => `<tr><td class="ix">${line.no}</td><td class="nm">${line.name}<span class="ds">${line.detail}</span></td><td class="r">${line.total}</td><td class="r">${money(line.price)}</td></tr>`).join('')}</table></div>`;
slides.push(
  slide(
    19,
    'The costing',
    `${head('The costing', `The full fan app, ${money(build.price)}, itemised`)}
<div class="body hi" style="display:grid;grid-template-rows:1fr auto;gap:20px;bottom:86px">
<div class="g2">${costTable(deliverables.slice(0, 9))}${costTable(deliverables.slice(9))}</div>
<div class="card dark totalbar">
<div><span>Effort</span><b>${build.days} days · ${build.hours.toLocaleString('en-GB')} hours</b></div>
<div><span>Day rate</span><b>${money(DAY_RATE)}</b></div>
<div><span>In rand, for reference</span><b>about R${(build.zar / 1e6).toFixed(2)} million</b></div>
<div class="main"><span>Total, fixed price, excluding VAT</span><b>${money(build.price)}</b></div>
</div></div>
<p class="fn">A senior team at ${money(DAY_RATE)} a day. Priced in ${currency.plural}; in rand, about R${(build.zar / 1e6).toFixed(2)} million at R${currency.zarPer} to ${currency.symbol}1, the mid-market rate on ${currency.rateDate}. iOS, Android and web from one codebase. On final payment the club owns the code, designs and data.</p>`,
  ),
);

/* 20 ------------------------------------------- audit 1: every day counted */
const MATRIX_HEADS = [
  'Product<br>&amp; delivery',
  'Design<br>&amp; brand',
  'App<br>engineering',
  'Back end<br>&amp; integrations',
  'Quality<br>&amp; security',
  'Content,<br>Welsh, launch',
];
if (MATRIX_HEADS.length !== roles.length)
  throw new Error('Matrix headings do not match the disciplines');
const cell = (n) => `<td class="${n === 0 ? 'z' : ''}">${n === 0 ? '·' : n}</td>`;
slides.push(
  slide(
    20,
    'Costing audit · 1 of 3',
    `${head('Costing audit 1 · Every day accounted for', 'The audit: every day, by discipline')}
<div class="body hi"><div class="card fill" style="padding:28px 40px 22px"><table class="matrix">
<tr><th class="l"></th><th class="l">Deliverable</th>${MATRIX_HEADS.map((label) => `<th style="width:132px">${label}</th>`).join('')}<th class="tot" style="width:92px">Days</th><th class="tot" style="width:130px">Price</th></tr>
${deliverables.map((line) => `<tr><td class="ix">${line.no}</td><td class="nm l">${line.name}</td>${line.days.map(cell).join('')}<td class="tot">${line.total}</td><td class="tot">${money(line.price)}</td></tr>`).join('')}
<tr class="sum"><td></td><td class="nm l">Days by discipline</td>${roleTotals.map((role) => `<td>${role.days}</td>`).join('')}<td>${build.days}</td><td>${money(build.price)}</td></tr>
<tr class="sum money"><td></td><td class="nm l" style="font-weight:500;color:var(--ink-2)">At ${money(DAY_RATE)} a day</td>${roleTotals.map((role) => `<td>${money(role.price)}</td>`).join('')}<td></td><td></td></tr>
</table></div></div>`,
  ),
);

/* 21 ---------------------------------------- audit 2: where the money goes */
slides.push(
  slide(
    21,
    'Costing audit · 2 of 3',
    `${head(
      'Costing audit 2 · Where the money goes',
      'The same total by people, by phase and by payment',
      `The ${money(build.price)} cut three more ways. Each view adds up to the same ${build.days} days, so nothing hides in a rounded line.`,
    )}
<div class="body" style="display:grid;grid-template-columns:1.24fr 1fr 0.9fr;gap:22px">
<div class="card" style="padding:32px 34px"><div class="cap">By discipline: who does the work</div>${disciplineBars()}<p class="note">One blended senior rate. App engineering and integrations are ${pct((roleTotals[2].days + roleTotals[3].days) / build.days)} of the build: it is mostly engineering against the club’s live systems.</p></div>
<div class="card" style="padding:32px 34px"><div class="cap">By phase: when it is spent</div><table class="tbl">
<tr><th>Phase</th><th class="r">Days</th><th class="r">Price</th></tr>
${phases.map((phase) => `<tr><td class="nm">${phase.name}<span class="ds">${phase.weeks}</span></td><td class="r">${phase.days}</td><td class="r">${money(phase.price)}</td></tr>`).join('')}
<tr class="sum"><td class="nm">Total</td><td class="r">${build.days}</td><td class="r big">${money(build.price)}</td></tr>
</table></div>
<div class="card dark" style="padding:32px 34px">${arrow}<h3>Paid behind<br>the work</h3><table class="tbl" style="margin-top:28px">
<tr><th style="color:var(--on-dark-2);border-color:rgba(255,255,255,.5)">Milestone</th><th class="r" style="color:var(--on-dark-2);border-color:rgba(255,255,255,.5)">Done</th><th class="r" style="color:var(--on-dark-2);border-color:rgba(255,255,255,.5)">Paid</th></tr>
${payments.map((p) => `<tr><td style="color:var(--on-dark);border-color:rgba(255,255,255,.16)">${p.name}</td><td class="r" style="color:var(--on-dark);border-color:rgba(255,255,255,.16)">${pct(p.doneShare)}</td><td class="r" style="color:var(--gold);border-color:rgba(255,255,255,.16)">${pct(p.paidShare)}</td></tr>`).join('')}
</table><p class="txt">At the pilot, ${pct(payments[1].doneShare)} of the work is delivered and ${pct(payments[1].paidShare)} is paid. After signature, the club never pays ahead of what it has seen.</p></div>
</div>`,
  ),
);

/* 22 -------------------------------------- audit 3: concept to production */
slides.push(
  slide(
    22,
    'Costing audit · 3 of 3',
    `${head(
      'Costing audit 3 · From concept to production',
      'What already exists, and what the investment adds',
      'An audit of the working concept, line by line. The price buys the right-hand column: live data, real devices, professional Welsh and independent checks.',
    )}
<div class="body" style="display:grid;grid-template-columns:2.35fr 1fr;gap:22px">
<div class="card" style="padding:32px 36px"><table class="tbl">
<tr><th style="width:24%">Area</th><th style="width:38%">Exists today, in the concept</th><th>The investment adds</th></tr>
${audit.map((row) => `<tr><td class="nm">${row.area}</td><td style="padding-right:26px">${row.exists}</td><td>${row.adds}</td></tr>`).join('')}
</table><p class="note">The concept has not run on a phone and every data source is a mock. Both are stated in its own documentation.</p></div>
${card({ dark: true, title: 'Not in the price', bul: ['The licensed match-data feed and the ticketing provider’s own fees', 'Professional photography and video', 'Paid media and prize costs', 'Text and WhatsApp message charges, at cost', 'Travel to Llanelli, if asked for, at cost', 'New scope: priced and approved in writing first'] })}
</div>`,
  ),
);

/* 23 ------------------------------------------- running costs and ownership */
slides.push(
  slide(
    23,
    'Running costs',
    `${head(
      'Running costs and cost of ownership',
      `${money(runningMonthly)} a month to run. ${money(threeYearCost)} over three years.`,
      'Running costs sit apart from the build so they can be checked on their own. Supplier lines are allowances: they are replaced by quotes in discovery and paid at cost, from accounts in the club’s name.',
    )}
<div class="body" style="display:grid;grid-template-columns:1.32fr 1fr;gap:22px">
<div class="card" style="padding:32px 36px"><div class="cap">What it costs each month</div><table class="tbl tight">
<tr><th>Line</th><th>Paid to</th><th class="r">A month</th></tr>
${running.map((line) => `<tr><td class="nm" style="width:62%">${line.name}<span class="ds">${line.detail}</span></td><td>${line.kind === 'supplier' ? 'Supplier, at cost' : 'Our team'}</td><td class="r">${money(line.monthly)}</td></tr>`).join('')}
<tr class="sum"><td class="nm">Total a month</td><td>${money(runningSuppliers)} suppliers · ${money(runningTeam)} team</td><td class="r big">${money(runningMonthly)}</td></tr>
</table><p class="note">Allowances as at November 2026, excluding VAT. Not included: the match-data licence, the ticketing provider’s own fees, and message charges above the allowance.</p></div>
<div class="stack" style="grid-template-rows:auto 1fr">
<div class="card" style="padding:32px 34px 24px"><div class="cap">Cost of ownership by year</div>${ownershipBars()}${ownershipLegend}</div>
<div class="card dark" style="padding:30px 34px;flex-direction:row;align-items:center;justify-content:space-between;gap:20px">
<div class="kpi">${money(yearOneCost)}<small>Year one: build and running</small></div>
<div class="kpi" style="color:var(--gold)">${money(threeYearCost)}<small>Three years, in total</small></div>
</div></div></div>`,
  ),
);

/* 24 ---------------------------------------------------- value to the club */
slides.push(
  slide(
    24,
    'Value to the club',
    `${head(
      'Value to the club',
      `About ${money(seasonValue.base)} a season: one and a half times the build`,
      'Five value lines, each tied to a number the app moves and the club can count. Illustrative: every assumption is replaced with the club’s own figures in discovery.',
    )}
<div class="body fnote" style="display:grid;grid-template-columns:1.1fr 1fr;gap:22px">
<div class="card" style="padding:30px 36px 12px"><div class="cap">Base case: how a season adds up, ${currency.symbol} thousands</div>${waterfall()}</div>
<div class="card" style="padding:30px 36px"><div class="cap">Value a season, three cases</div><table class="tbl">
<tr><th>Value line</th><th class="r">Conservative</th><th class="r">Base</th><th class="r">Stretch</th></tr>
${valueLines.map((line) => `<tr><td class="nm">${line.name}<span class="ds">${line.cases.conservative.assumption} · ${line.cases.base.assumption} · ${line.cases.stretch.assumption} ${line.unit}</span></td><td class="r">${money(line.cases.conservative.value)}</td><td class="r">${money(line.cases.base.value)}</td><td class="r">${money(line.cases.stretch.value)}</td></tr>`).join('')}
<tr class="sum"><td class="nm">A season</td><td class="r big">${money(seasonValue.conservative)}</td><td class="r big" style="color:var(--accent)">${money(seasonValue.base)}</td><td class="r big">${money(seasonValue.stretch)}</td></tr>
</table></div></div>
<p class="fn">${valueFootnote}</p>`,
  ),
);

/* 25 -------------------------------------------------- return on investment */
const notCounted = [
  'Stronger partner renewals',
  'Attendance planned ahead',
  'A fuller stadium on screen',
  'Supporter data the club owns',
];
slides.push(
  slide(
    25,
    'Return on investment',
    `${head(
      'Return on investment',
      `The app pays for itself in about ${NUMBER_WORDS[Math.round(base.paybackMonths)]} months of a full season`,
      `The club’s cumulative position after launch: the ${money(build.price)} build and ${money(runningMonthly)} a month to run, against value as it arrives. The conservative case pays back early in the third season.`,
    )}
<div class="body" style="display:grid;grid-template-rows:1fr auto;gap:20px">
<div style="display:grid;grid-template-columns:2.02fr 1fr;gap:22px">
<div class="card" style="padding:28px 36px 16px"><div class="cap" style="margin-bottom:14px">The club’s cumulative position after launch</div>${returnLegend()}${returnLines()}</div>
${card({ dark: true, title: `Base case: ${money(base.net)}<br>net over three seasons`, txt: `${money(base.threeSeasonValue)} of value against ${money(threeYearCost)} to build and run: about ${currency.symbol}${base.perPound.toFixed(0)} back for every ${currency.symbol}1. Conservative: ${currency.symbol}${returns.conservative.perPound.toFixed(2)} back, ${money(returns.conservative.net)} net. Stretch: ${currency.symbol}${returns.stretch.perPound.toFixed(2)} back, ${money(returns.stretch.net)} net.` })}
</div>
<div class="g4">${notCounted.map((title) => `<div class="card" style="padding:22px 30px 24px"><div class="num" style="margin-bottom:12px;font-size:12.5px">Not counted above</div><h3 style="font-size:25px">${title}</h3></div>`).join('')}</div>
</div>`,
  ),
);

/* 26 ------------------------------------------------- timeline and payments */
const weeks = Array.from({ length: timeline.endWeek }, (_, i) => i + 1);
const ganttRow = (row) => {
  const bar =
    row.at !== undefined
      ? `<i class="m" style="grid-column:${row.at}"></i>`
      : `<i class="b ${row.kind ?? ''}" style="grid-column:${row.from} / ${row.to + 1}"></i>`;
  return `<div class="lab">${row.name}${row.note ? `<small>${row.note}</small>` : ''}</div><div class="track">${bar}</div>`;
};
slides.push(
  slide(
    26,
    'Timeline and payments',
    `${head('Timeline and payments', 'Thirty weeks to launch,<br>with a gate before the build')}
<div class="body" style="display:grid;grid-template-columns:1.72fr 1fr;gap:22px">
<div class="card" style="padding:30px 36px 26px"><div class="gantt"><div></div><div class="wk">${weeks.map((week) => `<span>${week}</span>`).join('')}</div>${timeline.rows.map(ganttRow).join('')}</div>
<p class="note">Weeks from signature. Gold marks where the club sees and approves progress. Sign so that week ${timeline.weeksToLaunch} lands on a home match.</p></div>
<div class="stack" style="grid-template-rows:1fr auto">
<div class="card" style="padding:30px 36px"><div class="cap">Four milestone payments</div><table class="tbl">
<tr><th>Milestone</th><th class="r">Share</th><th class="r">Amount</th></tr>
${payments.map((p) => `<tr><td class="nm">${p.name}<span class="ds">${p.when}</span></td><td class="r">${pct(p.share)}</td><td class="r">${money(p.amount)}</td></tr>`).join('')}
<tr class="sum"><td class="nm">Total</td><td class="r">100%</td><td class="r big">${money(build.price)}</td></tr>
</table></div>
<div class="card dark" style="padding:28px 36px"><h3 style="font-size:28px">Nothing is paid for work<br>you have not seen</h3><p class="txt" style="font-size:17.5px">Each later payment follows a test build, the live app, then a month of operation. Running costs: ${money(runningMonthly)} a month.</p></div>
</div></div>`,
  ),
);

/* 27 -------------------------------------------------------------- protection */
const risks = [
  [
    'Providers differ from our assumption',
    'Week-3 gate: providers, their APIs and test access are confirmed before build spend, and re-scoped with you if needed.',
  ],
  [
    'Partners sign slower than planned',
    `Without any partner, the base case still brings ${money(seasonValue.base - partnerCases.base)} a season, ${pct((seasonValue.base - partnerCases.base) / yearOneCost)} of the first year’s cost. The rate card is tested with partners during discovery.`,
  ],
  [
    'Low adoption after launch',
    'Stadium QR codes, a gate briefing, a founding-supporter stamp and the eight-step calendar. Results are reviewed weekly.',
  ],
  [
    'Supporters feel over-messaged',
    'Consent per channel, frequency caps, quiet hours and one-tap opt-out. The opt-out rate is a reported measure.',
  ],
  [
    'Privacy and young supporters',
    'Minimal data under UK GDPR, consent recorded with its wording, marketing only after legal sign-off, and totals only for partners.',
  ],
  [
    'Brand and image rights',
    'Only the club’s approved crest, marks and licensed photography ship. Concept imagery stays labelled until replaced.',
  ],
  [
    'Matchday peaks at Parc y Scarlets',
    'Load tests at kick-off volumes, a low-data mode, and the last confirmed data stays on screen if the signal drops.',
  ],
  [
    'Scope grows, or the currency moves',
    `Fixed price in ${currency.plural} for the listed scope, set on signature. Anything new is priced and approved in writing first.`,
  ],
];
slides.push(
  slide(
    27,
    'Protection',
    `${head('Protection', 'How the investment is protected')}
<div class="body hi" style="display:grid;grid-template-columns:2.02fr 1fr;gap:22px">
<div class="card" style="padding:32px 36px"><table class="tbl">
<tr><th style="width:27%">Risk</th><th>How we manage it</th></tr>
${risks.map(([risk, answer]) => `<tr><td class="nm" style="padding-right:20px">${risk}</td><td>${answer}</td></tr>`).join('')}
</table></div>
${card({ dark: true, title: 'What this rests on', bul: ['The club confirms its providers by week 3', 'The club supplies its crest, brand guidelines and licensed photography', 'Apple, Google and messaging accounts in the club’s name, at cost', 'Fixtures, scores, prices and member status come from the club’s systems', 'YMLAEN rules come from the club: nothing is invented', 'Welsh and English at launch', 'On final payment, the club owns the code, designs and data'] })}
</div>`,
  ),
);

/* 28 ------------------------------------------------------------------ close */
const contact = [
  ['i-user', 'Magugu S. Nzimande · Founder &amp; CEO'],
  ['i-phone', '+27 73 225 7761'],
  ['i-mail', 'info@legacyleverage.co.za'],
  ['i-globe', 'www.legacyleverage.co.za'],
];
slides.push(
  photo({
    n: 28,
    image: '31-global-watch.jpg',
    position: '50% 35%',
    tl: 'Next step',
    tr: 'To talk',
    h1Class: 'low',
    h1: 'See the working app —<br><em>here and now.</em>',
    br: `Approve the full build and discovery starts within five working days. The week-3 gate confirms the plan before build spend.`,
    cta: 'Book a walkthrough',
    foot: `<div class="navp" style="gap:18px">${contact.map(([icon, label]) => `<span><svg><use href="#${icon}"/></svg>${label}</span>`).join('')}</div>`,
  }).replace('class="low"', 'class="low" style="bottom:160px"'),
);

const symbols = `<svg width="0" height="0" style="position:absolute"><defs>
<symbol id="ar" viewBox="0 0 32 32"><path d="M8 24 L24 8 M11 8 H24 V21" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-cal" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/></g></symbol>
<symbol id="i-loop" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 9a7.5 7.5 0 0 0-13.4-2.2M5 15a7.5 7.5 0 0 0 13.4 2.2"/><path d="M5.2 3.6v3.6h3.6M18.8 20.4v-3.6h-3.6"/></g></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></symbol>
<symbol id="i-chart" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 20h16M8 16v-5M12 16V7M16 16v-3"/></g></symbol>
<symbol id="i-globe" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></g></symbol>
<symbol id="i-user" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5c1.2-3.2 3.6-4.8 6.5-4.8s5.3 1.6 6.5 4.8"/></g></symbol>
<symbol id="i-mail" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/></g></symbol>
</defs></svg>`;

if (slides.length !== TOTAL) throw new Error(`Expected ${TOTAL} slides, built ${slides.length}`);

const html = `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>Scarlets One: fan app proposal and costing</title>
<meta name="author" content="${PROPOSER}">
<meta name="description" content="A proposal to build the full Scarlets One supporter app, with an itemised and audited costing. A proposal, not a club document.">
<style>
${readFileSync(join(here, 'styles.css'), 'utf8')}
</style>
</head>
<body>
${symbols}
${slides.join('\n')}
</body>
</html>
`;

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'deck.html'), html);
console.log(`[proposal] wrote build/deck.html: ${slides.length} slides, ${k(build.price)} build`);
