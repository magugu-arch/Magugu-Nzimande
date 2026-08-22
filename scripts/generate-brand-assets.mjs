#!/usr/bin/env node
/**
 * Generate the bb.q app icon, splash mark and favicon from brand tokens.
 *
 * The Expo template ships a generic blue chevron; a bb.q Chicken app must not
 * carry it. These are drawn from the same two brand colours the app uses
 * (§6: bb.q Red #E31937, bb.q Black #221E1E) so the launcher icon, splash and
 * in-app wordmark stay in step.
 *
 * Outputs, all overwritten on every run:
 *   assets/icon.png                      1024  iOS + fallback launcher
 *   assets/splash-icon.png               1024  splash mark, transparent
 *   assets/android-icon-foreground.png    512  adaptive foreground (safe zone)
 *   assets/android-icon-background.png    512  adaptive background, solid red
 *   assets/android-icon-monochrome.png    432  themed-icon silhouette
 *   assets/favicon.png                     48  web
 *
 * Replace this with the licensed bb.q logo artwork when it is provisioned —
 * drop the files in and delete this script. Run: npm run assets:brand
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PY = String.raw`
import os, sys
from PIL import Image, ImageDraw, ImageFont

root = sys.argv[1]
assets = os.path.join(root, "assets")

RED = (227, 25, 55)          # bb.q Red   #E31937
BLACK = (34, 30, 30)         # bb.q Black #221E1E
WHITE = (255, 255, 255)

# Liberation Sans Bold is metric-compatible with Helvetica, which the brand
# spec calls for. Swap for the licensed face if one is provisioned.
FONT_PATH = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"


def render_wordmark(colour, height_px):
    """Render 'bb' + square dot + 'q' onto a transparent tile, cropped tight.

    Cropping to the rendered bounding box rather than font metrics is what
    makes the mark sit optically centred: 'bb.q' has both an ascender and a
    descender, so the metric box is taller than the ink and centring on it
    pushes the mark low.
    """
    size = max(8, int(height_px))
    font = ImageFont.truetype(FONT_PATH, size)

    pad = size
    canvas = Image.new("RGBA", (size * 6, size * 4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    bb_w = draw.textlength("bb", font=font)
    q_w = draw.textlength("q", font=font)
    dot = size * 0.17
    gap = size * 0.07
    ascent, _ = font.getmetrics()

    x = pad
    draw.text((x, pad), "bb", font=font, fill=colour)
    x += bb_w + gap

    # The dot sits on the baseline, square rather than round — it is the
    # detail that makes the mark read as bb.q rather than "bbq".
    baseline = pad + ascent
    draw.rectangle([x, baseline - dot, x + dot, baseline], fill=colour)
    x += dot + gap

    draw.text((x, pad), "q", font=font, fill=colour)

    return canvas.crop(canvas.getbbox())


def place_wordmark(target, colour, weight):
    """Draw the wordmark centred in target, scaled to the weight fraction of its width."""
    tw, th = target.size
    mark = render_wordmark(colour, th * 0.5)

    scale = (tw * weight) / mark.size[0]
    # Never let a tall render overflow vertically.
    scale = min(scale, (th * weight) / mark.size[1])
    mark = mark.resize(
        (max(1, int(mark.size[0] * scale)), max(1, int(mark.size[1] * scale))),
        Image.LANCZOS,
    )

    target.paste(
        mark,
        ((tw - mark.size[0]) // 2, (th - mark.size[1]) // 2),
        mark,
    )


def rounded_square(size, radius_ratio, colour):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=colour)
    return im


written = []

# iOS icon — full-bleed red, square corners (the OS applies the mask).
icon = Image.new("RGBA", (1024, 1024), RED + (255,))
place_wordmark(icon, WHITE, 0.68)
icon.convert("RGB").save(os.path.join(assets, "icon.png"))
written.append(("icon.png", "1024 iOS launcher"))

# Splash mark — transparent; app.json paints bb.q Red behind it.
splash = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
place_wordmark(splash, WHITE, 0.72)
splash.save(os.path.join(assets, "splash-icon.png"))
written.append(("splash-icon.png", "1024 splash mark"))

# Android adaptive foreground — Android masks aggressively and can crop to a
# circle, so the mark stays inside the central 66% safe zone.
fg = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
place_wordmark(fg, WHITE, 0.52)
fg.save(os.path.join(assets, "android-icon-foreground.png"))
written.append(("android-icon-foreground.png", "512 adaptive foreground"))

bg = Image.new("RGBA", (512, 512), RED + (255,))
bg.save(os.path.join(assets, "android-icon-background.png"))
written.append(("android-icon-background.png", "512 adaptive background"))

# Themed icon: a silhouette the launcher tints itself, so it must be a solid
# shape on transparent rather than a coloured logo.
mono = Image.new("RGBA", (432, 432), (0, 0, 0, 0))
place_wordmark(mono, BLACK + (255,), 0.52)
mono.save(os.path.join(assets, "android-icon-monochrome.png"))
written.append(("android-icon-monochrome.png", "432 themed silhouette"))

# Favicon — rounded so it reads as an app tile in a browser tab.
fav = rounded_square(192, 0.22, RED + (255,))
place_wordmark(fav, WHITE, 0.70)
fav.resize((48, 48), Image.LANCZOS).save(os.path.join(assets, "favicon.png"))
written.append(("favicon.png", "48 web favicon"))

for name, note in written:
    print("  wrote %-32s %s" % (name, note))
print("Brand assets generated from bb.q Red #E31937 / bb.q Black #221E1E.")
`;

try {
  process.stdout.write(execFileSync('python3', ['-c', PY, root], { encoding: 'utf8' }));
} catch (error) {
  console.error('Brand asset generation failed. Is Pillow installed? (pip install pillow)');
  console.error(error.stderr?.toString() ?? error.message);
  process.exit(1);
}
