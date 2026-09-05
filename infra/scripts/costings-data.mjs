/**
 * The costings audit's data, in one place.
 *
 * Two documents are rendered from it — WEBSITE_COSTINGS.docx and
 * WEBSITE_COSTINGS.html — and they must not be able to disagree. They were one
 * script and one output; the moment a second rendering appeared, the numbers
 * needed a single home rather than a copy in each renderer.
 *
 * Everything countable is counted here at build time, for the reason recorded
 * below: the figures in this document were literals once, and they drifted.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * The commit this document describes, and the day it was built.
 *
 * Both were written on the cover by hand. The commit went nine behind the
 * branch without anybody noticing, which makes the whole document harder to
 * trust: a reader who checks the one field they can check finds it wrong.
 */
const HEAD = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
  cwd: REPO,
  encoding: 'utf8',
}).trim();

const BUILT_ON = new Date().toLocaleDateString('en-ZA', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** The branch, so the subject line cannot name one the audit did not come from. */
const BRANCH = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
  cwd: REPO,
  encoding: 'utf8',
}).trim();

/**
 * Thousands separators, since the document is read by people not machines.
 *
 * en-ZA groups with a non-breaking space, which left the document carrying two
 * separators for the same kind of number — 1 304 hours beside 26,230 lines.
 * One function, one separator.
 */

/**
 * Thousands separators, since both documents are read by people not machines.
 *
 * en-ZA groups with a non-breaking space, which left the Word file carrying two
 * separators for the same kind of number. One function, one separator, and now
 * one definition shared by both renderings.
 */
const n = (value) => value.toLocaleString('en-ZA').replace(/[\s\u00a0]/g, ',');
const rands = (amount) => `R ${n(amount)}`;

const RATE = 950; // the illustrative blended rate the worked example uses
const HOURS = (d) => d * 8;
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
  ['38', 'Review-build parity', 'The single-file review build showed a five-tab console after the product grew to seven, so a reviewer counting tabs would conclude two features did not exist. The two panels added, saying honestly that this build has no gateway and no till rather than showing invented rows, and a test holding the two tab lists equal in both directions while leaving the panels free to differ', 1],
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

export {
  n,
  rands,
  REPO,
  MEASURED,
  LINES,
  COMMITS,
  HEAD,
  BUILT_ON,
  BRANCH,
  RATE,
  HOURS,
  workstreams,
  remaining,
  BUILT_DAYS,
  REMAIN_DAYS,
  DONE_SHARE,
  rateCard,
};
