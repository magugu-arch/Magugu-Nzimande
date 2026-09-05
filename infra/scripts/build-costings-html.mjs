#!/usr/bin/env node
/**
 * Builds WEBSITE_COSTINGS.html — the same audit as the Word file, as a page.
 *
 *   node infra/scripts/build-costings-html.mjs
 *
 * Needs no dependency at all, which is the difference from its sibling: the
 * Word renderer needs `docx` installed, this one writes a string. Both read
 * every figure from `costings-data.mjs`, so the two documents cannot disagree
 * — which is the whole reason that module exists.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tokens from '../../packages/ui/src/tokens.json' with { type: 'json' };
import {
  BRANCH,
  BUILT_DAYS,
  BUILT_ON,
  COMMITS,
  DONE_SHARE,
  HEAD,
  HOURS,
  LINES,
  MEASURED,
  RATE,
  REMAIN_DAYS,
  n,
  rands,
  rateCard,
  remaining,
  workstreams,
} from './costings-data.mjs';

/**
 * The palette, derived rather than transcribed.
 *
 * Nothing below writes a colour down. The light theme names tokens; the dark
 * theme blends them. That is not a style preference — the brand checker forbids
 * a raw hex value outside the two token files, and it caught this script with
 * eleven of them the first time it ran. A document that describes the build has
 * no more licence to keep its own copy of the palette than a page in the build
 * does: a copy is a colour that stops matching the day the token changes.
 */

const channels = (hex) => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

/** `t` of the way from `from` to `to`, as a CSS rgb() — no hex is produced. */
const mix = (from, to, t) => {
  const a = channels(from);
  const b = channels(to);
  const at = (i) => Math.round(a[i] + (b[i] - a[i]) * t);
  return `rgb(${at(0)} ${at(1)} ${at(2)})`;
};

const { black, white, red, gold } = tokens.brand;

/**
 * Red does three jobs and so has three names.
 *
 * `--red` fills — table headings, the badge, every rule — and `--on-red` is what
 * sits on that fill. `--red-ink` is red used as text on the page itself, and
 * `--red-on-band` is red used as text on the black masthead. Splitting them is
 * not decoration: the approved red on the brand black is 3.0:1, which is under
 * the line for a small label, and on a dark page ground it is 2.7:1. The tint is
 * the same red with the contrast put back, and it is used exactly where the full
 * one cannot be read.
 */

const light = {
  ink: black,
  paper: tokens.neutralTints[10],
  surface: white,
  line: tokens.lineStrong,
  muted: tokens.neutralTints[100],
  red,
  'red-ink': red,
  'red-on-band': tokens.redTints[80],
  'red-wash': tokens.redTints[10],
  gold,
  'on-red': white,
  band: black,
  'band-ink': white,
  'band-muted': tokens.neutralTints[60],
};

/**
 * Dark is the same palette turned over, not a second one.
 *
 * The brand black is the darkest value the token file has, so it becomes the
 * masthead — the one surface that must sit below everything else — and the page
 * around it is that black lifted a few percent towards white. Panels are lifted
 * further. The order is what makes the band a band; the amounts are small
 * because the brand black is nearly the ground already.
 *
 * `--red` stays the approved red even here, because what sits on it is white
 * either way and the pair reads at 5.2:1 in both themes. It is the red used as
 * text that moves to the tint.
 */
const dark = {
  ink: tokens.neutralTints[10],
  paper: mix(black, white, 0.05),
  surface: mix(black, white, 0.1),
  line: mix(black, white, 0.2),
  muted: tokens.blackTints[40],
  red,
  'red-ink': tokens.redTints[80],
  'red-on-band': tokens.redTints[80],
  'red-wash': mix(black, red, 0.22),
  gold,
  'on-red': white,
  band: black,
  'band-ink': tokens.neutralTints[10],
  'band-muted': tokens.blackTints[40],
};

const vars = (palette, indent) =>
  Object.entries(palette)
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join('\n');

/** Data goes through here on its way into markup, without exception. */
const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const END_DAYS = BUILT_DAYS + REMAIN_DAYS;

const facts = [
  ['Prepared by', 'Magugu Nzimande'],
  ['Date', BUILT_ON],
  ['Branch', BRANCH],
  ['Commit audited', HEAD],
  ['Basis', 'One experienced full-stack developer, eight-hour days'],
];

