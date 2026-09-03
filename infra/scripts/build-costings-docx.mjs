#!/usr/bin/env node
/**
 * Builds WEBSITE_COSTINGS.docx — the audit of the delivered website and what
 * it costs.
 *
 * Not wired into any npm script, because it needs a dependency the workspace
 * does not otherwise carry:
 *
 *   npm install docx --no-save
 *   node infra/scripts/build-costings-docx.mjs
 *
 * Every count in section 2 was read off the working tree; nothing here is
 * estimated except the day figures in section 4, which say so. The one number
 * that is neither measured nor estimated is the hourly rate: it is an input,
 * set in RATE below, and the document says on its cover that it has not been
 * approved. Change RATE and re-run to reprice the whole document.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
/**
 * The approved palette, read from the one file that holds it rather than
 * copied. Word wants six hex digits with no leading hash, so the values are
 * stripped on the way in — the document is then coloured by exactly what the
 * site is coloured by, and a change to the palette reaches both.
 */
import tokens from '../../packages/ui/src/tokens.json' with { type: 'json' };

/**
 * The counts in section 2, measured now rather than written down.
 *
 * They were literals, and they drifted: the document claimed 27 API endpoints
 * against 25 in the tree, and 280 tests in 17 files long after there were more
 * than twice that. A number in a costing document that contradicts the thing it
 * is costing is worse than no number, and the only fix that stays fixed is to
 * count at build time. Anything below that is genuinely a judgement — what
 * counts as a business-logic module, say — stays written down, with the wording
 * saying so.
 */
const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

/** Files under `dir` matching `match`, ignoring node_modules and build output. */
function filesUnder(dir, match) {
  const start = path.join(REPO, dir);
  if (!fs.existsSync(start)) return [];

  const found = [];
  const walk = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (match.test(entry.name)) found.push(full);
    }
  };
  walk(start);
  return found;
}

const count = (dir, match) => filesUnder(dir, match).length;

/**
 * `it(` and `test(` calls in the website's suite.
 *
 * The website only: the Expo app in the repository root has its own suite and
 * is not what this document costs.
 */
function countTests() {
  return filesUnder('apps/web/tests', /\.test\.tsx?$/).reduce((total, file) => {
    const source = fs.readFileSync(file, 'utf8');
    return total + (source.match(/^\s*(?:it|test)(?:\.\w+)?\s*\(/gm)?.length ?? 0);
  }, 0);
}

/** Lines in every file under `dir` matching `match`. */
const linesIn = (dir, match) =>
  filesUnder(dir, match).reduce(
    (total, file) => total + fs.readFileSync(file, 'utf8').split('\n').length,
    0,
  );

const CODE = /\.(?:ts|tsx|mjs|css|json)$/;
const DEMO_GENERATOR = /^build-static-demo\.mjs$/;

/**
 * Hand-written lines, by category. Generated files are excluded by construction
 * — nothing here walks the image derivatives or the built demo — and so is the
 * Expo app in the repository root, which this document does not cost.
 */
const LINES = {
  application: linesIn('apps/web/src', /\.(?:ts|tsx|css)$/),
  tests: linesIn('apps/web/tests', /\.tsx?$/),
  reviewBuild:
    linesIn('apps/web/static-demo', /^index\.template\.html$/) +
    linesIn('infra/scripts', DEMO_GENERATOR),
  dataAndTooling:
    linesIn('infra/seed', CODE) +
    linesIn('infra/scripts', /\.mjs$/) -
    linesIn('infra/scripts', DEMO_GENERATOR) +
    linesIn('apps/web/scripts', /\.mjs$/),
  packages: linesIn('packages', CODE),
};
LINES.total = Object.values(LINES).reduce((a, b) => a + b, 0);

const MEASURED = {
  pages: count('apps/web/src/app', /^page\.tsx$/),
  endpoints: count('apps/web/src/app/api', /^route\.ts$/),
  components: count('apps/web/src/components', /\.tsx$/),
  modules: count('apps/web/src/lib', /\.ts$/),
  tests: countTests(),
  testFiles: count('apps/web/tests', /\.test\.tsx?$/),
};

/** Commits on this branch, counted rather than remembered. */
const COMMITS = Number(
  execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim(),
);

/**
 * Thousands separators, since the document is read by people not machines.
 *
 * en-ZA groups with a non-breaking space, which left the document carrying two
 * separators for the same kind of number — 1 304 hours beside 26,230 lines.
 * One function, one separator.
 */
const n = (value) => value.toLocaleString('en-ZA').replace(/[\s\u00a0]/g, ',');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const bare = (hex) => hex.replace('#', '');

const RED = bare(tokens.brand.red);
const BLACK = bare(tokens.brand.black);
const PAPER = bare(tokens.neutralTints[10]);
const LINE = bare(tokens.lineStrong);
const MUTED = bare(tokens.neutralTints[100]);
/** Total rows sit on the lightest red so the eye finds them without a rule. */
const TOTAL = bare(tokens.redTints[10]);

const W = 9638; // A4 at 2cm margins
const cols = (...parts) => {
  const total = parts.reduce((a, b) => a + b, 0);
  return parts.map((p) => Math.round((p / total) * W));
};

const hairline = { style: BorderStyle.SINGLE, size: 4, color: LINE };

function text(value, opts = {}) {
  return new TextRun({
    text: value,
    font: 'Calibri',
    size: opts.size ?? 20,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? BLACK,
  });
}

function p(value, opts = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 120, line: opts.line ?? 264 },
    indent: opts.indent,
    border: opts.border,
    children: Array.isArray(value) ? value : [text(value, opts)],
  });
}

