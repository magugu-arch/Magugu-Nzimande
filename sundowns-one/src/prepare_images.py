"""Prepare the Sundowns One image set from the supplied uploads.

Usage:
    python3 -I prepare_images.py <upload_dir>

Reads the 51 supplied images (IMG_7674 to IMG_7725, mapped to their upload
file names in SOURCES below), applies the crops recorded in assets.json,
re-encodes each one as WebP (which strips EXIF/GPS metadata) into img/, and
writes:

- img/<id>.webp            one file per asset (crop applied)
- panels.json              the four photo panels inside each storyboard image,
                           measured from the image, so the app can show each
                           step on its own and set the captions as real text
- brand/crest.webp         the supplied crest, cut out of its screenshot
- pwa/icon-192.png, pwa/icon-512.png, brand/apple-touch-icon.png,
  brand/favicon.png        home-screen and browser icons
- brand/og-image.jpg       1200 x 630 social preview

Images the fan app does not place on a screen (status "hold" or "staff") are
kept smaller: they only appear in the asset library.
"""
import io
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).resolve().parent

# IMG number -> upload file name (as received on 14 November 2026).
SOURCES = {
    "7674": "1df77b4b-image.jpg", "7676": "812379a1-image.png", "7677": "46c16733-image.png",
    "7678": "877d8afe-image.png", "7679": "adb35789-image.png", "7680": "e7e9621a-image.png",
    "7681": "1b99c8c4-image.png", "7682": "54dabb68-image.png", "7683": "6e24e49f-image.png",
    "7684": "320a0843-image.png", "7685": "c08d3892-image.png", "7686": "ed6f4146-image.png",
    "7687": "c5ef74bb-image.png", "7688": "e2f983ef-image.png", "7689": "524034b7-image.png",
    "7690": "defcdbd0-image.png", "7691": "9ee86b6e-image.png", "7692": "135d1325-image.png",
    "7693": "12de0686-image.png", "7694": "96bc38d5-image.png", "7695": "82f9ce52-image.png",
    "7696": "65c344da-image.png", "7697": "6e3b4f78-image.png", "7698": "ae73e13d-image.png",
    "7699": "8174e4e2-image.png", "7700": "6169a6fd-image.png", "7701": "daea03f5-image.png",
    "7702": "07d9f833-image.png", "7703": "54174678-image.png", "7704": "5948608b-image.png",
    "7705": "963f093f-image.png", "7706": "9dfe6377-image.png", "7707": "203dc09b-image.png",
    "7708": "b7ea982c-image.png", "7709": "b0d5976e-image.png", "7710": "55f2bd61-image.png",
    "7711": "d89ce972-image.png", "7712": "156be8b0-image.png", "7713": "1ebabef9-image.png",
    "7714": "b59c4451-image.png", "7715": "6e71ce7d-image.png", "7716": "393e0020-image.png",
    "7717": "a9bb7a55-image.png", "7718": "53680f71-image.png", "7719": "71355f28-image.png",
    "7720": "45a6e3a2-image.png", "7721": "530bc101-image.png", "7722": "80cb1398-image.png",
    "7723": "924ad417-image.png", "7724": "9f051e4e-image.png", "7725": "7f045982-image.png",
}

GREEN = (12, 62, 46)  # the storyboard caption bars, used as the brand's deep green
CREST_BOX = (44, 122, 1138, 1050)  # the crest inside its screenshot, clear of the viewer's buttons


