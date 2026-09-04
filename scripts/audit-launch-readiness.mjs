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

/**
 * The radius rule needs a coordinate, and a real geocoder is what supplies one.
 *
 * This used to check whether the add-address form mentioned `latitude`, on the
 * reasoning that the item should disappear by itself once somebody wired a
 * geocoder in. That was a proxy standing in for the fact, and the proxy broke
 * the moment the wiring landed: the form now sets `latitude` from a provider
 * boundary whose only implementation is a mock that locates almost nothing, so
 * the blocker went quiet while the thing it warns about was still missing.
 *
 * An audit that under-reports is worse than one that nags. So this asks the
 * question it actually means — is there a geocoding provider that is not the
 * mock? — by reading the registry every provider must be added to.
 */
const geocodingRegistry = read('src/providers/geocoding/index.ts');
const geocoders = [
  ...geocodingRegistry
    .slice(geocodingRegistry.indexOf('const REGISTRY'))
    .split('};')[0]
    .matchAll(/^\s*(\w+):/gm),
].map((match) => match[1]);

if (geocoders.filter((name) => name !== 'mock').length === 0) {
  note(
    'Address geocoding',
    'The add-address form now calls a geocoder before saving, through the same kind of ' +
      'provider boundary the courier uses — a real service is a new file in ' +
      'src/providers/geocoding and a value in EXPO_PUBLIC_GEOCODING_PROVIDER. What is missing ' +
      'is the service itself: the only provider that ships is a mock that locates the suburbs ' +
      'bb.q has branches in and nothing else, because a stand-in that returned a plausible ' +
      'coordinate for any string would recreate the original defect. That defect is worth ' +
      'remembering: new addresses used to be stamped with the Johannesburg CBD, and measured ' +
      'from that constant six of the seven branches refused every typed-in address in the ' +
      'country while the seventh accepted them all. Only an exact match is kept — an ' +
      'approximate fix is discarded, because a suburb centroid can sit a kilometre from the ' +
      'door and a kilometre is most of the margin the radius rule works in. So an address the ' +
      'mock cannot place is still unlocated, and the radius still cannot refuse it. Connect a ' +
      'geocoder, or have the backend return coordinates from POST /v1/account/addresses.',
    'you',
  );
}

/**
 * The app can narrow a double authorisation; only the backend can close it.
 *
 * Printed while `submitOrder` still has an `uncertain` branch — which is to
 * say, always, unless somebody rewrites the payment flow. It is not a defect
 * to fix in this repo, it is a requirement to hand to whoever builds the
 * gateway integration.
 */
const submit = read('src/features/checkout/submitOrder.ts');
if (/status: 'uncertain'/.test(submit)) {
  note(
    'Payment idempotency',
    'Checkout authorises the card and then creates the order, releasing the hold if the order ' +
      'fails. What it cannot do is tell a lost reply from a refusal: if POST /v1/payments/authorise ' +
      'times out, the gateway may have authorised and there is no intentId to release, because ' +
      'the call that would have returned one never came back. The app now says so rather than ' +
      'inviting a retry — "we cannot tell whether your card was authorised, check your banking ' +
      'app" — which is honest and is still a customer stuck mid-order. The fix is on your side: ' +
      'make that endpoint idempotent on the `orderReference` the app already sends, so a retry ' +
      'returns the original authorisation instead of taking a second one. Confirm your provider ' +
      'supports it — most do, under an idempotency key — and that the endpoint uses it.',
    'you',
  );
}

/**
 * The four numbers the app charges by, none of which anybody has signed off.
 *
 * Read out of the source so the item quotes what the app is actually applying
 * rather than what this file remembers.
 */
const commercialRules = read('src/constants/config.ts');
const rule = (name) => commercialRules.match(new RegExp(`${name}: (\\d+(?:\\.\\d+)?)`))?.[1];
const fee = rule('deliveryFee');
const threshold = rule('freeDeliveryThreshold');
const minimum = rule('minimumDeliverySubtotal');
const service = rule('serviceFee');

if (fee && threshold) {
  note(
    'Delivery pricing',
    `The app charges R${fee} for delivery, waives it above R${threshold}, refuses a delivery ` +
      `order under R${minimum}, and adds R${service} in service fee to every order. All four are ` +
      'seeded constants, all four are shown to a customer before they pay, and none has been ' +
      'signed off. Changing them is three edits, not one: the constants in ' +
      'src/constants/config.ts, the prose that quotes them — a promotion headline and the "What ' +
      'does delivery cost?" help answer, which is where a customer goes to find out — and ' +
      'whatever your API serves for those two, because against a real backend both are server ' +
      'data. A test holds the seeded copy to the constants; nothing this side can hold yours. ' +
      'The bill itself is recomputed by POST /v1/orders, so if the server disagrees with these ' +
      'the customer sees one number and is charged another.',
    'you',
  );
}

/**
 * A reset link that opens the app, rather than a browser that cannot help.
 *
 * The screen exists now; whether the link reaches it is configuration nobody
 * in this repo can supply. Printed while `app.json` declares no associated
 * domains and no https intent filters — add either and this stops printing.
 */
const hasUniversalLinks =
  Boolean(app.ios?.associatedDomains?.length) ||
  JSON.stringify(app.android?.intentFilters ?? []).includes('https');