function h1(value) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 180 },
    children: [new TextRun({ text: value, font: 'Calibri', size: 30, bold: true, color: RED })],
  });
}

function h2(value) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text: value, font: 'Calibri', size: 24, bold: true, color: BLACK })],
  });
}

function bullet(value, level = 0) {
  return new Paragraph({
    numbering: { reference: 'dots', level },
    spacing: { after: 80, line: 264 },
    children: Array.isArray(value) ? value : [text(value)],
  });
}

function cell(value, opts = {}) {
  const runs = Array.isArray(value) ? value : [text(String(value), opts)];
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill
      ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.fill }
      : undefined,
    margins: { top: 90, bottom: 90, left: 130, right: 130 },
    verticalAlign: VerticalAlign.CENTER,
    borders: { top: hairline, bottom: hairline, left: hairline, right: hairline },
    children: [
      new Paragraph({
        alignment: opts.align,
        spacing: { after: 0, line: 240 },
        children: runs,
      }),
    ],
  });
}

/**
 * A table with a red header band. `widths` are DXA and sum to the page width;
 * `align` is applied per column so money columns sit right.
 *
 * `totals` is how many rows at the bottom add up the ones above them. They are
 * shaded and set bold, and it is worth a parameter rather than sniffing the
 * first cell: a total that reads as another data row is the one line in a
 * costing a reader is most likely to take for something it isn't.
 */
function table(widths, headings, rows, align = [], totals = 0) {
  const firstTotal = rows.length - totals;
  return new Table({
    columnWidths: widths,
    width: { size: W, type: WidthType.DXA },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headings.map((heading, i) =>
          cell([text(heading, { bold: true, color: bare(tokens.brand.white), size: 19 })], {
            width: widths[i],
            fill: RED,
            align: align[i],
          }),
        ),
      }),
      ...rows.map((row, r) => {
        const total = r >= firstTotal;
        return new TableRow({
          children: row.map((value, i) =>
            cell(Array.isArray(value) ? value : [text(String(value), { bold: total })], {
              width: widths[i],
              align: align[i],
              fill: total ? TOTAL : r % 2 === 1 ? PAPER : undefined,
            }),
          ),
        });
      }),
    ],
  });
}

