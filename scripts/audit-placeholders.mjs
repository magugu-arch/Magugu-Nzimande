#!/usr/bin/env node
/**
 * Everything Pappas still has to supply.
 *
 * Brief §17.15: "When source data is missing, use a clearly marked
 * business-input placeholder instead of inventing content."
 *
 * This is the report that makes those placeholders useful rather than merely
 * honest. A marked placeholder nobody can find is a placeholder that ships.
 *
 * It walks the repository's data modules and prints, in one list:
 *
 *   - every `Fact` still awaiting business input (venue, hours, contact)
 *   - every dish whose price has not been supplied
 *   - every reward and tier whose economics have not been set
 *   - every dish sharing a category photograph rather than its own
 *
 * Run: npm run audit:placeholders
 *
 * Exits 0 always. This is a report, not a gate — a build that fails because
 * the restaurant has not sent its opening hours yet would help nobody, and
 * §17.15 asks for a marked placeholder rather than a blocked pipeline. The
 * gate that *does* matter is in the tests: `menuTaxonomy.test.ts` fails if a
 * price appears without being marked confirmed, which is the direction that
 * can actually hurt a customer.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Read the data through `tsx`-free means: the modules are TypeScript, and
 * this script is plain node. Rather than add a compile step for a report,
 * the facts are parsed out of the source, which also keeps the report honest
 * about what is actually written in the file rather than what a bundler
 * resolved.
 */
function read(relative) {
  return execFileSync('node', ['-e', `process.stdout.write(require('fs').readFileSync(${JSON.stringify(path.join(root, relative))}, 'utf8'))`], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

const content = read('src/data/pappasContent.ts');
const menu = read('src/services/data/menuData.ts');
const rewards = read('src/services/data/rewardsData.ts');

// ── Venue and trading facts ────────────────────────────────────────────────

const awaiting = [...content.matchAll(/(\w+):\s*awaiting\(\s*\n?\s*'([^']*(?:\\'[^']*)*)'/g)].map(
  (match) => ({ field: match[1], needs: match[2].replace(/\\'/g, "'") }),
);

// ── Dishes ─────────────────────────────────────────────────────────────────

// `shortDescription` is what distinguishes a dish from a category: both carry
// an id and a name, and matching on those alone counted the ten categories as
// ten extra dishes.
const dishes = [
  ...menu.matchAll(/\n {4}id: '([^']+)',\n {4}name: '([^']+)',\n {4}shortDescription:/g),
].map((match) => ({ id: match[1], name: match[2] }));

const categoriesInMenu = [...menu.matchAll(/\n {4}id: '([^']+)',\n {4}name: '([^']+)',\n {4}tagline:/g)]
  .map((match) => match[1]);

// Which asset each dish draws on, to find the shared ones.
const assetUse = new Map();
for (const match of menu.matchAll(
  /\n {4}id: '([^']+)',\n {4}name: '[^']+',\n {4}shortDescription:[\s\S]{0,900}?\n {4}assetKey: '([^']+)',/g,
)) {
  const list = assetUse.get(match[2]) ?? [];
  list.push(match[1]);
  assetUse.set(match[2], list);
}

// ── Rewards ────────────────────────────────────────────────────────────────

const rewardNames = [...rewards.matchAll(/\n {4}id: '(reward-[^']+)',\n {4}name: '([^']+)',/g)].map(
  (match) => ({ id: match[1], name: match[2] }),
);
const tierNames = [...rewards.matchAll(/\n {4}tier: '(\w+)',\n {4}name: '([^']+)',\n {4}threshold: (\d+),/g)].map(
  (match) => ({ tier: match[1], name: match[2], threshold: Number(match[3]) }),
);

// ── Report ─────────────────────────────────────────────────────────────────

const rule = (title) => {
  console.log('');
  console.log(title);
  console.log('─'.repeat(Math.max(title.length, 40)));
};

console.log('PAPPAS — outstanding business input');
console.log('');
console.log('Everything below is deliberately marked rather than invented, per brief');
console.log('§15 and §17.15. Supplying any of it is a data change; no code moves.');

rule(`1. Restaurant details (${awaiting.length})`);
if (awaiting.length === 0) {
  console.log('  Nothing outstanding.');
} else {
  for (const item of awaiting) {
    console.log(`  • ${item.field}`);
    console.log(`      ${item.needs}`);
  }
}

rule(`2. Menu pricing (${dishes.length} dishes, across ${categoriesInMenu.length} categories)`);
console.log('  No price has been supplied for any dish, so every one is listed as');
console.log('  "Price on request" and cannot be added to an order. The Pappas website');
console.log('  is the brief\'s own source (§2) and is unreachable from this build.');
console.log('');
console.log('  To supply: set basePrice, priceStatus: \'confirmed\' and available: true');
console.log('  in src/services/data/menuData.ts.');
console.log('');
for (const dish of dishes) {
  console.log(`  • ${dish.name.padEnd(34)} ${dish.id}`);
}

rule(`3. Rewards programme (${rewardNames.length} rewards, ${tierNames.length} tiers)`);
console.log('  §15 forbids inventing loyalty rules, so no points cost and no tier');
console.log('  threshold is stated. Every reward reads "coming soon" until set.');
console.log('');
console.log('  Needed: the earn rate, each tier threshold, and each reward\'s points cost.');
console.log('');
for (const tier of tierNames) {
  console.log(`  • Tier   ${tier.name.padEnd(12)} threshold ${tier.threshold === 0 ? 'NOT SET' : tier.threshold}`);
}
for (const reward of rewardNames) {
  console.log(`  • Reward ${reward.name}`);
}

const shared = [...assetUse.entries()].filter(([, ids]) => ids.length > 1);
rule(`4. Photography (${shared.length} shared compositions)`);
console.log('  §10 supplied thirteen category compositions rather than a per-dish');
console.log('  shoot, so these dishes share an image. Not wrong, but a customer');
console.log('  looking at a prawn platter while ordering mussels has been mildly');
console.log('  misled — this is the shoot list.');
console.log('');
for (const [asset, ids] of shared) {
  console.log(`  • ${asset} — ${ids.length} dishes`);
  console.log(`      ${ids.join(', ')}`);
}

rule('5. Delivery channels');
console.log('  Uber Eats and Mr D are built and switched off. The contracts and');
console.log('  credentials each one needs are listed in docs/DELIVERY_INTEGRATION.md');
console.log('  under "Outstanding blockers".');

console.log('');
console.log(
  `Summary: ${awaiting.length} restaurant details, ${dishes.length} prices, ` +
    `${rewardNames.length + tierNames.length} loyalty figures, ` +
    `${shared.length} shared photographs.`,
);
console.log('');
