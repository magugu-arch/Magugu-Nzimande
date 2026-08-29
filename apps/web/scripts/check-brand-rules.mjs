#!/usr/bin/env node
/**
 * Fails the build on a breach of the brand non-negotiables in CLAUDE.md §2.
 *
 * These are the rules that fail review every time and are invisible in a diff,
 * so they are checked by a machine rather than trusted to a reader:
 *
 *   1. The brand is written `bb.q Chicken`. Never BBQ, BB.Q, the middle-dot
 *      form, or a lowercase descriptor. Bare `bbq` is fine in a file name,
 *      slug, class or order-number prefix — that is not the brand in prose.
 *   2. No fire language in any customer-facing string, class name or asset
 *      name. The product is twice fried in olive oil and tossed to order.
 *   3. No raw hex outside the two token files.
 *
 * Run: npm run brand:check
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, '..');
const REPO = path.resolve(APP, '../..');

const ROOTS = [
  path.join(APP, 'src'),
  path.join(REPO, 'packages'),
  path.join(REPO, 'infra/seed'),
  path.join(REPO, 'infra/scripts'),
];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'public', '.git']);
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.json', '.mjs', '.js']);

/** The two files allowed to carry a raw hex value. */
const TOKEN_FILES = [
  path.join(REPO, 'packages/ui/src/tokens.json'),
  path.join(REPO, 'packages/ui/src/tokens.css'),
];

/** This file names the forbidden words in order to look for them. */
const SELF = fileURLToPath(import.meta.url);

const RULES = [
  {
    name: 'brand spelling',
    pattern: /\bbbq[ \t]+chicken\b|bb[·•]q|\bbb\.q\b(?:[ \t]+chicken\b)?/gi,
    // Compared case-sensitively, so `bb.q` and `bb.q Chicken` are the only two
    // renderings that pass, and BBQ Chicken, BB.Q, Bb.q and bb.q chicken fail.
    allow: (match) => match === 'bb.q' || match === 'bb.q Chicken',
    detail: 'The brand is written `bb.q Chicken`: lowercase bb.q, capital C.',
  },
  {
    name: 'fire language',
    // Whole words only, so charAt, charset and characters are untouched.
    pattern:
      /\b(fire|fires|flame|flames|torch|grill|grilled|grilling|char|charred|burn|burnt|blaze)\b/gi,
    detail: 'Twice fried in olive oil. Tossed to order. Fire language is not approved copy.',
  },
  {
    name: 'raw hex',
    pattern: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g,
    onlyOutside: TOKEN_FILES,
    detail: 'Colour lives in packages/ui/src/tokens.{json,css}. Use a token.',
  },
];

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

const violations = [];

for (const root of ROOTS) {
  for await (const file of walk(root)) {
    if (file === SELF) continue;

    const source = await readFile(file, 'utf8');
    const lines = source.split('\n');

    for (const rule of RULES) {
      if (rule.onlyOutside?.includes(file)) continue;

      lines.forEach((line, index) => {
        for (const match of line.matchAll(rule.pattern)) {
          if (rule.allow?.(match[0])) continue;
          violations.push({
            file: path.relative(REPO, file),
            line: index + 1,
            rule: rule.name,
            found: match[0],
            detail: rule.detail,
            text: line.trim().slice(0, 110),
          });
        }
      });
    }
  }
}

if (violations.length === 0) {
  console.log('Brand rules: clean.');
  process.exit(0);
}

console.error(`Brand rules: ${violations.length} violation(s).\n`);
for (const violation of violations) {
  console.error(`  ${violation.file}:${violation.line}  [${violation.rule}] "${violation.found}"`);
  console.error(`    ${violation.text}`);
  console.error(`    ${violation.detail}\n`);
}
process.exit(1);
