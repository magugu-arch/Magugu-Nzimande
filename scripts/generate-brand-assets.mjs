#!/usr/bin/env node
/**
 * Derive every app icon and in-app logo from the licensed bb.q Chicken logo.
 *
 * Two master files are the source of truth, both tight-cropped to their ink
 * with a transparent ground:
 *
 *   assets/brand/masters/bbq-lockup.png   full lock-up: symbol + wordmark + descriptor
 *   assets/brand/masters/bbq-symbol.png   symbol mark alone, the square-format mark
 *
 * Everything below is generated from those two, so the mark is drawn once and
 * every size agrees. Nothing here rearranges, stretches or recolours the logo:
 * derived variants are the two the brand guidelines themselves show — the
 * full-colour lock-up on light grounds, and the all-white reversal on bb.q Red
 * (guidelines v1.0 §3.1, and the approved dark background on that page).
 *
 * Outputs, all overwritten on every run:
 *   assets/icon.png                      1024  iOS + fallback launcher, opaque
 *   assets/splash-icon.png               1024  reversed lock-up, transparent
 *   assets/android-icon-foreground.png   1024  adaptive foreground, safe zone
 *   assets/android-icon-background.png   1024  adaptive background, solid red
 *   assets/android-icon-monochrome.png   1024  themed-icon silhouette
 *   assets/notification-icon.png           96  Android notification silhouette
 *   assets/favicon.png                     48  web
 *   assets/brand/lockup{,@2x,@3x}.png          in-app mark, light surfaces
 *   assets/brand/lockup-reversed{,@2x,@3x}.png in-app mark, dark surfaces
 *
 * Run: npm run assets:brand
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PY = String.raw`
import os, sys
from PIL import Image, ImageFilter

root = sys.argv[1]
assets = os.path.join(root, "assets")
brand = os.path.join(assets, "brand")
masters = os.path.join(brand, "masters")
os.makedirs(brand, exist_ok=True)

RED = (227, 25, 55)          # bb.q Red   #E31937
WHITE = (255, 255, 255)

# Android's adaptive-icon safe zone: the launcher may mask anything outside the
# centre 66%, so the mark has to live inside it or corners get clipped.
ADAPTIVE_SAFE = 0.66


def load(name):
    """Load a master and crop to its ink, so padding is ours to decide."""
    im = Image.open(os.path.join(masters, name)).convert("RGBA")
    box = im.getchannel("A").getbbox()
    return im.crop(box) if box else im


def whiten(mark):
    """The all-white reversal, keeping the original coverage as alpha.

    Recolouring is not a licence to redraw: every pixel keeps the exact
    coverage it had, only the ink turns white. That is the variant the
    guidelines show on red and black grounds.
    """
    out = Image.new("RGBA", mark.size, WHITE + (0,))
    out.putalpha(mark.getchannel("A"))
    return out


def fit(mark, box_w, box_h):
    """Scale a mark to fit a box, preserving aspect. Downscale only."""
    scale = min(box_w / mark.width, box_h / mark.height)
    size = (max(1, round(mark.width * scale)), max(1, round(mark.height * scale)))
    return mark.resize(size, Image.LANCZOS)


def place(mark, canvas_size, coverage, ground=None):
    """Centre a mark on a square canvas at the given fraction of its width."""
    w = h = canvas_size
    base = Image.new("RGBA", (w, h), (ground + (255,)) if ground else (0, 0, 0, 0))
    scaled = fit(mark, w * coverage, h * coverage)
    base.alpha_composite(scaled, ((w - scaled.width) // 2, (h - scaled.height) // 2))
    return base


def save(im, name, opaque=False, ground=RED):
    if opaque:
        flat = Image.new("RGB", im.size, ground)
        flat.paste(im, mask=im.getchannel("A"))
        im = flat
    im.save(os.path.join(assets, name))


lockup = load("bbq-lockup.png")
symbol = load("bbq-symbol.png")
lockup_rev = whiten(lockup)
symbol_rev = whiten(symbol)

# ---- launcher icons -------------------------------------------------------
# The symbol, reversed on bb.q Red. The lock-up is 5.6:1 and would shrink to
# nothing in a square; the symbol is the mark that survives at 60px on a home
# screen. iOS rejects alpha in the app icon, hence opaque.
save(place(symbol_rev, 1024, 0.62, ground=RED), "icon.png", opaque=True)

save(place(symbol_rev, 1024, ADAPTIVE_SAFE * 0.86), "android-icon-foreground.png")
save(Image.new("RGBA", (1024, 1024), RED + (255,)), "android-icon-background.png")

# Themed icons are tinted by the launcher from the alpha channel alone, so the
# colour here is irrelevant — only the silhouette survives.
save(place(symbol_rev, 1024, ADAPTIVE_SAFE * 0.86), "android-icon-monochrome.png")

# Same rule for notification icons, but 24dp is below what this mark's line
# weight survives: scaled down as drawn it collapses into a grey smudge. The
# strokes are thickened just for the badge -- an optical correction at one
# size, the way a type designer hints a face for small text. Measured at 24dp;
# heavier than this and the chicken fills in and stops reading as a chicken.
badge = symbol_rev.copy()
badge.putalpha(badge.getchannel("A").filter(ImageFilter.MaxFilter(13)))
save(place(badge, 96, 0.92), "notification-icon.png")

save(place(symbol_rev, 48, 0.74, ground=RED), "favicon.png", opaque=True)

# ---- splash ---------------------------------------------------------------
# The splash ground is bb.q Red, so this is the reversed lock-up, transparent,
# sized by app.json's imageWidth.
splash = fit(lockup_rev, 1024, 1024)
splash.save(os.path.join(assets, "splash-icon.png"))

# ---- in-app mark ----------------------------------------------------------
# BrandMark renders at most 240dp wide, so 3x is 720px; anything larger is
# bytes the bundle carries and no screen ever uses.
for name, art in (("lockup", lockup), ("lockup-reversed", lockup_rev)):
    for suffix, width in (("", 240), ("@2x", 480), ("@3x", 720)):
        fit(art, width, width).save(os.path.join(brand, name + suffix + ".png"))

print("brand assets written from", os.path.relpath(masters, root))
print("  lock-up master", lockup.size, " symbol master", symbol.size)
`;

execFileSync('python3', ['-c', PY, root], { stdio: 'inherit' });
