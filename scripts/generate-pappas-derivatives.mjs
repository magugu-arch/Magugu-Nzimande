#!/usr/bin/env node
/**
 * Pappas — photography derivative pipeline.
 *
 * Reads the sixteen supplied masters in assets/pappas/{food,venue,ci}/ and
 * emits the responsive crops the app consumes, into assets/pappas/derived/.
 *
 *   thumb   1:1    400px   menu rows, cart lines, reorder chips
 *   card    4:5    800px   category cards, editorial cards, dish cards
 *   hero    4:3   1400px   home hero, category hero, product detail
 *   banner  16:9  1600px   campaign banners, event cards
 *
 * ── The problem this pipeline exists to solve ────────────────────────────
 *
 * Every supplied master is a *finished poster*. Each carries a Cinzel
 * headline, a letterspaced sub-line and usually an Allura script phrase,
 * baked into the pixels. Brief §6 and §14 are explicit about this:
 *
 *   "On actual product cards, do not show poster typography embedded in the
 *    source images. Use clean image crops or cleaned source imagery."
 *
 *   "When an asset contains text baked into it, crop or mask that area before
 *    using it as a background behind live interface text."
 *
 * So each master declares a `food_safe` rectangle: the region that carries
 * photography and no typography. Every derivative is cut from inside it.
 * Without this, a category card would print "MEZEDAKIA" in the image and then
 * "Mezedakia" again in live Cinzel directly beneath — §15's "do not duplicate
 * text that is already baked into a poster image", which is the single most
 * visible way this brand would look broken.
 *
 * The two landscape composites are a different shape of the same problem.
 * 11_breakfast and 12_cocktails are not posters with a corner headline —
 * they are a photographic band above a strip of captioned tiles. Their safe
 * region is the upper band only, so a card can never slice a caption row.
 *
 * Three masters are never derived at all: 01 and 02 are photography-direction
 * boards and 15 is the CI sheet. §10 calls them references, and a reference
 * that leaks into a product surface is a mistake, not a feature. The registry
 * generator refuses to emit keys for them.
 *
 * ── Why nothing is stretched ─────────────────────────────────────────────
 *
 * Every output is a cover crop at the exact target ratio. §16's definition of
 * done names "low-resolution image stretching" as a failure condition, and a
 * 1122px master scaled into a 1600px banner is exactly that. Where a source
 * cannot honestly fill a target, the crop is taken and the target width is
 * clamped to what the pixels support rather than upscaled into mush.
 *
 * Requires Python 3 + Pillow. Run: npm run assets:pappas
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PY = String.raw`
import json, os, sys
from PIL import Image

root = sys.argv[1]
src_root = os.path.join(root, "assets", "pappas")
out_root = os.path.join(src_root, "derived")

# name -> (aspect w/h, target width, JPEG quality)
VARIANTS = {
    "thumb":  (1 / 1,   400, 82),
    "card":   (4 / 5,   800, 86),
    "hero":   (4 / 3,  1400, 88),
    "banner": (16 / 9, 1600, 86),
}

# Every master, with the region of it that is photography and not typography.
#
#   food_safe   (left, top, right, bottom) as fractions of the frame. All four
#               derivatives are cut from inside this box. Measured by eye
#               against each supplied poster, then checked by rendering the
#               crops and looking for a clipped letterform.
#   focus       (x, y) bias inside the safe box, 0..1, deciding which part
#               survives a ratio change. A 4:5 card out of a 4:3 safe region
#               loses most of its width, so this picks the hero plate.
#   reference   True for the boards that must never reach a product surface.
#
# A note on why these numbers are generous rather than tight: each safe box is
# pulled a little further from the type than strictly necessary, because a
# crop that just clears a descender at one ratio can clip it at another, and
# a half a letter in the corner of a card reads as a rendering bug rather than
# as art direction.
SOURCES = {
    # ── Reference boards. Never derived. ─────────────────────────────────
    "food/01_pappas_food_photography_master_style": {"reference": True},
    "food/02_pappas_food_photography_style_guide": {"reference": True},
    "ci/15_ci_brand_sheet": {"reference": True},

    # ── Portrait category posters. Headline sits top-left. ────────────────
    # "MEZEDAKIA / A TASTE OF THE MEDITERRANEAN / Small plates. Big moments."
    # occupies the top quarter; the spread of small plates fills the rest.
    "food/03_mezedakia": {"food_safe": (0.00, 0.26, 1.00, 1.00), "focus": (0.55, 0.55)},
    # "SEAFOOD / FRESH FROM THE MEDITERRANEAN / Ocean flavours." to y=0.26.
    # The king prawn platter is the centre of gravity, low and right.
    "food/04_seafood": {"food_safe": (0.00, 0.29, 1.00, 1.00), "focus": (0.60, 0.60)},
    # Salads carries type in two places: the headline top-left AND the Allura
    # "Good food brings people together" on the right at mid-height. The safe
    # box therefore stops short of the right edge as well as the top.
    "food/05_salads": {"food_safe": (0.02, 0.44, 0.74, 1.00), "focus": (0.55, 0.65)},
    # "PAPPAS / SIGNATURE MAINS" plus two sub-lines, to y=0.22.
    "food/06_signature_mains": {"food_safe": (0.00, 0.26, 1.00, 1.00), "focus": (0.50, 0.58)},
    # "SOUVLAKI / A TASTE OF GREECE" plus a two-line Allura phrase, to y=0.27.
    "food/07_souvlaki": {"food_safe": (0.00, 0.31, 1.00, 1.00), "focus": (0.45, 0.60)},
    # "STEAK ON THE ROCK" runs two lines and its sub-lines reach y=0.27.
    #
    # The bottom of the frame has its own problem: "PAPPAS" is branded into
    # the serving board, low and right. That is a brand mark on a real object
    # rather than poster copy, and §14 does distinguish the two — but the
    # first cut through here sliced it to "PAP", and a halved word reads as a
    # rendering bug whatever its provenance. The box now stops above the
    # board legend entirely, which is the same rule the old bb.q pipeline
    # reached for its promotional badges: absent is art direction, halved is
    # a defect. Note it took two passes: a bottom edge that cleared the legend
    # at 4:5 still caught it at 4:3, because the wider ratio keeps more width
    # and the legend runs off to the right. Every safe box here is checked
    # against all four variants, not the one that was being looked at.
    "food/08_steak_on_the_rock": {"food_safe": (0.00, 0.30, 1.00, 0.73), "focus": (0.42, 0.50)},
    # The busiest of the set: headline top-left, a chalkboard listing the catch
    # top-right, and the Pappas napkin logo bottom-right. Food occupies the
    # middle-left. This is the tightest safe box of the sixteen.
    "food/09_mediterranean_fish_market": {"food_safe": (0.00, 0.34, 0.70, 0.86), "focus": (0.45, 0.60)},
    # "DESSERTS" top-left, "Life is sweeter at Pappas" top-right, and the full
    # Pappas lockup along the bottom-left. The baklava hero survives between.
    "food/10_desserts": {"food_safe": (0.26, 0.28, 1.00, 0.82), "focus": (0.45, 0.62)},

    # ── Landscape composites. Captioned tile strip along the bottom. ──────
    # Logo top-left, "Breakfast Better Together" script top-right, and five
    # captioned tiles below y=0.67. The safe band is the photograph between —
    # and the first cut proved the band starts lower than it looks: the
    # script's descending tail reaches to about y=0.24, and a top edge at
    # 0.12 carried "Better Together" straight into the corner of every card.
    # The right edge stops at 0.88 for the same reason the steak box stops
    # short: a branded Pappas cup sits against it, and the 4:3 hero cut it to
    # "PAPP" — and the 16:9 banner, which keeps the full width, needed it
    # narrower still at 0.79.
    "food/11_breakfast": {"food_safe": (0.28, 0.27, 0.79, 0.64), "focus": (0.45, 0.55)},
    # Same construction: logo and headline block top-left, script top-right,
    # seven captioned cocktail tiles below y=0.53, footer bar at the bottom.
    # The "Good Drinks Brighter Moments" script hangs to about y=0.20 on the
    # right, so the top edge sits below it and the right edge stops short —
    # the 16:9 banner was carrying "Brigh… Mome…" into the corner.
    "food/12_cocktails": {"food_safe": (0.32, 0.23, 0.90, 0.50), "focus": (0.50, 0.55)},

    # ── Venue. Type is painted on the walls, which makes it harder. ───────
    # The Pappas lockup is painted large on the left wall and "Good Food
    # Brighter Moments" on the right; two more lines sit in the bottom
    # corners. The safe box is the dining floor between them.
    "venue/13_main_dining_room": {"food_safe": (0.38, 0.30, 0.83, 0.93), "focus": (0.50, 0.55)},
    # Script on the left column, the lockup on the back wall right, a menu
    # board bottom-right. The lit bar counter runs between them.
    "venue/14_bar_detail": {"food_safe": (0.15, 0.40, 0.59, 1.00), "focus": (0.55, 0.45)},
    # The lockup is on the left wall and there are banners in the square
    # beyond. The window and the Nelson Mandela Square view are the subject.
    "venue/16_window_square_view": {"food_safe": (0.27, 0.06, 1.00, 1.00), "focus": (0.45, 0.50)},
}


def subrect(im, box):
    w, h = im.size
    left, top, right, bottom = box
    return im.crop((int(left * w), int(top * h), int(right * w), int(bottom * h)))


def cover_crop(im, ratio, focus):
    """Cover crop to an exact ratio. Never stretches, never upscales."""
    w, h = im.size
    fx, fy = focus
    if w / h > ratio:
        new_w = int(round(h * ratio))
        left = int(round((w - new_w) * fx))
        left = max(0, min(left, w - new_w))
        box = (left, 0, left + new_w, h)
    else:
        new_h = int(round(w / ratio))
        top = int(round((h - new_h) * fy))
        top = max(0, min(top, h - new_h))
        box = (0, top, w, top + new_h)
    return im.crop(box)


written = []
skipped = []

for stem, spec in SOURCES.items():
    src = os.path.join(src_root, stem + ".png")
    if not os.path.exists(src):
        raise SystemExit("Missing supplied master: " + src)

    if spec.get("reference"):
        skipped.append(stem)
        continue

    key = os.path.basename(stem)
    with Image.open(src) as im:
        im = im.convert("RGB")
        safe = subrect(im, spec["food_safe"])
        focus = spec.get("focus", (0.5, 0.5))

        for variant, (ratio, target_w, quality) in VARIANTS.items():
            cropped = cover_crop(safe, ratio, focus)
            # Never upscale. §16 names stretching as a failure condition, and
            # a source that cannot fill the target honestly is better served
            # smaller and sharp than large and soft.
            width = min(target_w, cropped.width)
            height = int(round(width / ratio))
            out = cropped.resize((width, height), Image.LANCZOS)

            out_dir = os.path.join(out_root, variant)
            os.makedirs(out_dir, exist_ok=True)
            dest = os.path.join(out_dir, key + ".jpg")
            out.save(dest, "JPEG", quality=quality, optimize=True, progressive=True)
            written.append({
                "key": key,
                "variant": variant,
                "width": width,
                "height": height,
                "bytes": os.path.getsize(dest),
            })

print(json.dumps({"written": written, "skipped": skipped}))
`;

const raw = execFileSync('python3', ['-c', PY, root], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const result = JSON.parse(raw.trim().split('\n').pop());

const total = result.written.reduce((sum, f) => sum + f.bytes, 0);
const keys = new Set(result.written.map((f) => f.key));

console.log(
  `Derived ${result.written.length} crops from ${keys.size} masters ` +
    `(${(total / 1024 / 1024).toFixed(2)}MB total).`,
);
console.log(
  `Held back as art-direction references, never derived: ${result.skipped.length} ` +
    `(${result.skipped.map((s) => s.split('/')[1]).join(', ')}).`,
);

const heaviest = [...result.written].sort((a, b) => b.bytes - a.bytes).slice(0, 3);
for (const f of heaviest) {
  console.log(`  ${f.key} ${f.variant}  ${f.width}x${f.height}  ${(f.bytes / 1024).toFixed(0)}KB`);
}
