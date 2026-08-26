#!/usr/bin/env node
/**
 * What must be true before a production build is worth making.
 *
 * The app was built against invented data so it could be explored before a
 * backend or a signed store list existed: seven fictional branches with
 * fictional phone numbers, and placeholder ids in the build config. None of
 * that is a defect while it is a demo. All of it is a defect the moment a
 * customer can download it.
 *
 * Nothing else in the repo distinguishes those two states, so this does. It is
 * advisory by default and fails hard with `--production`, which is how the
 * production build should call it.
 *
 * Run: npm run audit:launch          (report)
 *      npm run audit:launch -- --production   (fail on anything unresolved)
 */
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--production');

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

/** @type {{ area: string, detail: string, whose: string }[]} */
const blockers = [];
const note = (area, detail, whose) => blockers.push({ area, detail, whose });

const app = json('app.json').expo;
const eas = json('eas.json');

// --- Identity the build system needs -------------------------------------

const PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000';

if (app.extra?.eas?.projectId === PLACEHOLDER_UUID) {
  note('EAS project', '`eas init` has not been run — projectId is still the placeholder.', 'you');
}

if (typeof app.updates?.url === 'string' && app.updates.url.includes(PLACEHOLDER_UUID)) {
  note(
    'OTA updates',
    'updates.url still points at the placeholder project. `eas init` rewrites it; without that, ' +
      'a shipped binary can never receive an update.',
    'you',
  );
}

for (const field of ['appleId', 'ascAppId', 'appleTeamId']) {
  const value = eas.submit?.production?.ios?.[field];
  if (typeof value === 'string' && value.endsWith('_PLACEHOLDER')) {
    note('App Store Connect', `eas.json submit.production.ios.${field} is unfilled.`, 'you');
  }
}

/**
 * The one address in this repo that nothing here can check.
 *
 * `api.bbqchicken.co.za` is written into app.json, eas.json and the source
 * default, and it does not answer — the app's own reachability probe fails
 * against it at the transport, which is how it was noticed. In a mock build
 * that is now harmless. In a production build it is an app that cannot fetch
 * a menu, sign anyone in, or take an order, and it will look like a network
 * fault rather than a wrong address.
 */
const apiHost = eas.build?.production?.env?.EXPO_PUBLIC_API_BASE_URL ?? app.extra?.apiBaseUrl;
if (apiHost) {
  note(
    'API host',
    `The production build points at ${apiHost}. Nothing in this repo can tell whether that ` +
      'host exists, is yours, or serves the endpoints the app calls — the app only finds out ' +
      'in a customer\'s hand. Confirm it answers before shipping.',
    'you',
  );
}

// --- Data a customer would act on ----------------------------------------

