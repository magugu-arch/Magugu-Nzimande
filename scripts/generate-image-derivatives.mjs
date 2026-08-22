#!/usr/bin/env node
/**
 * bb.q Chicken — food image derivative pipeline.
 *
 * Reads every master in assets/food/masters/ and emits the responsive
 * derivatives the app consumes. Masters are never shipped to list screens.
 *
 *   thumb   1:1   400px   menu rows, cart lines, reorder chips
 *   card    4:5   800px   catalogue cards, best sellers, category tiles
 *   detail  4:5  1200px   product detail hero (Retina @2x-3x)
 *   banner 16:9  1600px   home promotions, offer banners
 *
 * Crops are gravity-aware: portrait food masters are cropped from the top
 * two-thirds so the hero piece is never sliced off. Nothing is stretched —
 * every derivative is a centre-weighted cover crop at the exact target ratio.
 *
 * Requires Python 3 + Pillow (pip install pillow). Run: npm run assets:derive
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PY = String.raw`
import os, sys, glob
from PIL import Image

root = sys.argv[1]
masters = os.path.join(root, "assets", "food", "masters")

# name -> (aspect w/h, target width, JPEG quality, vertical gravity 0..1)
VARIANTS = {
    "thumb":  (1 / 1,   400, 82, 0.42),
    "card":   (4 / 5,   800, 86, 0.45),
    "detail": (4 / 5,  1200, 90, 0.50),
    "banner": (16 / 9, 1600, 86, 0.40),
}


def cover_crop(im, ratio, gravity):
    """Centre-weighted cover crop to an exact ratio. Never stretches."""
    w, h = im.size
    target = ratio
    current = w / h
    if current > target:
        new_w = int(round(h * target))
        left = (w - new_w) // 2
        box = (left, 0, left + new_w, h)
    else:
        new_h = int(round(w / target))
        top = int(round((h - new_h) * gravity))
        top = max(0, min(top, h - new_h))
        box = (0, top, w, top + new_h)
    return im.crop(box)


sources = sorted(glob.glob(os.path.join(masters, "*.jpg")))
if not sources:
    print("No masters found in assets/food/masters — nothing to derive.")
    sys.exit(0)

count = 0
for src in sources:
    key = os.path.splitext(os.path.basename(src))[0]
    im = Image.open(src).convert("RGB")
    for variant, (ratio, width, quality, gravity) in VARIANTS.items():
        out_dir = os.path.join(root, "assets", "food", variant)
        os.makedirs(out_dir, exist_ok=True)
        cropped = cover_crop(im, ratio, gravity)
        height = int(round(width / ratio))
        if cropped.size[0] < width:
            width, height = cropped.size
        resized = cropped.resize((width, height), Image.LANCZOS)
        out = os.path.join(out_dir, key + ".jpg")
        resized.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
        count += 1
    print("  derived %-24s %s" % (key, " ".join(sorted(VARIANTS))))

print("Generated %d derivatives from %d masters." % (count, len(sources)))
`;

try {
  const out = execFileSync('python3', ['-c', PY, root], { encoding: 'utf8' });
  process.stdout.write(out);
} catch (error) {
  console.error('Derivative generation failed. Is Pillow installed? (pip install pillow)');
  console.error(error.stderr?.toString() ?? error.message);
  process.exit(1);
}