def encode(im, long_edge, quality):
    im = im.convert("RGB")
    im.thumbnail((long_edge, long_edge), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return buf.getvalue(), im.size


def storyboard_panels(im):
    """Return the four photo rectangles (caption bars excluded) as [l, t, w, h]."""
    a = np.asarray(im.convert("RGB")).astype(int)
    h, w, _ = a.shape
    white_rows = [y for y in range(h) if (a[y] > 235).all(axis=1).mean() > 0.9]
    white_cols = [x for x in range(w) if (a[:, x] > 235).all(axis=1).mean() > 0.9]
    if not white_rows or not white_cols:
        raise SystemExit("storyboard gutters not found")
    gy0, gy1 = min(white_rows), max(white_rows)
    gx0, gx1 = min(white_cols), max(white_cols)

    def bar_top(x0, x1, y0, y1):
        # first row (from the bottom up) where the caption bar's green stops
        for y in range(y1 - 4, y0, -1):  # skip the anti-aliased edge above the gutter
            seg = a[y, x0 + 4:x1 - 4]
            green = (np.abs(seg - np.array(GREEN)).sum(axis=1) < 40).mean()
            if green < 0.35:
                return y + 1
        return y1

    panels = []
    for (y0, y1) in ((0, gy0), (gy1 + 1, h)):
        for (x0, x1) in ((0, gx0), (gx1 + 1, w)):
            top = bar_top(x0, x1, y0, y1)
            panels.append([x0, y0, x1 - x0, top - y0 - 2])
    return panels


def cut_crest(src):
    """Key the crest out of the screenshot's grey, dotted background."""
    im = src.convert("RGB").crop(CREST_BOX)
    a = np.asarray(im).astype(float)
    mx, mn = a.max(axis=2), a.min(axis=2)
    grey = ((mx - mn) < 30) & (mx > 120)
    # flood fill the background from the border so grey inside the crest survives
    h, w = grey.shape
    bg = np.zeros_like(grey)
    stack = [(y, x) for y in (0, h - 1) for x in range(w)] + [(y, x) for x in (0, w - 1) for y in range(h)]
    while stack:
        y, x = stack.pop()
        if 0 <= y < h and 0 <= x < w and grey[y, x] and not bg[y, x]:
            bg[y, x] = True
            stack.extend(((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)))
    alpha = np.where(bg, 0.0, 1.0)
    # soften the edge: pixels next to the background get alpha from their distance to grey
    edge = np.asarray(Image.fromarray((bg * 255).astype("uint8")).filter(ImageFilter.MaxFilter(5))) > 0
    edge &= ~bg
    ref = np.array([200.0, 200.0, 200.0])
    dist = np.sqrt(((a - ref) ** 2).sum(axis=2))
    soft = np.clip(dist / 90.0, 0, 1)
    alpha = np.where(edge, np.minimum(alpha, soft), alpha)
    safe = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip((a - (1 - alpha)[..., None] * ref) / safe, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype("uint8")
    crest = Image.fromarray(out, "RGBA")
    return crest.crop(crest.getbbox())


def icon(crest, size, scale, radius=0):
    bg = Image.new("RGBA", (size, size), GREEN + (255,))
    c = crest.copy()
    c.thumbnail((int(size * scale), int(size * scale)), Image.LANCZOS)
    bg.alpha_composite(c, ((size - c.width) // 2, (size - c.height) // 2))
    if radius:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius, fill=255)
        bg.putalpha(mask)
    return bg


def og_image(hero, crest, out):
    w, h = 1200, 630
    im = hero.convert("RGB")
    scale = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = im.width - w  # keep the crowd on the right; the left is the green fade
    im = im.crop((left, (im.height - h) // 2, left + w, (im.height - h) // 2 + h)).convert("RGBA")
    c = crest.copy()
    c.thumbnail((150, 150), Image.LANCZOS)
    im.alpha_composite(c, (72, 70))
    d = ImageDraw.Draw(im)
    bold = "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf"
    reg = "/usr/share/fonts/opentype/inter/Inter-Medium.otf"
    try:
        f1, f2, f3 = ImageFont.truetype(bold, 84), ImageFont.truetype(reg, 34), ImageFont.truetype(reg, 22)
    except OSError:
        f1 = f2 = f3 = ImageFont.load_default()
    d.text((72, 262), "Sundowns One", font=f1, fill=(255, 255, 255))
    d.text((74, 366), "The Yellow Nation. One home.", font=f2, fill=(246, 207, 53))
    d.text((74, 540), "Concept prototype · not an official club product", font=f3, fill=(214, 226, 219))
    im.convert("RGB").save(out, "JPEG", quality=84, optimize=True, progressive=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    up = pathlib.Path(sys.argv[1])
    assets = json.loads((HERE / "assets.json").read_text("utf8"))
    (HERE / "img").mkdir(exist_ok=True)
    (HERE / "brand").mkdir(exist_ok=True)
    (HERE / "pwa").mkdir(exist_ok=True)
    panels = {}
    total = 0
    for a in assets["assets"]:
        src = Image.open(up / SOURCES[a["id"]])
        src.load()
        if a.get("crop"):
            src = src.crop(tuple(a["crop"]))
        if a.get("storyboard"):
            panels[a["id"]] = {"size": list(src.size), "panels": storyboard_panels(src)}
        if a["id"] == "7674":
            continue  # the crest becomes brand/crest.webp below, not a photo
        library_only = a["status"] in ("hold", "staff")
        data, size = encode(src, 720 if library_only else 1344, 62 if library_only else 70)
        (HERE / "img" / f"{a['id']}.webp").write_bytes(data)
        total += len(data)
        if library_only and a.get("storyboard"):
            # panel rectangles were measured on the full-size image; rescale them
            f = size[0] / panels[a["id"]]["size"][0]
            panels[a["id"]] = {"size": list(size), "panels": [[round(v * f) for v in p] for p in panels[a["id"]]["panels"]]}
        print(f"{a['id']}  {size[0]}x{size[1]}  {len(data) // 1024} KB  {a['status']}")
    (HERE / "panels.json").write_text(json.dumps(panels, indent=1), "utf8")

    crest = cut_crest(Image.open(up / SOURCES["7674"]))
    c = crest.copy()
    c.thumbnail((480, 480), Image.LANCZOS)
    c.save(HERE / "brand" / "crest.webp", "WEBP", quality=90, method=6)
    icon(crest, 512, 0.7).convert("RGB").save(HERE / "pwa" / "icon-512.png", optimize=True)
    icon(crest, 192, 0.7).convert("RGB").save(HERE / "pwa" / "icon-192.png", optimize=True)
    icon(crest, 180, 0.74).convert("RGB").save(HERE / "brand" / "apple-touch-icon.png", optimize=True)
    icon(crest, 64, 0.86, radius=14).save(HERE / "brand" / "favicon.png", optimize=True)
    hero = Image.open(up / SOURCES["7676"])
    og_image(hero, crest, HERE / "brand" / "og-image.jpg")
    print(f"images: {total / 1048576:.2f} MB WebP; crest, icons and og-image written")


if __name__ == "__main__":
    main()