const storeData = read('src/services/data/storeData.ts');
const storeNames = [...storeData.matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
const storePhones = [...storeData.matchAll(/phone: '([^']+)'/g)].map((m) => m[1]);

if (storeNames.length > 0) {
  note(
    'Store list',
    `${storeNames.length} branches are seeded demo data (${storeNames.slice(0, 2).join(', ')}…) ` +
      `with invented phone numbers (${storePhones[0]}). Two branches open this year — ` +
      '1 October and 1 November — so this list is wrong in count as well as detail. A customer ' +
      'tapping "Call the store" reaches a stranger.',
    'you',
  );
}

// The radius decides who is offered delivery at all. A placeholder here is a
// promise to drive somewhere nobody has agreed to drive.
const radii = [...new Set([...storeData.matchAll(/deliveryRadiusKm: (\d+)/g)].map((m) => m[1]))];
if (radii.length === 1) {
  note(
    'Delivery radius',
    `Every branch carries the same seeded ${radii[0]} km radius. Each one's real range depends ` +
      'on its drivers and its area, and this is what decides whether a customer is offered ' +
      'delivery at all.',
    'you',
  );
}

// An opening date that has passed silently turns into "open for business".
const openings = [...storeData.matchAll(/opensOn: '([^']+)'/g)].map((m) => m[1]);
for (const opening of openings) {
  const when = new Date(opening);
  if (!Number.isNaN(when.getTime()) && when.getTime() < Date.now()) {
    note(
      'Opening dates',
      `A branch is marked as opening on ${opening}, which has passed — it will now be treated ` +
        'as trading. Confirm that is true before a build.',
      'you',
    );
  }
}

// The menu prices are what a customer is charged. Fictional ones are worse
// than an empty menu, because they look authoritative.
const menuData = read('src/services/data/menuData.ts');
const priceCount = [...menuData.matchAll(/basePrice: \d+/g)].length;
if (priceCount > 0) {
  note(
    'Menu and prices',
    `${priceCount} products carry seeded prices. These are placeholders until signed off by ` +
      'the franchise — every one of them is a number a customer is asked to pay.',
    'you',
  );
}

// Rewards now honour an expiry date, and not one seeded reward carries one —
// so every reward in the app is open-ended forever. That is a policy call, not
// a code one, and the birthday reward makes it concrete: a birthday treat with
// no window can be claimed any day of the year.
const rewardsData = read('src/services/data/rewardsData.ts');
const rewardBlock = rewardsData.slice(0, rewardsData.indexOf('export const vouchers'));
const rewardCount = [...rewardBlock.matchAll(/pointsCost: \d+/g)].length;
const rewardExpiries = [...rewardBlock.matchAll(/expiresAt:/g)].length;
if (rewardCount > 0 && rewardExpiries === 0) {
  note(
    'Reward expiry',
    `None of the ${rewardCount} seeded rewards carries an expiry date, so each one stands ` +
      'forever. The app enforces `expiresAt` now — it just has nothing to enforce. Decide how ' +
      'long each reward should stand, the birthday one especially.',
    'you',
  );
}

/**
 * The tier perks are shown to customers as a rate, and the code pays one flat
 * rate to everybody.
 *
 * "Your Silver perks · 1.25 points per R1 spent" is on the rewards screen, and
 * `randToPoints` multiplies by `businessRules.pointsPerRand` regardless of who
 * is ordering. Either the copy is wrong or the arithmetic is, and which one is
 * a franchise decision rather than a code one — so this reads the advertised
 * rates back out of the perks and reports any that the app does not pay.
 *
 * Deliberately parsed rather than hard-coded: sign off a different set of
 * rates and this re-reads them.
 */
const advertisedRates = [...rewardsData.matchAll(/'([\d.]+) points? per R1[^']*'/g)].map((m) =>
  Number(m[1]),
);
const paidRate = Number(/pointsPerRand:\s*([\d.]+)/.exec(read('src/constants/config.ts'))?.[1]);
const unpaid = [...new Set(advertisedRates.filter((rate) => rate !== paidRate))];
if (unpaid.length > 0) {
  note(
    'Tier perks',
    `The perks advertise ${unpaid.map((r) => `${r} points per R1`).join(', ')}, and the app pays ` +
      `${paidRate} to everybody — "Your Silver perks · 1.25 points per R1 spent" sits on the ` +
      'rewards screen while a Silver member earns the Bronze rate. The earn rate is the part ' +
      'that can be checked mechanically; none of the rest is implemented either. Nothing ' +
      'anywhere honours "free delivery twice a month", "every week", "unlimited free delivery", ' +
      '"priority kitchen queue" or "early access to new drops" — and a seeded push notification ' +
      'repeats two of them ("Gold unlocks free delivery every week and priority in the kitchen ' +
      'queue"). As it stands the whole perks list is decoration on the one screen a member opens ' +
      'to see what their tier is worth. Either it describes a programme you intend to run, in ' +
      'which case it needs building, or it needs rewriting. I have not guessed: inventing a tier ' +
      'multiplier out of seeded marketing copy would be inventing the programme. Decide the ' +
      'rates and this check re-reads whatever you write.',
    'you',
  );
}

// Connectivity recovery could not be confirmed off-device. Flagged rather
// than fixed, because the fix would have to be verified on a handset.
note(
  'Offline recovery',
  'The app detects losing signal reliably and could not be shown to detect ' +
    'regaining it: driven in a browser it stayed "offline" with navigator.onLine ' +
    'true again. On a handset NetInfo takes connectivity from the OS and should ' +
    'recover, but confirm it on a real device — walk into a lift, come out, and ' +
    'check the banner clears and a paused menu load completes. Checkout only ' +
    'warns about being offline, never blocks, so a stale reading cannot stop ' +
    'someone paying.',
  'you',
);

// The app now calls DELETE /v1/account/push-tokens/:token when someone signs
// out. If the backend does not implement it, the unbinding silently fails and
// one person's order updates keep landing on a handset somebody else holds.
const notifications = read('src/services/notificationService.ts');
if (notifications.includes('/v1/account/push-tokens/')) {
  note(
    'Push token unbinding',
    'Sign-out calls DELETE /v1/account/push-tokens/:token to unbind this handset ' +
      'from the account. Confirm the backend implements it — without it, a phone ' +
      'that has been shared, handed down or sold keeps receiving the previous ' +
      "owner's order updates, order reference and all.",
    'you',
  );
}

// Cards can be paid with but not added: capture belongs in the gateway's
// PCI-compliant SDK and that is not connected yet. SnapScan, EFT and cash
// carry an order without it, so this is not a hard block — but no customer can
// add a card until the provider SDK is wired in.
const payments = read('src/app/account/payment-methods.tsx');
if (payments.includes('Connect the provider SDK')) {
  note(
    'Card capture',
    'Adding a card opens an explanation, not a form — card capture must happen ' +
      "inside the payment provider's PCI-compliant SDK and that is not connected. " +
      'A customer can still pay by SnapScan, Instant EFT or cash on delivery, so ' +
      'the app is orderable without it, but nobody can save a card until it is done.',
    'you',
  );
}

// Nothing in the app stops a guest reaching checkout, and the mock layer
// lets them right through. Against a real API their order is a 401.
const apiClient = read('src/services/apiClient.ts');
if (apiClient.includes('sign_in_required')) {
  note(
    'Guest checkout',
    'A guest can browse, build a basket and reach checkout — nothing gates it, and the ' +
      'mock layer lets the order through. Against a real API it is a 401; the app says ' +
      '"Sign in to finish this" and keeps their basket rather than claiming their session ' +
      'expired. Driven end to end as a guest, the journey now reads like this: delivery is ' +
      'blocked on "Add a delivery address" and tapping through offers a sign-in, which is ' +
      'coherent — but collection goes all the way to a confirmation and an order reference, ' +
      'for a customer the app holds no name, phone or email for. The kitchen would get an ' +
      'order it cannot ring about, and the customer cannot look at it afterwards, because ' +
      'the Orders tab needs an account. That last part is newly visible rather than newly ' +
      'broken: a guest never had a way to see a real order, they just used to be shown ' +
      'somebody else\'s. So the question is yours and it is one of three. Either the ' +
      'backend accepts guest orders and checkout must collect a name and a number for the ' +
      'driver; or checkout asks them to sign in before they build a basket rather than ' +
      'after; or guest browsing stays and guest ordering does not. I have not chosen: each ' +
      'is a different business, not a different implementation.',
    'you',
  );
}

// The mock now settles points with the order, which is a reading of a policy
// nobody has stated. It matters in rand: it decides who is out of pocket when
// somebody redeems and then walks away.
const rewardsService = read('src/services/rewardsService.ts');
if (rewardsService.includes('recordPoints')) {
  note(
    'Loyalty policy',
    'When do points settle? The app now takes them at the moment the order is placed, ' +
      'not when somebody taps a reward — so an abandoned basket costs nobody anything, ' +
      'and a cancelled order puts the points and the reward straight back. That is a ' +
      'reading of `redeemedRewardId` on the order payload, not a rule anybody has ' +
      'given me. Confirm it against how the programme is actually run, along with two ' +
      'numbers the seed invents: 1 point per R1 on food value only (no fees, no ' +
      'discounted amounts), and the Bronze/Silver/Gold/Black thresholds at ' +
      '0/1 500/4 000/9 000 lifetime points.',
    'you',
  );
}

// The app now asks for erasure instead of quietly signing somebody out, but
// the asking only means something once there is something to ask.
const authService = read('src/services/authService.ts');
if (authService.includes("'/v1/account', { method: 'DELETE' }")) {
  note(
    'Account deletion',
    'Deleting an account calls DELETE /v1/account and refuses to sign the customer out ' +
      'unless it succeeds — it used to promise "we remove your personal data within 30 days" ' +
      'and then only sign them out, asking nobody. Confirm the backend implements it, and ' +
      'that it does what the dialogue says: erasure within thirty days, keeping only what ' +
      'tax law requires. This is a POPIA right, not a nicety, and the app now states a ' +
      'deadline on your behalf.',
    'you',
  );
}

// The preference toggles now reach a server instead of only AsyncStorage,
// which makes the endpoint behind them load-bearing for a consent record.
const accountService = read('src/services/accountService.ts');
if (accountService.includes("'/v1/account/preferences'")) {
  note(
    'Preferences and consent',
    'Notification toggles and marketing consent now PATCH /v1/account/preferences, and the ' +
      'switch goes back if that fails rather than leaving somebody believing they have opted ' +
      'out. They used to write to AsyncStorage and stop there, so switching off "Promotions" ' +
      'changed a local boolean and the promotions kept arriving. Confirm the backend implements ' +
      'it and actually suppresses what it is told to — a withdrawal of consent to direct ' +
      'marketing is a POPIA right, and the app now presents these switches as though they work.',
    'you',
  );
}

// An unverified email used to be a warning badge with no way out of it. There
// is a button now, and a button needs something behind it.
if (authService.includes("'/v1/auth/email/verify'")) {
  note(
    'Email verification',
    'The profile screen now offers "Send me the link" when an email is unverified, calling ' +
      'POST /v1/auth/email/verify. `register` creates every customer unverified, so before this ' +
      'the warning badge was permanent by construction — there was no way to clear it anywhere ' +
      'in the app. Confirm the backend sends the mail and marks the address verified when the ' +
      'link is followed, or the button is a new dead end in place of the old one.',
    'you',
  );
}

// --- Things that only bite in production ---------------------------------

if (eas.build?.production?.env?.EXPO_PUBLIC_USE_MOCK_API !== '0') {
  note('Mock layer', 'The production profile does not switch the mock layer off.', 'build');
}

if (!eas.build?.production?.channel) {
  note('OTA channel', 'The production profile declares no update channel.', 'build');
}

const config = read('src/constants/config.ts');
if (!/useMockApi:\s*bool\([^,]+,\s*__DEV__\s*\)/.test(config)) {
  note('Mock layer', 'The source default for useMockApi is not __DEV__.', 'build');
}

// --- Report ---------------------------------------------------------------

const mine = blockers.filter((b) => b.whose === 'build');
const yours = blockers.filter((b) => b.whose === 'you');

if (blockers.length === 0) {
  console.log('Nothing outstanding. This build is fit to put in front of a customer.');
  process.exit(0);
}

if (mine.length > 0) {
  console.log(`\n${mine.length} thing(s) wrong with the build configuration:\n`);
  for (const b of mine) console.log(`  ✗ ${b.area}: ${b.detail}`);
}

if (yours.length > 0) {
  console.log(`\n${yours.length} thing(s) only you can supply:\n`);
  for (const b of yours) console.log(`  • ${b.area}: ${b.detail}`);
}

if (strict) {
  console.log('\nRefusing a production build while any of the above is unresolved.');
  process.exit(1);
}

console.log('\nAdvisory only. Run with --production to make these fail a build.');
process.exit(0);
