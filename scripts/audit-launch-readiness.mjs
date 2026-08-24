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