const scale = [
  ['Customer-facing pages', MEASURED.pages],
  ['API endpoints', MEASURED.endpoints],
  ['React components', MEASURED.components],
  ['Business-logic modules', MEASURED.modules],
  ['Automated tests', MEASURED.tests],
  ['Test files', MEASURED.testFiles],
  ['Hand-written lines', LINES.total],
  ['Commits', COMMITS],
];

const lineSplit = [
  ['Application', LINES.application],
  ['Tests', LINES.tests],
  ['Review build', LINES.reviewBuild],
  ['Data, schema and tooling', LINES.dataAndTooling],
  ['Shared packages', LINES.packages],
];

const blockers = [
  ['Catalogue prices', 'All 28 carry [CONFIRM]. DEMO_DATA is still set, and a test fails if that flag and the README ever disagree.', 'The franchisor'],
  ['Merchant credentials', 'The PayFast adapter and the checkout journey through it are built. Payment refuses without an account.', 'bb.q Chicken SA'],
  ['POS specification', 'The catalogue-to-till map and the order payload are built against no vendor. GAAP has supplied nothing public.', 'GAAP'],
  ['Courier account', 'The Uber Direct adapter is written and tested against a stubbed API.', 'Uber'],
  ['Sending domain', 'Mailgun and Clickatell transports are written. Each falls back to the audit log until its account exists.', 'bb.q Chicken SA'],
  ['Privacy policy', 'The POPIA access and erasure endpoints work and are tested. The policy, the retention periods and the information officer are not engineering.', 'A lawyer'],
  ['A production environment', 'The container is written. Monitoring and a tested rollback need somewhere to point at.', 'Platform owner'],
  ['Photography', 'Twelve items wear a comped image pending the commissioned shoot.', 'Studio'],
  ['A screen-reader pass', 'The contrast maths and the static scans are done. Neither replaces somebody using it.', 'An accessibility tester'],
];

const rows = (data, render) => data.map(render).join('\n');