if (!hasUniversalLinks) {
  note(
    'Password reset link',
    'A customer who forgets their password is sent a link, and until now there was nowhere for ' +
      'it to land — no route matched, so the app showed "This page has moved on… it may have ' +
      'been taken off the menu". The screen exists now at /reset-password and takes a `token` ' +
      'query parameter, which it hands straight back to POST /v1/auth/password/confirm without ' +
      'reading it. Three things are still yours. The endpoint has to exist. The email has to ' +
      `link to a URL this app answers: today only the custom scheme does — ` +
      `${app.scheme}://reset-password?token=… — which most mail clients will not make tappable ` +
      'and which does nothing if the app is not installed. For an https link you need ' +
      'associatedDomains on iOS and an https intentFilter on Android, plus the ' +
      'apple-app-site-association and assetlinks.json files hosted on the domain. And the ' +
      'confirmation screen tells the customer the link "expires in 30 minutes", which is a ' +
      'promise about your server, not this app.',
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

/**
 * Allergen data, which is the one field on the menu that can hurt somebody.
 *
 * Read as a list of products declaring nothing, rather than as a rule about
 * how many allergens an item ought to have — that is not something a script
 * can know. What it can see is a product whose list is empty while a product
 * cooked in the same equipment declares an allergen it can only have picked
 * up there, and that disagreement is worth naming.
 *
 * The product screen no longer hides the shared-kitchen notice when the list
 * is empty, so nobody is shown less in the meantime. The data is still yours.
 *
 * Split on `slug:`, which only a product has. Matching backwards from
 * `allergens: []` to the nearest `name:` finds an *option* name instead — the
 * first run of this reported "Sharing bucket", which is a fries size.
 */
const undeclared = menuData
  .split(/\n\s*slug: '/)
  .slice(1)
  .filter((block) => /allergens: \[\]/.test(block))
  .map((block) => block.match(/name: '([^']+)'/)?.[1] ?? 'unnamed product');
if (undeclared.length > 0) {
  note(
    'Allergen data',
    `${undeclared.length} product(s) declare no allergens at all: ${undeclared.join(', ')}. ` +
      'That is a gap in the data rather than a statement that the item is free of anything, ' +
      'and the catalogue disagrees with itself about it — French Fries declares Gluten, which ' +
      'for a plain potato can only be the fryer, while Sweet Potato Fries beside it in the same ' +
      'fryer declares nothing. Have the franchise confirm the allergen list for every item, ' +
      'including the shared-equipment ones. Until then the product screen says the details are ' +
      'not confirmed and to check with the store, rather than showing nothing — but "not ' +
      'confirmed" is a worse answer than the right one for somebody with a severe allergy.',
    'you',
  );
}
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

/**
 * Enlarged text is the other thing only a handset can answer.
 *
 * `assets:typefit` measures real advance widths and reports the headroom, and
 * it is 1.05× — beyond that the Button deliberately takes a second line and a
 * taller box rather than truncating, which is a considered trade rather than a
 * defect. What no browser can check is whether the *screens* still lay out
 * around those taller buttons, because React Native Web reports `fontScale` as
 * 1 whatever the OS is set to.
 */
note(
  'Enlarged text',
  'Button labels fit on one line up to 1.05× the OS text size; past that they wrap to two ' +
    'lines and the button grows, by design. Nothing here can check what that does to the ' +
    'screens around them — React Native Web always reports a font scale of 1, so the browser ' +
    'sweep is blind to it. On a device, turn the text size up to the largest non-accessibility ' +
    'setting and walk the ordering journey: the checkout footer and the tracking card are the ' +
    'two worth watching, since both put a tall button under content that is already dense.',
  'you',
);

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

/**
 * What the seeded rewards are worth at the configured rate, so the number is
 * shown in rand rather than left as a decimal to multiply out. Read off the
 * seed rather than restated, so it cannot drift from what the app quotes.
 */
const perPoint = Number(rule('randPerPoint') ?? 0.05);
const redemptionExamples =
  [...rewardBlock.matchAll(/pointsCost: (\d+)/g)]
    .map((match) => Number(match[1]))
    .filter((cost) => cost > 0)
    .slice(0, 3)
    .map((cost) => `${cost} pts → R${Math.round(cost * perPoint)}`)
    .join(', ') || 'nothing the seed can show';

if (rewardsService.includes('recordPoints')) {
  note(
    'Loyalty policy',
    'When do points settle? The app now takes them at the moment the order is placed, ' +
      'not when somebody taps a reward — so an abandoned basket costs nobody anything, ' +
      'and a cancelled order puts the points and the reward straight back. That is a ' +
      'reading of `redeemedRewardId` on the order payload, not a rule anybody has ' +
      'given me. Confirm it against how the programme is actually run, along with three ' +
      'numbers the seed invents: 1 point per R1 on food value only (no fees, no ' +
      'discounted amounts), the Bronze/Silver/Gold/Black thresholds at ' +
      '0/1 500/4 000/9 000 lifetime points, and — the one that decides what a ' +
      `redemption is worth — R${rule('randPerPoint') ?? '0.05'} per point coming back the other way. ` +
      `At that rate the seeded rewards convert as ${redemptionExamples}. ` +
      'That last number is the earn rate in reverse and nothing forces the two to ' +
      'agree, so it is a margin decision rather than arithmetic: set the earn rate ' +
      'and the redemption rate together, or the programme pays out at a ratio ' +
      'nobody chose.',
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
