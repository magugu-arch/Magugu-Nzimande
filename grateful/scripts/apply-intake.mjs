#!/usr/bin/env node
/**
 * npm run apply:intake -- <answers.json>
 * Takes the launch checklist's saved answers (the intake/studio document,
 * exported as JSON) and writes src/data/studio-content.json, which the site
 * reads. Prints anything that could not be used, and the answers that belong
 * elsewhere (dashboard hours and prices, wording notes, the domain).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { contentFromIntake } from '../shared/intake.ts';

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run apply:intake -- <answers.json>');
  process.exit(1);
}
const doc = JSON.parse(readFileSync(file, 'utf8'));
const { content, problems, followUp } = contentFromIntake(doc.data ?? doc);
writeFileSync(new URL('../src/data/studio-content.json', import.meta.url), JSON.stringify(content, null, 2) + '\n');

console.log('\nWrote src/data/studio-content.json\n');
if (problems.length) console.log('Could not use:\n' + problems.map((p) => `  ✗ ${p}`).join('\n') + '\n');
if (followUp.length) console.log('Still to do by hand:\n' + followUp.map((p) => `  • ${p}`).join('\n') + '\n');
console.log('Next: npm run verify, then rebuild the preview.\n');