const html = `<title>bb.q Chicken Build Audit</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;500;600;800&display=swap">
<style>
  /*
    The palette is the site's own token file, not a second one invented for the
    document about it. Every value here was read from packages/ui/src/tokens.json
    when this page was generated; the dark theme blends the same tokens.

    Three blocks and not two. A reader who has never chosen a theme gets the
    system one through the media query, and a reader who has chosen gets the
    attribute — which has to win in both directions, so it is written out again
    rather than left to the query.
  */
  :root {
${vars(light, '    ')}
  }

  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
${vars(dark, '      ')}
    }
  }

  :root[data-theme="dark"] {
${vars(dark, '    ')}
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: Montserrat, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 15px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
  }

  .display {
    font-family: "Bebas Neue", Oswald, "Arial Narrow", Impact, sans-serif;
    font-weight: 400;
    letter-spacing: 0.01em;
    text-wrap: balance;
  }

  /* The measure. Prose sits here; tables break out of it. */
  .wrap { width: min(100% - 2.5rem, 62rem); margin-inline: auto; }
  .measure { max-width: 68ch; }

  /* ---------------------------------------------------------- masthead --- */

  .masthead {
    background: var(--band);
    color: var(--band-ink);
    padding: clamp(2.5rem, 6vw, 4.5rem) 0 clamp(2rem, 4vw, 3rem);
    border-bottom: 4px solid var(--red);
  }
  .eyebrow {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin: 0;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--red-on-band);
  }
  .eyebrow::before {
    content: "";
    width: 1.6rem;
    height: 2px;
    background: var(--red-on-band);
  }
  .masthead h1 {
    margin: 0.6rem 0 0;
    font-size: clamp(2.6rem, 7vw, 4.4rem);
    line-height: 0.94;
  }
  .masthead .standfirst {
    margin: 1rem 0 0;
    max-width: 54ch;
    color: var(--band-muted);
    font-size: 1rem;
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
    gap: 1.25rem 2rem;
    margin: 2.5rem 0 0;
    padding-top: 1.75rem;
    border-top: 1px solid rgb(255 255 255 / 0.14);
  }
  .facts dt {
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--band-muted);
  }
  .facts dd {
    margin: 0.3rem 0 0;
    font-size: 0.92rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* ------------------------------------------------------------ notice --- */

  .notice {
    margin: 2.5rem 0 0;
    padding: 1.15rem 1.35rem;
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 4px solid var(--gold);
  }
  .notice p { margin: 0; }
  .notice p + p { margin-top: 0.6rem; }
  .notice strong { font-weight: 800; }

  /* ---------------------------------------------------------- sections --- */

  section { margin-top: clamp(3rem, 7vw, 4.5rem); }

  .head {
    display: flex;
    align-items: baseline;
    gap: 0.9rem;
    padding-bottom: 0.65rem;
    border-bottom: 2px solid var(--ink);
  }
  .head .num {
    font-family: "Bebas Neue", Oswald, sans-serif;
    font-size: 1.9rem;
    line-height: 1;
    color: var(--red-ink);
  }
  .head h2 { margin: 0; font-size: 1.45rem; line-height: 1.1; }
  section > p { margin: 1rem 0 0; }

  /* ------------------------------------------------------------ tables --- */

  .scroll { overflow-x: auto; margin-top: 1.5rem; border: 1px solid var(--line); }
  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--surface); }
  caption { text-align: left; padding: 0 0 0.6rem; color: var(--muted); font-size: 0.8rem; }
  th, td { padding: 0.62rem 0.85rem; text-align: left; vertical-align: top; }
  thead th {
    background: var(--red);
    color: var(--on-red);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  tbody tr + tr { border-top: 1px solid var(--line); }
  tbody tr:nth-child(even) { background: var(--paper); }
  .num-col { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .id-col { color: var(--muted); font-variant-numeric: tabular-nums; width: 2.5rem; }
  .what { font-weight: 600; }
  .detail { color: var(--muted); font-size: 0.8rem; line-height: 1.5; }
  tfoot td {
    background: var(--red-wash);
    font-weight: 800;
    border-top: 2px solid var(--red);
  }

  /* The rate the worked example uses, marked in its own row. */
  tr.here td { background: var(--red-wash); font-weight: 800; }
  tr.here td:first-child::after {
    content: "worked example";
    display: inline-block;
    margin-left: 0.6rem;
    padding: 0.1rem 0.45rem;
    background: var(--red);
    color: var(--on-red);
    font-size: 0.6rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    vertical-align: 0.1em;
  }

  /* ------------------------------------------------------------ totals --- */

  .totals {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 1px;
    margin-top: 1.5rem;
    background: var(--line);
    border: 1px solid var(--line);
  }
  .totals > div { background: var(--surface); padding: 1.1rem 1.25rem; }
  .totals dt {
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .totals dd {
    margin: 0.35rem 0 0;
    font-family: "Bebas Neue", Oswald, sans-serif;
    font-size: 2.1rem;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .totals .unit { color: var(--muted); font-size: 0.75rem; font-weight: 600; }

  /*
    The project's own marker for a value nobody has approved.

    A chip rather than gold text. The gold is a brand token and it is the right
    signal here, but as ink on the paper it reads at 1.8:1 — the one marker on
    the page that has to be noticed would have been the hardest thing on it to
    see. Behind the text instead, it carries the ink at 7.9:1 in both themes.
  */
  .confirm {
    display: inline-block;
    padding: 0.05em 0.4em;
    background: var(--gold);
    color: ${black};
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.78em;
    font-weight: 700;
    white-space: nowrap;
  }

  footer {
    margin: clamp(3.5rem, 8vw, 5rem) 0 0;
    padding: 2rem 0 3rem;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.8rem;
  }
  footer p { margin: 0; max-width: 70ch; }
  footer p + p { margin-top: 0.7rem; }

  @media (prefers-reduced-motion: reduce) {
    * { animation: none !important; transition: none !important; }
  }
</style>

<header class="masthead">
  <div class="wrap">
    <p class="eyebrow">Build audit and costings</p>
    <h1 class="display">bb.q Chicken<br>ordering website</h1>
    <p class="standfirst">
      What was built, measured from the repository rather than remembered, and what
      is left before it can take a real order.
    </p>

    <dl class="facts">
      ${rows(facts, ([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)}
    </dl>
  </div>
</header>

<main class="wrap">

  <div class="notice measure">
    <p><strong>Read this before the money.</strong> The effort here is measured; the
    money is not. Every rand figure is arithmetic on a rate of
    <strong>${rands(RATE)} an hour</strong>, which is an input rather than an
    approved figure — no rate on this page has been approved by anyone. Section 6
    prices the same scope across a range so the correct total can be read off once
    a rate is chosen.</p>
    <p>Every catalogue price in the build carries <span class="confirm">[CONFIRM]</span>.
    Nothing customer-facing can go live until the franchisor supplies real ones, and
    none have been invented.</p>
  </div>

  <section>
    <div class="head"><span class="num">1</span><h2>Scale, measured</h2></div>
    <p class="measure">Counted from the working tree when this page was generated, not
    written down. Both this page and the Word version read the same figures from one
    module, so they cannot disagree with each other or with the repository.</p>

    <div class="scroll">
      <table>
        <thead><tr><th>What</th><th class="num-col">Count</th></tr></thead>
        <tbody>
          ${rows(scale, ([k, v]) => `<tr><td class="what">${esc(k)}</td><td class="num-col">${n(v)}</td></tr>`)}
        </tbody>
      </table>
    </div>

    <div class="scroll">
      <table>
        <caption>Hand-written lines, by category. Generated files are excluded by construction.</caption>
        <thead><tr><th>Category</th><th class="num-col">Lines</th></tr></thead>
        <tbody>
          ${rows(lineSplit, ([k, v]) => `<tr><td class="what">${esc(k)}</td><td class="num-col">${n(v)}</td></tr>`)}
        </tbody>
        <tfoot><tr><td>Total</td><td class="num-col">${n(LINES.total)}</td></tr></tfoot>
      </table>
    </div>
  </section>

  <section>
    <div class="head"><span class="num">2</span><h2>What was built</h2></div>
    <p class="measure">Days are working days for one experienced full-stack developer,
    including the design, the tests and the documentation for each workstream — not
    coding time with everything else deducted. Each was sized against what it contains,
    then cross-checked against the total volume of hand-written code; the two agree to
    within a few days.</p>

    <div class="scroll">
      <table>
        <thead>
          <tr><th class="id-col">#</th><th>Workstream</th><th>What it contains</th><th class="num-col">Days</th></tr>
        </thead>
        <tbody>
          ${rows(
            workstreams,
            ([id, title, detail, days]) =>
              `<tr><td class="id-col">${esc(id)}</td><td class="what">${esc(title)}</td><td class="detail">${esc(detail)}</td><td class="num-col">${n(days)}</td></tr>`,
          )}
        </tbody>
        <tfoot>
          <tr><td colspan="3">Delivered scope</td><td class="num-col">${n(BUILT_DAYS)}</td></tr>
        </tfoot>
      </table>
    </div>

    <dl class="totals">
      <div><dt>Delivered</dt><dd>${n(BUILT_DAYS)} <span class="unit">days</span></dd></div>
      <div><dt>At eight hours</dt><dd>${n(HOURS(BUILT_DAYS))} <span class="unit">hours</span></dd></div>
      <div><dt>At ${rands(RATE)}/hour</dt><dd>${rands(RATE * HOURS(BUILT_DAYS))}</dd></div>
    </dl>
  </section>

  <section>
    <div class="head"><span class="num">3</span><h2>What remains</h2></div>
    <p class="measure">Ten workstreams, ${n(REMAIN_DAYS)} days, and not one of them can
    start today. Each is waiting on an account, a contract, a specification or a person —
    the engineering behind every seam is built and tested against a stand-in. The
    third-party column is deliberately unpriced.</p>

    <div class="scroll">
      <table>
        <thead>
          <tr><th>Workstream</th><th>What it involves</th><th class="num-col">Days</th><th>Third-party cost</th></tr>
        </thead>
        <tbody>
          ${rows(
            remaining,
            ([name, detail, days, third]) =>
              `<tr><td class="what">${esc(name)}</td><td class="detail">${esc(detail)}</td><td class="num-col">${n(days)}</td><td class="detail">${esc(third)}</td></tr>`,
          )}
        </tbody>
        <tfoot>
          <tr><td colspan="2">Total remaining</td><td class="num-col">${n(REMAIN_DAYS)}</td><td>Quotes required</td></tr>
        </tfoot>
      </table>
    </div>
  </section>

  <section>
    <div class="head"><span class="num">4</span><h2>End to end</h2></div>

    <div class="scroll">
      <table>
        <thead>
          <tr><th>Scope</th><th class="num-col">Days</th><th class="num-col">Hours</th><th class="num-col">At ${rands(RATE)}/hour</th></tr>
        </thead>
        <tbody>
          <tr><td class="what">Delivered to date</td><td class="num-col">${n(BUILT_DAYS)}</td><td class="num-col">${n(HOURS(BUILT_DAYS))}</td><td class="num-col">${rands(RATE * HOURS(BUILT_DAYS))}</td></tr>
          <tr><td class="what">Remaining to go live</td><td class="num-col">${n(REMAIN_DAYS)}</td><td class="num-col">${n(HOURS(REMAIN_DAYS))}</td><td class="num-col">${rands(RATE * HOURS(REMAIN_DAYS))}</td></tr>
        </tbody>
        <tfoot>
          <tr><td>Total engineering</td><td class="num-col">${n(END_DAYS)}</td><td class="num-col">${n(HOURS(END_DAYS))}</td><td class="num-col">${rands(RATE * HOURS(END_DAYS))}</td></tr>
        </tfoot>
      </table>
    </div>

    <p class="measure">${DONE_SHARE}% of the engineering is done. What is left is weighted
    toward vendor onboarding rather than construction, so its calendar time depends on how
    quickly accounts, credentials and contracts arrive rather than on how fast anyone
    writes code.</p>

    <p class="measure">${n(LINES.total)} hand-written lines over ${n(BUILT_DAYS)} days is
    about ${Math.round(LINES.total / BUILT_DAYS)} a day. For tested, typed, reviewed
    production code that sits inside the normal 100–300 band — integration work carries
    more test and less code than storefront work does.</p>
  </section>

  <section>
    <div class="head"><span class="num">5</span><h2>The same scope, at other rates</h2></div>
    <p class="measure">Not a quote, and it does not reflect any approved rate card. It
    shows what the delivered scope costs at a range of rates, so the correct figure can be
    read off once a rate is chosen.</p>

    <div class="scroll">
      <table>
        <thead>
          <tr><th class="num-col">Rate</th><th class="num-col">Delivered (${n(HOURS(BUILT_DAYS))} h)</th><th class="num-col">Remaining (${n(HOURS(REMAIN_DAYS))} h)</th><th class="num-col">End to end</th></tr>
        </thead>
        <tbody>
          ${rows(
            rateCard,
            (rate) =>
              `<tr${rate === RATE ? ' class="here"' : ''}><td class="num-col">${rands(rate)}</td><td class="num-col">${rands(rate * HOURS(BUILT_DAYS))}</td><td class="num-col">${rands(rate * HOURS(REMAIN_DAYS))}</td><td class="num-col">${rands(rate * HOURS(END_DAYS))}</td></tr>`,
          )}
        </tbody>
      </table>
    </div>
  </section>

  <section>
    <div class="head"><span class="num">6</span><h2>What blocks go-live</h2></div>
    <p class="measure">Every item here is outside engineering. The code each one waits
    behind is written, tested, and refuses or falls back honestly until its input arrives.</p>

    <div class="scroll">
      <table>
        <thead><tr><th>Blocker</th><th>Where the build stands</th><th>Whose call</th></tr></thead>
        <tbody>
          ${rows(
            blockers,
            ([what, where, who]) =>
              `<tr><td class="what">${esc(what)}</td><td class="detail">${esc(where)}</td><td class="detail">${esc(who)}</td></tr>`,
          )}
        </tbody>
      </table>
    </div>
  </section>

  <footer>
    <p>Audited at commit <strong>${esc(HEAD)}</strong> on <strong>${esc(BRANCH)}</strong>,
    ${esc(BUILT_ON)}. Prepared by Magugu Nzimande.</p>
    <p>Every count on this page is read from the repository when the page is generated,
    and the Word version is rendered from the same module. No project management, account
    management, agency overhead or margin is included — those are commercial layers that
    sit on top of these numbers.</p>
  </footer>

</main>
`;

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TARGET = path.resolve(HERE, '../../WEBSITE_COSTINGS.html');
fs.writeFileSync(TARGET, html);
console.log(
  `Wrote ${path.relative(process.cwd(), TARGET)} — ${(html.length / 1024).toFixed(0)} kB`,
);