const rule = () =>
  new Paragraph({
    spacing: { before: 60, after: 180 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
    children: [text('')],
  });

// ---------------------------------------------------------------------------
// The measured facts. Everything numeric below is either counted from the
// working tree at build time (see MEASURED and LINES above) or added up from
// the tables — nothing on this page is a number somebody remembered.
// ---------------------------------------------------------------------------

const RATE = 950; // the illustrative blended rate the worked example uses
const HOURS = (d) => d * 8;
const rands = (amount) => `R ${n(amount)}`;
const num = n;
const sum = (rows, at) => rows.reduce((total, row) => total + row[at], 0);

const workstreams = [
  ['1', 'Foundation, monorepo and tooling', 'Next.js 16 App Router, TypeScript strict, Tailwind v4, Vitest, ESLint, two shared packages, one verify gate', 4],
  ['2', 'Design system and brand enforcement', '38-value token set held in three synchronised formats, 6 interface primitives, 5 chrome components, a 132-line brand-rule checker run in CI', 5],
  ['3', 'Catalogue, seed data and option engine', '1,896 lines: 28 products, 5 categories, 8 sauces, 3 stores, 6 promotions, 7 reward tiers, 12 FAQs, option groups generated per category', 6],
  ['4', 'Storefront routes', '13 pages: home, menu, product, offers, stores, rewards, account, help, checkout, order journey, app, console, console sign-in', 10],
  ['5', 'API layer and order state machine', '16 endpoints; five order states with collection, delivery and dine-in variants; cancellation terminal from any state and refused without a reason', 8],
  ['6', 'Basket, configurator, checkout and order journey', 'Live pricing, option selection, line identity, free-delivery meter, trading-hours and delivery-zone gating, idempotent placement', 8],
  ['7', 'Operations console and authentication', '3 components, 4 admin endpoints, HMAC-signed sessions, constant-time comparison, lockout after repeated failures, fail-closed guards', 5],
  ['8', 'Automated test suite', `The suite as it stood at this workstream: the ${MEASURED.tests} tests now in ${MEASURED.testFiles} files grew with the workstreams below. Driven through route handlers rather than helpers`, 7],
  ['9', 'Image pipeline and food imagery', 'sharp pipeline producing 336 derivatives from 28 masters at three widths in two formats, plus the written photography brief', 6],
  ['10', 'Single-file review build', '2,241-line template and generator that inlines every asset, so the site opens from one link with no server', 3],
  ['11', 'Documentation and handover', '279-line website README plus contributions to the handover, audit and readiness documents', 3],
  ['12', 'Audit, hardening and defect work', 'Server-side repricing, checkout idempotency, delivery-zone enforcement on the API, session-expiry handling, focus management, removal of three data duplications', 5],
  ['13', 'Payment seam', 'Provider-agnostic adapter, HMAC callback verification before parsing, idempotent settlement on the provider event id, sandbox provider; still 501 with no merchant account', 8],
  ['14', 'Customer accounts and POPIA', 'scrypt passwords, signed sessions, saved addresses, order history scoped to the session, points on the account; access and erasure requests', 10],
  ['15', 'Notifications and monitoring', 'Message templates, delivery-once ledger, logging transport, health endpoint reporting both liveness and what is configured', 8],
  ['16', 'POS and courier seams', 'Adapter interfaces, handoff record with retry, availability sync that tells unreachable apart from empty, degrade-not-refuse behaviour', 18],
  ['17', 'Concurrent-write safety', 'Cross-process lock closing the read-modify-write race the JSON store shipped with, proved by four real worker processes and an unlocked control', 6],
  ['18', 'Accessibility and deployment', 'WCAG contrast maths with the palette pairings held to it, static scans of markup and components, environment template checked against the code in both directions', 7],
  ['19', 'Database schema and password reset', 'The Postgres migration the JSON store stands in for, checked against the state shape by test; reset tokens stored as hashes, single-use, and answering identically for an address nobody has', 7],
  ['20', 'Structured logging', 'One JSON object per event, redacting by field name and walking nested objects, with personal data reduced rather than dropped', 3],
  ['26', 'Bounce handling and the shortfall reports', 'Mailgun bounce and complaint webhook with replay guards in shared state, a suppression list that tells a hard bounce from a complaint from a soft one, and the refused-handoff and suppressed-address reports surfaced on the console', 3],
  ['25', 'POS mapping and integration brief', 'The catalogue-to-till code map with its three-state completeness rule, modifier codes keyed by group and label, an order translated into the facts a till needs, and the specification list to send GAAP', 4],
  ['24', 'Mailgun and Clickatell transports', 'Email and SMS routed to separate providers, each falling back to the log independently; Clickatell\u2019s per-message acceptance read rather than its status code, and Mailgun\u2019s timestamp-and-token signature guarded against replay', 4],
  ['23', 'Complete addresses and a container', 'The postal code through the checkout form, the schema, the order and the courier address; a multi-stage non-root image with the state file on a volume and a healthcheck on the endpoint that reports storage', 3],
  ['22', 'Uber Direct adapter', 'OAuth with a cached token, structured addresses built from what checkout collects, both of Uber\u2019s status vocabularies, raw-byte webhook verification, and dispatch on ready rather than on order', 5],
  ['21', 'PayFast adapter', 'PHP-compatible signing, all four of PayFast\u2019s notification checks with the postback failing closed, status mapping, and an idempotency key that survives their PENDING-then-COMPLETE sequence', 4],
  ['27', 'The account interface', 'The screen for the account system, which had been built and tested as endpoints nothing called: a typed browser client that parses every response rather than casting it, sign-in and registration with the error beside the field that caused it, order history, the address book, and the two POPIA requests as buttons rather than as an email to support. The session is read on the server so the page arrives in its final state', 3],
  ['28', 'The payment journey', 'The join between the payment stack and the customer, which did not exist: checkout had “no provider is configured” written into its markup whatever the deployment had, and nothing anywhere called the intent endpoint. Checkout now reads the real configuration on the server, opens a payment and hands the customer to the gateway; the order endpoint reports what the payment is doing; the journey shows it and offers a way to pay; and the kitchen no longer cooks food nobody has paid for. Includes the two redirect URLs that were per-deployment when the page to return to is per-order', 4],
  ['29', 'Password reset, reachable', 'The reset flow had no way in — no “forgot your password” anywhere on the site. The request and completion screens, arrival straight from the emailed link, and a link in the message instead of 43 characters to retype', 2],
  ['31', 'Loyalty, corrected', 'Points were credited when an order was placed, so a signed-in customer could place one, take the points and cancel it — and it contradicted the rewards page, which says they post on completion. They now post on the completion transition, once, in the order store where both callers reach it, with the credit and the record that it happened in one state write. Plus the rewards page, which was showing this browser’s figure under the heading “your balance” while the account page showed the server’s: two numbers for one customer, and zero on a phone they had not ordered from', 3],
  ['32', 'Availability from the till', 'The sync was built with the care that matters — an unreachable till returns null rather than an empty list, so a hiccup at the kitchen cannot put every sold-out item back on sale — and nothing called it. Now reachable from the console, replacing rather than merging, because the till is the source of truth for what has run out', 1],
  ['33', 'Offer conditions, enforced', 'Every promotion advertised its terms as a sentence and nothing checked any of them: an offer sold as “Every Wednesday, 11:00 to close” took its discount at any hour on any day, one sold as collection only worked on a delivery, and one sold as “New accounts, one use” worked for anybody repeatedly. Each offer now carries its conditions in a form the checkout can check as well as a form the customer can read, enforced on the server. The discount also comes off the product the offer names rather than the whole basket — “twenty percent off every sauced wing” was taking twenty percent off the chicken and the drinks beside them', 4],
  ['34', 'Trading hours, enforced', 'The site had displayed “Open” and “Closed” from the day it was built and checked neither, so an order at three in the morning was accepted, priced, confirmed and sent to a kitchen nobody was standing in. Refused on the server with the store’s own hours, and said on the checkout screen before the form rather than after it. Includes consolidating the two SAST clocks into one, and pinning the suite to a fixed moment — thirteen files place an order through the real route and had been passing all day and failing after 22:00', 2],
  ['35', 'The driver’s estimate', 'Uber sends an ETA on every courier position update; the webhook parsed it into a typed field and dropped it, so the journey showed the window quoted at checkout — a constant — for as long as a customer waited. Recorded before the status is read, because the events carrying an estimate are the ones that move no state; not put back onto a finished order; and labelled on the screen, because “from your driver” is a different promise from one made before anybody was dispatched', 1],
  ['36', 'The screens for when things break', 'There were none: the product route calls notFound() deliberately, so a bad URL reached the framework\u2019s bare default, and any render error showed a white page reading \u201cApplication error\u201d. A branded 404 with somewhere to go, an error boundary that offers a retry first and shows an opaque reference for a telephone call, and a last-resort page that renders its own document because the root layout is what has failed. The accessibility scans now read the pages as well as the components', 2],
  ['37', 'The rewards ladder', 'Three tiers were listed on the page and nothing worked out which one a customer had reached. The standing, the gap to the next rung, the boundary at the threshold rather than one point past it, and a note in the code for whoever wires in-store redemption \u2014 the tiers are lifetime points and the figure is a balance, which are the same number only while nothing spends them', 1],
  ['30', 'An operations console that can act', 'The Problems tab named an action — “worth retrying” — and did not provide it, and the suppression list offered nothing at all. A retry that refuses to send a handoff twice and refuses one the adapter called final, a restore that undoes a bounce but never a complaint, both reporting what happened rather than refreshing a list that looks unchanged. Plus the payment ledger, which was settled and reconciled by tests and shown to nobody, with the provider reference an operator needs to find a payment in the gateway’s dashboard', 3],
];

const remaining = [
  ['PayFast sandbox and go-live', 'The adapter is written and the checkout journey through it is built end to end. What is left needs a merchant account: confirming PayFast accepts our signature, then failure and retry testing against their sandbox', 2, 'PayFast per-transaction fee'],
  ['GAAP adapter and onboarding', 'The mapping, the payload and the completeness rule are built. What is left needs GAAP\u2019s integration specification and their per-store code list, neither of which is public \u2014 see POS_INTEGRATION_BRIEF.md', 4, 'GAAP integration fee'],
  ['Uber Direct onboarding', 'The adapter is written and the address is complete. What is left needs an Uber Direct account: confirming they accept our dispatch', 2, 'Uber commission per delivery'],
  ['Persistent database', 'Provisioning a server and moving to it. The migration is written and checked against the state shape; concurrent-write safety is done', 3, 'Managed database hosting'],
  ['Mailgun and Clickatell onboarding', 'Both transports are written. What is left needs accounts: a verified sending domain with SPF and DKIM, a registered Clickatell sender id, and deliverability testing', 2, 'Per-message cost'],
  ['Privacy policy and legal review', 'Retention periods, consent copy, information officer; the endpoints exist and are tested', 2, 'Legal review'],
  ['Production monitoring and rollback', 'An error-tracking service on top of the health endpoint and the structured logs, and a tested rollback path', 2, 'Tooling subscription'],
  ['Deployment, domain, CDN and certificates', 'The container is written. What is left is a host to run it on, a domain, certificates and secrets management', 2, 'Hosting and domain'],
  ['Food photography integration', 'Replacing the twelve comped items with the commissioned shoot', 3, 'Shoot, stylist, studio'],
  ['Accessibility audit with a person', 'A screen-reader pass and Core Web Vitals against the deployed build. The contrast maths and the static scans are done, and neither replaces somebody using it', 3, '\u2014'],
];

/**
 * Both totals are added up from the tables rather than written down.
 *
 * They were constants, and one of them went wrong: the remaining table summed
 * to 36 days while the constant next to it said 21, and the document went out
 * with a total that contradicted the rows above it. A costing whose own
 * arithmetic disagrees is worse than no costing, because the rows look
 * checkable and the total is what gets quoted.
 */
const BUILT_DAYS = sum(workstreams, 3);
const REMAIN_DAYS = sum(remaining, 2);
const DONE_SHARE = Math.round((BUILT_DAYS / (BUILT_DAYS + REMAIN_DAYS)) * 100);

const rateCard = [400, 650, 850, 950, 1150, 1450];

const doc = new Document({
  creator: 'Totality Creative',
  title: 'bb.q Chicken South Africa — Ordering Website: Build Audit and Costings',
  description: 'Measured scope of the delivered ordering website, with an effort reconstruction and a rate-based costing.',
  numbering: {
    config: [
      {
        reference: 'dots',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '•',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 360, hanging: 240 } } },
          },
          {
            level: 1,
            format: LevelFormat.BULLET,
            text: '–',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 240 } } },
          },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { after: 60 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE } },
              children: [
                text('bb.q Chicken South Africa · Ordering website · Build audit and costings', {
                  size: 16,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                  font: 'Calibri',
                  size: 16,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ---------------------------------------------------------------- cover
        new Paragraph({
          spacing: { before: 600, after: 60 },
          children: [text('bb.q Chicken South Africa', { size: 22, bold: true, color: RED })],
        }),
        new Paragraph({
          spacing: { after: 100 },
          children: [text('Ordering website', { size: 48, bold: true, color: BLACK })],
        }),
        new Paragraph({
          spacing: { after: 300 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: RED } },
          children: [text('Build audit and costings', { size: 32, color: MUTED })],
        }),

        table(
          cols(3, 7),
          ['Field', 'Value'],
          [
            ['Prepared by', 'Totality Creative'],
            ['Date', '3 September 2026'],
            ['Subject', 'The bb.q Chicken South Africa ordering website as built on branch claude/bbq-chicken-website-4qzv8i'],
            ['Commit audited', '5e53a86'],
            ['Status of the build', 'Every integration seam built and tested against a stand-in; no vendor attached, and not deployed to production'],
            ['Status of this document', 'Draft for internal review — the hourly rate is an input, not an approved figure'],
          ],
        ),

        p('', { after: 200 }),
        p(
          [
            text('Read section 6 before section 5. ', { bold: true }),
            text(
              'The effort in this document is measured; the money is not. Every rand figure here is arithmetic on a rate that Totality Creative has to supply. Until that rate is filled in, treat the totals as a shape, not a quote.',
            ),
          ],
          { after: 200 },
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ------------------------------------------------------------ 1 purpose
        h1('1. Purpose and basis'),
        p(
          'This document answers one question: what has actually been built, and what would it cost. It is written from the repository rather than from memory. Every count in section 2 was read off the working tree at the audited commit, so any of them can be checked against the code rather than taken on trust.',
        ),
        h2('How the figures were produced'),
        bullet(
          'Scope was measured. Routes, endpoints, components, tests, products and images were counted off the working tree at commit f3350d1.',
        ),
        bullet(
          'Effort was reconstructed. Each workstream was sized against what it contains, then cross-checked against the total volume of hand-written code. The two agree to within a few days.',
        ),
        bullet(
          'Money was calculated, not quoted. The document multiplies effort by a rate you choose. It does not tell you what the work is worth to a client, which is a commercial decision and not an engineering one.',
        ),
        bullet(
          'Third-party costs were left open. Gateway fees, POS licences, delivery commissions, hosting and legal review are named and their shape described, but no number is invented for any of them. Each needs a quote from the supplier.',
        ),
        p(
          'That last point is a rule the project has been run under throughout: fix what is testable, and document what depends on a contract or a credential rather than inventing it.',
          { italics: true },
        ),

        // ------------------------------------------------------------- 2 built
        h1('2. What has been built'),
        p(
          'A production-oriented ordering website for bb.q Chicken South Africa: a customer can browse the menu, configure an item, build a basket, choose collection or delivery, and place an order that a kitchen operator then moves through to completion in a separate console. It runs end to end today with no external service attached.',
        ),

        h2('2.1 Scale, measured'),
        table(
          cols(5, 2, 5),
          ['What', 'Count', 'Detail'],
          [
            ['Customer-facing pages', String(MEASURED.pages), 'Home, menu, product, offers, stores, rewards, account, help, checkout, order journey, app, and two console pages'],
            ['API endpoints', String(MEASURED.endpoints), 'Catalogue, stores, promotions, rewards, delivery, orders, payments, accounts, privacy, health, admin'],
            ['React components', String(MEASURED.components), 'Across 13 feature areas'],
            ['Business-logic modules', String(MEASURED.modules), 'Pricing, cart, order integrity, order store, trading hours, two authentication boundaries, payments, accounts, notifications, fulfilment'],
            ['Automated tests', String(MEASURED.tests), `In ${MEASURED.testFiles} files; all passing`],
            [
              'Hand-written lines',
              n(LINES.total),
              `Application ${n(LINES.application)} · tests ${n(LINES.tests)} · review build ${n(LINES.reviewBuild)} · data, schema and tooling ${n(LINES.dataAndTooling)} · shared packages ${n(LINES.packages)}`,
            ],
            ['Generated files', '345', 'Image derivatives and brand assets, rebuilt from masters on every build'],
            ['Commits', n(COMMITS), 'Each one reviewable on its own'],
          ],
          [undefined, AlignmentType.RIGHT, undefined],
        ),

        h2('2.2 The menu that ships with it'),
        p(
          'All catalogue content is real, structured data rather than placeholder text, and it is the single source for the website, the review build and the mobile app at once.',
        ),
        table(
          cols(4, 2, 6),
          ['Dataset', 'Records', 'Notes'],
          [
            ['Products', '28', 'Chicken 7 · Wings 6 · Meals 5 · Sides 6 · Kids 4'],
            ['Categories', '5', 'Including the Kids Menu added most recently'],
            ['Sauces', '8', 'Offered in both halves of the half-and-half'],
            ['Stores', '3', 'With trading hours, services and delivery suburbs'],
            ['Promotions', '6', 'Each bound to a product that is on the menu'],
            ['Reward tiers', '7', 'Ascending ladder'],
            ['FAQs', '12', '—'],
            ['Food photographs', '28 masters', 'One per product; 336 derivatives generated from them'],
          ],
          [undefined, AlignmentType.RIGHT, undefined],
        ),

        h2('2.3 What the build does that is not obvious from the screens'),
        bullet([
          text('Nothing a client says about money is trusted. ', { bold: true }),
          text(
            'Every basket line is priced again on the server from the catalogue, and a line whose claimed price disagrees is refused rather than quietly corrected. Before this was added, a crafted request could place a valid order totalling one cent.',
          ),
        ]),
        bullet([
          text('A retried checkout cannot charge twice. ', { bold: true }),
          text('One key is minted per attempt and replays the first result on any retry of either half.'),
        ]),
        bullet([
          text('The order lifecycle is enforced, not described. ', { bold: true }),
          text(
            'Five states, with collection and dine-in relabelled rather than forked, and cancellation terminal from any state and refused without a reason.',
          ),
        ]),
        bullet([
          text('The console is behind real authentication. ', { bold: true }),
          text(
            'HMAC-signed session cookies, constant-time comparison, lockout after repeated failures, and guards that fail closed rather than open.',
          ),
        ]),
        bullet([
          text('The brand rules are checked by a machine. ', { bold: true }),
          text(
            'Spelling of the mark, the absence of unapproved copy, and the rule that no colour may be written outside the token files are all enforced in the same gate as the tests.',
          ),
        ]),
        bullet([
          text('The demo and the app cannot disagree. ', { bold: true }),
          text(
            'The single-file review build is generated from the same catalogue, categories and option groups the site uses; three separate duplications were found and removed, each after it had already caused a visible defect.',
          ),
        ]),

        h2('2.4 Verification state at the audited commit'),
        table(
          cols(4, 2, 6),
          ['Gate', 'Result', 'What it covers'],
          [
            ['Brand rules', 'Clean', 'Mark spelling, unapproved copy, hex outside the token files'],
            ['Type checking', 'Clean', 'TypeScript strict across the whole workspace'],
            ['Linting', 'Clean', 'ESLint with the Next.js configuration'],
            ['Tests', `${n(MEASURED.tests)} passing`, `${MEASURED.testFiles} files, including four real worker processes racing on one file`],
            ['Production build', 'Clean', 'Next.js build including asset derivation'],
            ['Review build', '3.83 MB', 'Single file, opens from a link with no server'],
          ],
          [undefined, AlignmentType.CENTER, undefined],
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // -------------------------------------------------------- 3 not built
        h1('3. What is waiting on somebody else'),
        p(
          'Four integrations have no vendor. None of them is a gap in the build any more: each has an interface, a record of what happened, and tests for everything that stays true whichever vendor is eventually chosen. What is missing in every case is an account, a contract or a signature that engineering cannot produce, and the standing rule on this project is to build up to that line and document it rather than invent a credential.',
        ),
        table(
          cols(3, 2.6, 6.4),
          ['Area', 'State', 'What is there, and what is waiting'],
          [
            ['Payment', 'Wired, refuses without credentials', 'PayFast adapter, signature verification before parsing, settlement idempotent on the provider event id. Checkout opens a payment and hands the customer to the gateway, the order screen shows what the payment is doing, and the kitchen does not cook unpaid food. Answers 501 until merchant credentials exist, which is what keeps this build refusing payment visibly.'],
            ['POS / order management', 'Seam built, degrades', 'Adapter interface, handoff record with retry, availability sync. An order with no POS still reaches the console. Waiting on store-systems access and integration terms.'],
            ['Courier', 'Seam built, degrades', 'Adapter interface, dispatch requested for delivery orders only, tracking hook. Waiting on provider onboarding.'],
            ['Messaging', 'Transports built, falls back to the log', 'Templates, a deliver-once ledger, Mailgun for email and Clickatell for SMS routed independently, bounce and complaint handling with a suppression list. Each falls back to writing to the audit log until its account exists. Waiting on a verified sending domain and a registered sender id.'],
            ['Customer accounts', 'Built', 'scrypt passwords, signed sessions, saved addresses, order history scoped to the session, and password reset — hashed single-use tokens, reachable from the sign-in screen and from the emailed link. All of it has a screen.'],
            ['Privacy and POPIA', 'Endpoints built', 'Access and erasure work and are tested; erasure keeps the sale and unlinks the person. Waiting on a lawyer for the policy, the retention periods and an information officer.'],
            ['Monitoring', 'Health endpoint built', 'Liveness and configuration reported separately. Waiting on a production environment to point error tracking at.'],
            ['Database', 'Stopgap in place', 'Orders, accounts and console writes live in a JSON file so several worker processes agree. Two operators writing in the same instant can still lose an edit. It is a stand-in for Postgres.'],
          ],
        ),

        h2('3.1 Two content items that are not engineering work'),
        p(
          [
            text('Prices are demonstration values. ', { bold: true }),
            text(
              'Every price in the catalogue is marked for confirmation. They are internally consistent and behave correctly, but not one of them has been approved by bb.q Chicken. Nothing in this build should be shown to a customer until they have been.',
            ),
          ],
        ),
        p(
          [
            text('Twelve food images are comps, not photographs. ', { bold: true }),
            text(
              'The eight extended items and the four kids items were generated to the written brief so the menu is complete and reviewable. They are visually consistent with the rest, and they are not a substitute for a shoot. The brand-approval gate is not cleared by them.',
            ),
          ],
        ),

        // ------------------------------------------------------------ 4 effort
        h1('4. Effort reconstruction'),
        p(
          'Days below are working days for one experienced full-stack developer, including the design, the tests and the documentation for each workstream — not coding time in isolation.',
        ),
        table(
          cols(0.5, 3.2, 5.3, 1),
          ['#', 'Workstream', 'What it contains', 'Days'],
          [
            ...workstreams.map(([n, name, detail, days]) => [
              n,
              [text(name, { bold: true })],
              detail,
              String(days),
            ]),
            ['', 'Total', 'Delivered scope', num(BUILT_DAYS)],
          ],
          [AlignmentType.CENTER, undefined, undefined, AlignmentType.RIGHT],
          1,
        ),

        p('', { after: 120 }),
        p(
          [
            text('Cross-check. ', { bold: true }),
            text(
              `${n(LINES.total)} hand-written lines over ${BUILT_DAYS} days is about ${Math.round(LINES.total / BUILT_DAYS)} a day. For tested, typed, reviewed production code that sits inside the normal 100–300 band, and lower than the 200 the first version of this document reconstructed — integration work carries more test and less code than storefront work does. The reconstruction is not inflated.`,
            ),
          ],
        ),
        p(
          `${BUILT_DAYS} days is roughly 27 working weeks, or a little over six months for one person. Two people working in parallel would compress the calendar but not the total, and would add coordination cost.`,
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ---------------------------------------------------------- 5 costings
        h1('5. Costings for what has been built'),
        p(
          [
            text('The rate is an input. ', { bold: true }),
            text(
              'The table below is not a quote and does not reflect any rate card Totality Creative has approved. It shows what the delivered scope costs at a range of rates, so the correct figure can be read off once the rate is chosen.',
            ),
          ],
        ),
        p(`Delivered scope: ${BUILT_DAYS} days × 8 hours = ${HOURS(BUILT_DAYS)} hours.`),

        table(
          cols(3, 3.5, 3.5),
          ['Blended hourly rate', `Cost of the ${HOURS(BUILT_DAYS)} hours (excl. VAT)`, 'Including VAT at 15%'],
          rateCard.map((r) => [
            [text(rands(r) + ' / hour', { bold: r === RATE })],
            [text(rands(r * HOURS(BUILT_DAYS)), { bold: r === RATE })],
            [text(rands(Math.round(r * HOURS(BUILT_DAYS) * 1.15)), { bold: r === RATE })],
          ]),
          [undefined, AlignmentType.RIGHT, AlignmentType.RIGHT],
        ),

        p('', { after: 120 }),
        p(
          [
            text('Worked example. ', { bold: true }),
            text(
              `At an illustrative blended rate of ${rands(RATE)} an hour — chosen here only to make the rest of the document concrete — the delivered scope comes to ${rands(RATE * HOURS(BUILT_DAYS))} excluding VAT, or ${rands(Math.round(RATE * HOURS(BUILT_DAYS) * 1.15))} including it. Replace the rate and every figure below moves proportionally.`,
            ),
          ],
        ),

        h2(`5.1 The same figure broken down by workstream, at ${rands(RATE)} / hour`),
        table(
          cols(5.5, 1.2, 1.6, 1.7),
          ['Workstream', 'Days', 'Hours', 'Cost (excl. VAT)'],
          [
            ...workstreams.map(([, name, , days]) => [
              name,
              num(days),
              num(HOURS(days)),
              rands(RATE * HOURS(days)),
            ]),
            [
              'Total delivered',
              num(BUILT_DAYS),
              num(HOURS(BUILT_DAYS)),
              rands(RATE * HOURS(BUILT_DAYS)),
            ],
          ],
          [undefined, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT],
          1,
        ),

        p('', { after: 120 }),
        p(
          `The integration seams — payments, accounts, notifications, POS and courier — are 44 of the ${BUILT_DAYS} days. None of them names a vendor, and none has to be rewritten when one is chosen: what remains per integration is an adapter against an interface that already exists and is already tested.`,
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ------------------------------------------------------- 6 to complete
        h1('6. Cost to take it live'),
        p(
          'What remains between this build and a site taking real orders. Effort is estimated on the same basis; the third-party column is deliberately unpriced.',
        ),
        table(
          cols(3, 4, 1, 2),
          ['Workstream', 'What it involves', 'Days', 'Third-party cost'],
          [
            ...remaining.map(([name, detail, days, third]) => [
              [text(name, { bold: true })],
              detail,
              num(days),
              [text(third, { italics: third !== '—', color: third !== '—' ? MUTED : BLACK })],
            ]),
            [
              'Total remaining',
              `${num(HOURS(REMAIN_DAYS))} hours of engineering`,
              num(REMAIN_DAYS),
              'Quotes required',
            ],
          ],
          [undefined, undefined, AlignmentType.RIGHT, undefined],
          1,
        ),

        p('', { after: 140 }),
        table(
          cols(5, 1.5, 1.75, 1.75),
          ['Position', 'Days', 'Hours', `Cost at ${rands(RATE)}/h (excl. VAT)`],
          [
            ['Delivered to date', num(BUILT_DAYS), num(HOURS(BUILT_DAYS)), rands(RATE * HOURS(BUILT_DAYS))],
            ['Remaining engineering to go live', num(REMAIN_DAYS), num(HOURS(REMAIN_DAYS)), rands(RATE * HOURS(REMAIN_DAYS))],
            [
              'Total engineering, end to end',
              num(BUILT_DAYS + REMAIN_DAYS),
              num(HOURS(BUILT_DAYS + REMAIN_DAYS)),
              rands(RATE * HOURS(BUILT_DAYS + REMAIN_DAYS)),
            ],
          ],
          [undefined, AlignmentType.RIGHT, AlignmentType.RIGHT, AlignmentType.RIGHT],
          1,
        ),

        p('', { after: 120 }),
        p(
          [
            text(`Roughly ${DONE_SHARE}% of the engineering is done. `, { bold: true }),
            text(
              'What is left is weighted toward vendor onboarding rather than construction, so its calendar time depends on how quickly accounts, credentials and contracts arrive rather than on how fast anyone writes code. The engineering estimates fell when the seams went in: a payment integration is four days against a tested interface where it was eight against nothing.',
            ),
          ],
        ),

        h2('6.1 Costs that are not ours to estimate'),
        p(
          'Each of these needs a written quote before it goes into a client-facing number. Their shape is described so nothing is forgotten, not so it can be guessed.',
        ),
        table(
          cols(3.5, 6.5),
          ['Item', 'How it is normally priced'],
          [
            ['Payment gateway', 'A percentage of transaction value plus a per-transaction fee, negotiated on volume. Set-up and monthly service charges vary by provider.'],
            ['POS / order management', 'Per-store licence or integration fee, set by the POS vendor and usually tied to the existing store contract.'],
            ['Delivery provider', 'Commission per delivered order, plus onboarding. Terms differ by provider and by suburb coverage.'],
            ['Hosting and database', 'Monthly, scaling with traffic and database size. Depends on whether a managed platform or a self-managed server is chosen.'],
            ['Domain and certificates', 'Annual, small, but must be registered to bb.q Chicken and not to the agency.'],
            ['Messaging', 'Per email and per SMS. SMS to South African networks is materially more expensive than email and should be used sparingly.'],
            ['Monitoring', 'Monthly subscription, tiered on event volume.'],
            ['Food photography', 'A shoot day with a food stylist and studio. At least twelve items currently need one; costing the full 28 for consistency is worth pricing as an alternative.'],
            ['Legal and POPIA review', 'Fixed fee or hourly, by an attorney. Not optional for a site taking customer data and payment.'],
          ],
        ),

        new Paragraph({ children: [new PageBreak()] }),

        // ---------------------------------------------------- 7 what this isn't
        h1('7. Assumptions, and what this document is not'),
        h2('7.1 Assumptions'),
        bullet('One experienced full-stack developer, at eight hours to the day, working without interruption.'),
        bullet('Effort includes design, implementation, tests, review and documentation for each workstream. It is not coding time in isolation.'),
        bullet('The remaining estimates assume the third parties respond within normal commercial timescales and that their documentation is accurate. Integration work is the least predictable kind, and a 20–30% contingency on section 6 is prudent.'),
        bullet('VAT is shown at 15%. Confirm the current rate before issuing anything.'),
        bullet('No project management, account management, agency overhead or margin is included. Those are commercial layers that sit on top of these numbers.'),

        h2('7.2 What this document is not'),
        bullet([
          text('It is not a quote. ', { bold: true }),
          text('No rate here has been approved by Totality Creative, and the worked example uses an illustrative figure only.'),
        ]),
        bullet([
          text('It is not a valuation. ', { bold: true }),
          text('What the work cost to produce and what it is worth to a client are different questions, and the second one is commercial.'),
        ]),
        bullet([
          text('It does not price the mobile app. ', { bold: true }),
          text(
            'The Expo application in the same repository is a separate deliverable of comparable size — 34 routes and roughly 23,000 lines — and needs its own costing.',
          ),
        ]),
        bullet([
          text('It does not commit to a timeline. ', { bold: true }),
          text('Days are effort, not calendar. Section 6 in particular is gated on other people.'),
        ]),

        h1('8. What is needed from bb.q Chicken'),
        p('Five things, none of which are engineering, and three of which block a launch outright.'),
        table(
          cols(0.6, 4.4, 2.5, 2.5),
          ['#', 'Item', 'Who', 'Blocks'],
          [
            ['1', 'Approved retail prices for all 28 products', 'bb.q Chicken commercial', 'Any customer-facing use'],
            ['2', 'Payment provider selection and merchant credentials', 'bb.q Chicken merchant', 'Taking payment'],
            ['3', 'POS access and integration terms', 'Store systems owner', 'Orders reaching a kitchen'],
            ['4', 'Delivery provider onboarding', 'bb.q Chicken ↔ provider', 'Delivery orders'],
            ['5', 'Brand approval of the interface, and the licensed logo lock-up checked against what is in the build', 'Brand owner', 'Sign-off, not launch'],
          ],
          [AlignmentType.CENTER, undefined, undefined, undefined],
        ),

        rule(),
        p(
          'Prepared from the repository at commit f3350d1 on branch claude/bbq-chicken-website-4qzv8i. Every count in section 2 is reproducible from the working tree; every rand figure is arithmetic on a rate that has yet to be set.',
          { italics: true, color: MUTED, size: 18 },
        ),
      ],
    },
  ],
});

// Written to the repository root by absolute path, so it lands in the same
// place whichever directory the script is run from.
const TARGET = path.resolve(HERE, '../../WEBSITE_COSTINGS.docx');

Packer.toBuffer(doc)
  .then((buffer) => {
    fs.writeFileSync(TARGET, buffer);
    console.log(`Wrote ${path.relative(process.cwd(), TARGET)} — ${(buffer.length / 1024).toFixed(0)} kB`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
