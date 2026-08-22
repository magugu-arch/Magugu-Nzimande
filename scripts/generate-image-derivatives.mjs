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

# Per-master overrides, keyed by filename stem.
#
#   promo_safe  (left, top, right, bottom) as fractions of the frame, marking
#               the region that carries food and NO campaign typography.
#               thumb/card/detail crop inside it; banner still uses the full
#               composition, where the brief allows promotional text (§9).
#   gravity     vertical bias override — a number for every variant, or a dict
#               keyed by variant name for finer control.
#   focus_x     horizontal bias, same shape. A wide promo composition cropped
#               to a 4:5 card loses most of its width, so this decides which
#               part of the plate survives.
OVERRIDES = {
    # Supplied as a finished promo composition: a headline across the top-left
    # and two flavour callouts. Cropping a card straight out of that would
    # slice the headline mid-word, so catalogue surfaces take the tray only,
    # while the banner anchors to the top so the headline survives the 16:9 cut.
    "half-and-half": {
        "promo_safe": (0.10, 0.30, 0.93, 1.00),
        "gravity": {"banner": 0.0},
    },
    # Headline top-left, "100% real chicken" badge bottom-right. The plate
    # sits between them.
    "chicken-rice-meal": {
        "promo_safe": (0.06, 0.32, 0.82, 0.99),
        "gravity": {"banner": 0.0},
        # Bias right so the rice and slaw stay in frame — this is a meal, not
        # a chicken box, and the card has to read as a composed plate.
        "focus_x": 0.72,
    },
    # Callout upper-left, "Made fresh" badge and the wordmark along the bottom.
    # Cropping above the bottom band keeps the whole burger.
    "chicken-burger": {
        # Top edge sits below the cup's wordmark so no logo is sliced.
        "promo_safe": (0.20, 0.21, 0.74, 0.84),
        "gravity": {"banner": 0.0},
    },
    # Headline top-left, a badge in each bottom corner. The bowl is the middle.
    "korean-rice-bowl": {
        "promo_safe": (0.20, 0.28, 0.84, 0.99),
        "gravity": {"banner": 0.0},
        # Slightly right of centre keeps the kimchi and greens beside the
        # chicken, which is what makes it read as a bowl.
        "focus_x": 0.58,
    },
    # Headline top-left, badge on the left edge — the carton is right of both.
    "french-fries": {
        # Left edge clears the headline's spark flourish; anchoring every
        # variant to the top keeps the fries above the carton in frame.
        "promo_safe": (0.35, 0.08, 0.81, 0.98),
        "gravity": 0.0,
    },
    # Headline top-left, badge bottom-left; the tray occupies the right two-thirds.
    "cheesling-fries": {
        # Left edge lands on the tray's printed mark rather than through it,
        # and sits below the red headline.
        "promo_safe": (0.30, 0.25, 0.85, 0.96),
        "gravity": {"banner": 0.0},
        "focus_x": 0.0,
    },
}


def subrect(im, rect):
    """Crop to a fractional (left, top, right, bottom) region of the frame."""
    w, h = im.size
    left, top, right, bottom = rect
    box = (
        int(round(left * w)),
        int(round(top * h)),
        int(round(right * w)),
        int(round(bottom * h)),
    )
    return im.crop(box)


def cover_crop(im, ratio, gravity, focus_x=0.5):
    """Cover crop to an exact ratio. Never stretches.

    gravity biases the vertical cut, focus_x the horizontal one; 0.5 is centred.
    """
    w, h = im.size
    target = ratio
    current = w / h
    if current > target:
        new_w = int(round(h * target))
        left = int(round((w - new_w) * focus_x))
        left = max(0, min(left, w - new_w))
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
    override = OVERRIDES.get(key, {})

    for variant, (ratio, width, quality, gravity) in VARIANTS.items():
        out_dir = os.path.join(root, "assets", "food", variant)
        os.makedirs(out_dir, exist_ok=True)

        gravity_override = override.get("gravity")
        if isinstance(gravity_override, dict):
            gravity = gravity_override.get(variant, gravity)
        elif gravity_override is not None:
            gravity = gravity_override

        # Banners may carry campaign text; every other surface must not.
        source = im
        promo_safe = override.get("promo_safe")
        if promo_safe and variant != "banner":
            source = subrect(im, promo_safe)

        focus_x = override.get("focus_x", 0.5)
        if isinstance(focus_x, dict):
            focus_x = focus_x.get(variant, 0.5)

        cropped = cover_crop(source, ratio, gravity, focus_x)
        height = int(round(width / ratio))
        if cropped.size[0] < width:
            width, height = cropped.size
        resized = cropped.resize((width, height), Image.LANCZOS)
        out = os.path.join(out_dir, key + ".jpg")
        resized.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
        count += 1
    note = " (promo-safe crop on card surfaces)" if override.get("promo_safe") else ""
    print("  derived %-24s %s%s" % (key, " ".join(sorted(VARIANTS)), note))

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
