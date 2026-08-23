#!/usr/bin/env node
/**
 * Check that every button label still fits after the move to Montserrat.
 *
 * Two changes compounded: guidelines §11 put the app on Montserrat, which runs
 * about 10% wider than the Helvetica metrics it replaced, and §22.7 set CTAs in
 * caps, which is wider again. A label that fitted before does not necessarily
 * fit now, and the failure is silent — React Native truncates with an ellipsis
 * rather than complaining.
 *
 * Geometry comes from the same specs the component implements: §22.4's heights
 * and horizontal padding, §23.7's 24px gutter, measured against a 320pt screen
 * (iPhone SE, the narrowest phone worth supporting). Widths are measured from
 * the actual TTF the app bundles, so this is the real advance width, not an
 * estimate.
 *
 * Exits non-zero on an overflow. Run: npm run assets:typefit
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** §22.4 horizontal padding and label size, and §22 letter spacing. */
const SIZES = {
  lg: { paddingH: 32, fontSize: 16, tracking: 0.2 },
  md: { paddingH: 28, fontSize: 14, tracking: 0.2 },
  sm: { paddingH: 20, fontSize: 13, tracking: 0.2 },
};

const SCREEN = 320; // iPhone SE, the narrowest supported width
const GUTTER = 24; // §23.7
const ICON = 18; // Ionicons size in Button
const GAP = { lg: 12, md: 8, sm: 8 };

function collectButtons(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectButtons(full, out);
    else if (entry.name.endsWith('.tsx')) {
      const source = fs.readFileSync(full, 'utf8');
      for (const match of source.matchAll(/<Button\b[\s\S]{0,700}?\/>/g)) {
        const tag = match[0];
        const label = /label="([^"]*)"/.exec(tag);
        if (!label?.[1]) continue; // dynamic labels cannot be measured here

        const size = /size="(lg|md|sm)"/.exec(tag)?.[1] ?? 'md';
        out.push({
          file: path.relative(root, full),
          line: source.slice(0, match.index).split('\n').length,
          label: label[1],
          size,
          preserveCase: tag.includes('preserveCase'),
          fullWidth: !tag.includes('fullWidth={false}'),
          icons: (tag.includes('iconLeft') ? 1 : 0) + (tag.includes('iconRight') ? 1 : 0),
          trailing: /trailingLabel="([^"]*)"/.exec(tag)?.[1] ?? null,
        });
      }
    }
  }
  return out;
}

const buttons = collectButtons(path.join(root, 'src'));

const PY = String.raw`
import json, sys
from PIL import ImageFont

root, payload = sys.argv[1], json.loads(sys.stdin.read())
FACE = root + "/node_modules/@expo-google-fonts/montserrat/600SemiBold/Montserrat_600SemiBold.ttf"
WAS  = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

def width(path, text, size, tracking):
    font = ImageFont.truetype(path, size)
    # React Native adds letterSpacing after every glyph, including the last.
    return font.getlength(text) + tracking * len(text)

out = []
for b in payload:
    text = b["label"] if b["preserveCase"] else b["label"].upper()
    now = width(FACE, text, b["fontSize"], b["tracking"])
    before = width(WAS, b["label"], b["fontSize"], 0)
    if b["trailing"]:
        now += width(FACE, b["trailing"], b["fontSize"], b["tracking"])
    out.append({**b, "width": now, "before": before})
print(json.dumps(out))
`;

const measured = JSON.parse(
  execFileSync('python3', ['-c', PY, root], {
    input: JSON.stringify(
      buttons.map((b) => ({ ...b, ...SIZES[b.size], tracking: SIZES[b.size].tracking })),
    ),
    encoding: 'utf8',
  }),
);

/**
 * Space for the label, in points, on the narrowest supported screen.
 *
 * Padding, icons and gaps are fixed chrome — they do not grow with the text
 * size — so only the label itself scales.
 */
function availableFor(b) {
  const spec = SIZES[b.size];
  const content = SCREEN - GUTTER * 2;
  return (
    content - spec.paddingH * 2 - b.icons * (ICON + GAP[b.size]) - (b.trailing ? GAP[b.size] : 0)
  );
}

let overflows = 0;
let worstRatio = 1;
const rows = [];

for (const b of measured) {
  const available = availableFor(b);

  const ratio = b.width / b.before;
  worstRatio = Math.max(worstRatio, ratio);

  if (b.width > available) {
    overflows += 1;
    rows.push({ ...b, available, over: b.width - available });
  }
}

/**
 * The largest OS text-size multiplier every label survives.
 *
 * iOS reaches about 3.1× at the largest accessibility size and Android 2.0,
 * and a button label is capped rather than allowed to run because it cannot
 * wrap — `numberOfLines={1}` means overflow is silent truncation. This is what
 * decides the cap in the type scale: it is measured from the bundled TTF at
 * 320pt, not picked because it sounded reasonable.
 */
function largestFittingScale() {
  for (let scale = 3.0; scale >= 1.0; scale -= 0.05) {
    const fits = measured.every((b) => b.width * scale <= availableFor(b));
    if (fits) return Math.round(scale * 100) / 100;
  }
  return 1;
}

const growth = measured.reduce((sum, b) => sum + b.width / b.before, 0) / measured.length;

console.log(`Measured ${measured.length} static button labels at ${SCREEN}pt.`);
console.log(
  `Labels are ${((growth - 1) * 100).toFixed(1)}% wider on average than the ` +
    `sentence-case Helvetica they replaced (worst: ${((worstRatio - 1) * 100).toFixed(0)}%).`,
);

if (overflows === 0) {
  const headroom = largestFittingScale();
  const tightest = measured
    .map((b) => ({ ...b, headroom: availableFor(b) / b.width }))
    .sort((a, b) => a.headroom - b.headroom)[0];

  console.log(
    `\nEvery label still fits with the OS text size at ${headroom.toFixed(2)}×. ` +
      `Tightest: "${tightest.preserveCase ? tightest.label : tightest.label.toUpperCase()}" ` +
      `(${tightest.file}:${tightest.line}) at ${tightest.headroom.toFixed(2)}×.`,
  );
  console.log('All labels fit. Cleared.');
  process.exit(0);
}

console.log(`\n${overflows} label(s) overflow and would be truncated:\n`);
for (const r of rows.sort((a, b) => b.over - a.over)) {
  console.log(
    `  ${r.file}:${r.line}\n` +
      `    "${r.preserveCase ? r.label : r.label.toUpperCase()}" (${r.size})\n` +
      `    needs ${r.width.toFixed(0)}pt, has ${r.available.toFixed(0)}pt — over by ${r.over.toFixed(0)}pt\n`,
  );
}
console.log('Shorten the label, drop to a smaller size, or set preserveCase.');
process.exit(1);
