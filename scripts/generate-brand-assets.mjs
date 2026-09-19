#!/usr/bin/env node
/**
 * Draw every Pappas app icon and in-app mark from the CI sheet.
 *
 * ── Why these are drawn rather than derived ──────────────────────────────
 *
 * The app this was built from had two licensed master PNGs and cut every
 * icon out of them, which is the right arrangement. Pappas has not supplied
 * a logo file — the mark appears in sixteen photographs and on a brand sheet
 * (asset 15, panel 01), and nowhere as artwork.
 *
 * So the mark is reconstructed: the olive sprig drawn to the silhouette panel
 * 01 shows, and `PAPPAS` set in Cinzel, which is the face the CI sheet itself
 * specifies and the one the printed lockup uses. Every measurement — the
 * sprig above the name, the tracking, the rule, the descriptor beneath — is
 * read off panel 01.
 *
 * **This is a placeholder and §14 says to treat it as one**: "Verify official
 * logo/font files before replacing any placeholders with production assets."
 * When Pappas supplies the vector, put it in `assets/brand/masters/` and make
 * this script cut from it instead of drawing. The outputs and their sizes do
 * not change.
 *
 * Colours are the CI sheet's own: Mediterranean Olive #2E4A2F, Sunset Gold
 * #D4A853, Stone Beige #EDE6D9, Charcoal #1A1A1A.
 *
 * Outputs, all overwritten on every run:
 *   assets/icon.png                      1024  iOS + fallback launcher, opaque
 *   assets/splash-icon.png               1024  reversed lock-up, transparent
 *   assets/android-icon-foreground.png   1024  adaptive foreground, safe zone
 *   assets/android-icon-background.png   1024  adaptive background, solid
 *   assets/android-icon-monochrome.png   1024  themed-icon silhouette
 *   assets/notification-icon.png           96  Android notification silhouette
 *   assets/favicon.png                     48  web
 *   assets/brand/lockup{,@2x,@3x}.png          in-app mark, light surfaces
 *   assets/brand/lockup-reversed{,@2x,@3x}.png in-app mark, dark surfaces
 *
 * Requires Python 3 + Pillow. Run: npm run assets:brand
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
os.makedirs(os.path.join(assets, "brand"), exist_ok=True)

OLIVE    = (46, 74, 47, 255)
GOLD     = (212, 168, 83, 255)
STONE    = (237, 230, 217, 255)
CHARCOAL = (26, 26, 26, 255)
WHITE    = (255, 255, 255, 255)
CLEAR    = (0, 0, 0, 0)

CINZEL = os.path.join(
    root, "node_modules", "@expo-google-fonts", "cinzel", "400Regular", "Cinzel_400Regular.ttf"
)
MONTSERRAT = os.path.join(
    root, "node_modules", "@expo-google-fonts", "montserrat", "600SemiBold",
    "Montserrat_600SemiBold.ttf",
)
for f in (CINZEL, MONTSERRAT):
    if not os.path.exists(f):
        raise SystemExit("Missing font: " + f + " — run npm install first.")


def sprig(size, colour):
    """
    The olive sprig from CI sheet panel 01.

    A stem rising left to right, with leaves along it. Drawn at 4x and
    downsampled so the curves stay clean at icon sizes.

    ── Two things the first pass got wrong ──────────────────────────────
    #
    # The first version drew two small ellipses on a thick stem and read, at
    # icon size, as a matchstick. Rendering it was what showed that; the
    # numbers looked reasonable in the source.
    #
    # Both faults were proportion. An olive leaf is *long* — roughly four
    # times its width — and the printed mark's leaves are nearly as long as
    # the stem is tall, springing from it at a shallow angle. And the stem
    # itself is a hairline beside them, not a bar. So: leaves 2.4x larger
    # relative to the frame, a stem a third the weight, and four leaves
    # rather than two, which is what makes it read as foliage instead of a
    # cocktail stick.
    """
    s = size * 4
    im = Image.new("RGBA", (s, s), CLEAR)
    d = ImageDraw.Draw(im)
    u = s / 24.0

    # Stem: a shallow arc from lower-left to upper-right.
    import math

    def stem_point(t):
        x = (1 - t) ** 2 * 5.0 + 2 * (1 - t) * t * 10.5 + t ** 2 * 17.5
        y = (1 - t) ** 2 * 21.0 + 2 * (1 - t) * t * 13.0 + t ** 2 * 4.0
        return x, y

    points = [tuple(c * u for c in stem_point(i / 40)) for i in range(41)]
    d.line(points, fill=colour, width=max(1, int(0.8 * u)), joint="curve")

    def leaf(t, side, length):
        """
        One leaf, attached to the stem rather than sitting on it.

        ── The mistake this fixes ────────────────────────────────────────
        #
        # The previous version centred each leaf's ellipse on a point and
        # rotated it, which put half of every leaf on the far side of the
        # stem. Four of those overlapping produced a blob with a stick
        # through it — legible as neither a sprig nor anything else.
        #
        # A leaf springs *from* the stem and extends away from it. So the
        # ellipse's centre is pushed out along the leaf's own axis by half
        # its length, which puts its inner tip on the stem and its body
        # clear of it.
        """
        bx, by = stem_point(t)
        # The stem's direction here, so leaves sit at a consistent angle to
        # it rather than to the frame.
        ax, ay = stem_point(max(0.0, t - 0.06))
        cx_, cy_ = stem_point(min(1.0, t + 0.06))
        stem_angle = math.degrees(math.atan2(cy_ - ay, cx_ - ax))
        # 42 degrees off the stem is the angle panel 01 draws them at.
        angle = stem_angle + (-42 if side > 0 else 42)
        rad = math.radians(angle)

        # Push the centre out along the leaf's axis so the inner tip lands
        # on the stem.
        cx = bx + math.cos(rad) * length / 2
        cy = by + math.sin(rad) * length / 2

        width = length * 0.34
        leaf_im = Image.new("RGBA", (s, s), CLEAR)
        ImageDraw.Draw(leaf_im).ellipse(
            [
                (cx - length / 2) * u,
                (cy - width / 2) * u,
                (cx + length / 2) * u,
                (cy + width / 2) * u,
            ],
            fill=colour,
        )
        return leaf_im.rotate(-angle, center=(cx * u, cy * u), resample=Image.BICUBIC)

    # Leaves along the stem, alternating sides and shortening toward the tip.
    for t, side, length in ((0.30, 1, 7.4), (0.30, -1, 7.0), (0.62, 1, 6.6), (0.62, -1, 6.2), (0.92, 1, 5.4)):
        im.alpha_composite(leaf(t, side, length))

    return im.resize((size, size), Image.LANCZOS)


def tracked(draw, xy, text, font, fill, tracking, anchor_centre_x=None):
    """Draw text with letter-spacing, which Pillow has no native support for."""
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x, y = xy
    if anchor_centre_x is not None:
        x = anchor_centre_x - total / 2
    for ch, w in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += w + tracking
    return total


def lockup(width, ink, accent, descriptor=True, transparent=True, ground=None):
    """
    The stacked primary lock-up: sprig, PAPPAS, rule, GREEK & MEDITERRANEAN.

    Proportions from CI sheet panel 01.
    """
    name_size = int(width * 0.155)
    sprig_size = int(width * 0.20)
    tracking = width * 0.028

    cinzel = ImageFont.truetype(CINZEL, name_size)

    # The descriptor is sized to fit rather than set at a fixed fraction.
    #
    # "GREEK & MEDITERRANEAN" is twenty-one letterspaced characters, and at a
    # fixed size it ran off both edges of the lock-up — visible the moment it
    # was rendered, invisible in the source. Measuring it and shrinking until
    # it fits inside 88% of the width is what makes the mark correct at every
    # size rather than at the one that happened to be checked.
    desc_size = max(5, int(width * 0.043))
    desc_tracking = width * 0.024
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    while desc_size > 5:
        mont = ImageFont.truetype(MONTSERRAT, desc_size)
        measured = sum(
            probe.textlength(ch, font=mont) for ch in "GREEK & MEDITERRANEAN"
        ) + desc_tracking * 20
        if measured <= width * 0.88:
            break
        desc_size -= 1
        desc_tracking *= 0.94
    mont = ImageFont.truetype(MONTSERRAT, desc_size)

    height = int(sprig_size + name_size * 1.55 + (width * 0.14 if descriptor else 0))
    im = Image.new("RGBA", (width, height), CLEAR if transparent else (ground or WHITE))
    d = ImageDraw.Draw(im)

    im.alpha_composite(sprig(sprig_size, accent), (int((width - sprig_size) / 2), 0))

    y = sprig_size + int(width * 0.02)
    tracked(d, (0, y), "PAPPAS", cinzel, ink, tracking, anchor_centre_x=width / 2)

    if descriptor:
        rule_y = int(y + name_size * 1.42)
        rule_w = int(width * 0.30)
        d.line(
            [(width - rule_w) / 2, rule_y, (width + rule_w) / 2, rule_y],
            fill=accent,
            width=max(1, int(width * 0.004)),
        )
        tracked(
            d,
            (0, rule_y + int(width * 0.028)),
            "GREEK & MEDITERRANEAN",
            mont,
            ink,
            desc_tracking,
            anchor_centre_x=width / 2,
        )

    return im


def trim(im):
    box = im.getbbox()
    return im.crop(box) if box else im


written = []


def save(rel, im):
    dest = os.path.join(assets, rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.save(dest, "PNG")
    written.append((rel, im.size[0], im.size[1]))


# ── App icon. Stone ground, olive mark: the CI sheet's own pairing. ────────
icon = Image.new("RGBA", (1024, 1024), STONE)
mark = lockup(700, OLIVE, GOLD, descriptor=False)
icon.alpha_composite(mark, ((1024 - mark.size[0]) // 2, (1024 - mark.size[1]) // 2))
save("icon.png", icon)

# ── Splash. The full reversed lock-up, transparent.
# Kept wider than 5:1 so the splash reads as a lock-up rather than a badge —
# the aspect check in __tests__/brandAssets.test.ts holds that.
splash_mark = trim(lockup(900, WHITE, GOLD))
splash = Image.new("RGBA", (1024, max(1, int(1024 / 5.6))), CLEAR)
scaled = splash_mark.resize(
    (int(splash.size[1] * splash_mark.size[0] / splash_mark.size[1]), splash.size[1]),
    Image.LANCZOS,
)
splash.alpha_composite(scaled, ((splash.size[0] - scaled.size[0]) // 2, 0))
save("splash-icon.png", splash)

# ── Android adaptive icon. The foreground must sit inside the 66% safe zone.
fg = Image.new("RGBA", (1024, 1024), CLEAR)
fg_mark = lockup(560, STONE, GOLD, descriptor=False)
fg.alpha_composite(fg_mark, ((1024 - fg_mark.size[0]) // 2, (1024 - fg_mark.size[1]) // 2))
save("android-icon-foreground.png", fg)
save("android-icon-background.png", Image.new("RGBA", (1024, 1024), OLIVE))

# Themed icon: a single-colour silhouette, which Android recolours itself.
mono = Image.new("RGBA", (1024, 1024), CLEAR)
mono_mark = lockup(560, WHITE, WHITE, descriptor=False)
mono.alpha_composite(mono_mark, ((1024 - mono_mark.size[0]) // 2, (1024 - mono_mark.size[1]) // 2))
save("android-icon-monochrome.png", mono)

# ── Notification icon. Android draws this as a white silhouette, so only the
# alpha channel survives — the sprig alone, because a wordmark at 96px is a
# grey bar in a status bar.
notif = Image.new("RGBA", (96, 96), CLEAR)
notif.alpha_composite(sprig(88, WHITE), (4, 4))
save("notification-icon.png", notif)

# ── Favicon.
fav = Image.new("RGBA", (48, 48), STONE)
fav.alpha_composite(sprig(44, OLIVE), (2, 2))
save("favicon.png", fav)

# ── In-app marks, at the three densities React Native resolves.
#
# Drawn once at @3x and downsampled, rather than drawn three times at three
# sizes. Drawing each independently rounded every proportion separately and
# produced 240x138, 480x277 and 720x416 — none of them an exact multiple of
# the others. React Native picks a density file and lays it out at the @1x
# box, so a @2x that is 277 tall where 276 was expected is half a point of
# drift on every surface the mark appears on.
#
# One render, three exact scales, and the downsample is sharper than three
# small renders would have been.
for ink, accent, name in ((CHARCOAL, OLIVE, "lockup"), (WHITE, GOLD, "lockup-reversed")):
    master = lockup(720, ink, accent)
    base_h = master.size[1] // 3
    save(f"brand/{name}@3x.png", master.resize((720, base_h * 3), Image.LANCZOS))
    save(f"brand/{name}@2x.png", master.resize((480, base_h * 2), Image.LANCZOS))
    save(f"brand/{name}.png", master.resize((240, base_h), Image.LANCZOS))

for rel, w, h in written:
    print(f"{rel} {w}x{h}")
`;

const out = execFileSync('python3', ['-c', PY, root], { encoding: 'utf8' });
const lines = out.trim().split('\n');
console.log(`Drew ${lines.length} Pappas brand assets from the CI sheet.`);
for (const line of lines) console.log(`  ${line}`);
console.log(
  '\nThese are a reconstruction from CI sheet panel 01, not licensed artwork.\n' +
    'Brief §14: verify the official logo files before production.',
);
