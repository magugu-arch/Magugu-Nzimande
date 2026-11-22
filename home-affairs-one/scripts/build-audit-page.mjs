#!/usr/bin/env node
/**
 * Builds the designed version of the build-cost audit as one self-contained
 * file, with the product's own typefaces embedded.
 *
 *   node scripts/build-audit-page.mjs [--artifact-out /path/page.html]
 *
 * The figures live in two places and must be changed together:
 * `docs/product/build-cost-audit.md` (the reference) and
 * `scripts/audit-page/build-cost-audit.html` (this page's source).
 *
 * Output: share/Home_Affairs_One_Build_Cost_Audit.html. With --artifact-out it
 * also writes the page as a fragment, for hosts that supply their own
 * document skeleton.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? null : (args[index + 1] ?? null);
};

const fontFile = (pkg, file) =>
  readFileSync(
    path.join(root, 'node_modules', '@fontsource-variable', pkg, 'files', file),
  ).toString('base64');
const face = (family, style, weight, data) =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format('woff2')}`;
const fonts = [
  face(
    'Fraunces Variable',
    'normal',
    '100 900',
    fontFile('fraunces', 'fraunces-latin-opsz-normal.woff2'),
  ),
  face(
    'Fraunces Variable',
    'italic',
    '100 900',
    fontFile('fraunces', 'fraunces-latin-opsz-italic.woff2'),
  ),
  face(
    'Atkinson Hyperlegible Next Variable',
    'normal',
    '200 800',
    fontFile('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2'),
  ),
].join('\n');

const source = readFileSync(
  path.join(root, 'scripts', 'audit-page', 'build-cost-audit.html'),
  'utf8',
);
for (const marker of ['/*FONTS*/', '<!--BODY-->']) {
  if (!source.includes(marker)) throw new Error(`audit page source is missing ${marker}`);
}
const [head, body] = source.replace('/*FONTS*/', fonts).split('<!--BODY-->');

const title = 'Home Affairs One — build-cost audit (concept prototype)';
const description =
  'What it costs to build an app like Home Affairs One: three price points, from a clickable concept to a national service. An independent estimate, not a quote.';
const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#070c14" />
<meta name="description" content="${description}" />
<meta property="og:type" content="article" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta name="twitter:card" content="summary" />
${head.trim()}
</head>
<body>
${body.trim()}
</body>
</html>
`;

const out = path.join(root, 'share', 'Home_Affairs_One_Build_Cost_Audit.html');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, standalone);
console.log(
  `audit page: ${path.relative(root, out)} — ${(standalone.length / 1024).toFixed(0)} KB`,
);

const artifactOut = flag('artifact-out');
if (artifactOut) {
  mkdirSync(path.dirname(artifactOut), { recursive: true });
  writeFileSync(artifactOut, `${head.trim()}\n${body.trim()}\n`);
  console.log(`artifact page: ${artifactOut}`);
}
