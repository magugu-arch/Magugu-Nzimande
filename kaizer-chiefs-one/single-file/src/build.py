"""Build the single-file Kaizer Chiefs One concept app.

Usage (from kaizer-chiefs-one/):
    python3 -I single-file/src/build.py [--out single-file/Kaizer_Chiefs_One_Concept.html]
        [--site-url https://host/path/]

Produces ONE self-contained HTML file: every image, font and icon is embedded,
so it works offline, from a phone's Downloads or Files app, and as a WhatsApp
document. Every screen is written into the HTML, so it reads fully with
JavaScript off (iPhone Files and WhatsApp previews, Android's HTML viewer).
With JavaScript on it becomes the interactive app.

Also writes og-image.jpg (1200x630) beside the file for link previews when the
file is hosted; --site-url makes the preview tags absolute.

Images come from apps/mobile/assets/concept (generated concept references, not
club photography). Each is re-encoded, which strips EXIF/GPS metadata, and
embedded once as a CSS class so screens can reuse it without duplicating bytes.
"""
import argparse
import base64
import datetime as dt
import html
import io
import json
import pathlib
import re
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[1]  # kaizer-chiefs-one/
CONCEPT = ROOT / "apps" / "mobile" / "assets" / "concept"

# ---------------------------------------------------------------------------
# Images: class name, source file, max width, where it is used, alt text,
# reference-canvas node id. Alt text describes the picture, not the brand.
# ---------------------------------------------------------------------------
IMAGES = [
    ("stadium", "stadium.jpg", 1080, "Home hero · Fan Moments sample · Rewards", "A full stadium at night under floodlights, supporters waving black and gold flags.", "4cbbbe6f-9881-4f5d-831b-645c21d3be25"),
    ("portrait", "supporter-portrait.jpg", 1000, "Welcome hero · Fan Moment detail", "A supporter in the stands holding a black and gold scarf above her head, laughing.", "197bf2a8-9912-41ef-948f-6bd16a8aa4f8"),
    ("fancam", "fan-cam.jpg", 900, "Story: Your matchday · Fan Moments sample · Rewards", "A smiling supporter in a gold beanie on the stadium big screen, the crowd cheering below.", "a5f1f82a-0246-4c62-9c25-569a580dd365"),
    ("merch", "merchandise.jpg", 900, "Shop · Rewards", "Black and gold merchandise: a scarf, cap, folded jersey, mug, lanyard, key ring and wristband.", "7e0acbc7-9b7b-4969-bc4c-c15ecd32d5c3"),
    ("women", "womens-team.jpg", 900, "Story: Together before kick-off · Fan Moments sample", "Players in gold and black kit joining hands in a huddle before a match.", "5c81827d-105d-4587-bce1-3ce8998db4e3"),
    ("academy", "youth-academy.jpg", 900, "Story: Where the next generation learns the game", "Two coaches crouching to talk with a group of young players on a dry pitch at sunset.", "262dc763-6444-4a27-8bc5-40e6ad5d28be"),
    ("community", "community.jpg", 800, "Story: Football in the neighbourhood · Rewards", "A smiling coach handing a black and gold football to a child, other children watching.", "55aea822-ccb9-4fd4-a320-a84eae9664f8"),
    ("squad", "squad-tunnel.jpg", 800, "Match · squad header", "Six players in black and gold kit standing together in a lit stadium tunnel.", "ac619a81-7e3b-4b82-9187-172c76d5a729"),
    ("action", "match-action.jpg", 900, "Match Centre header", "A player in gold and black running with the ball, a defender in black chasing.", "724e48f9-2990-4a2d-9b4b-4b18c40ab3c8"),
]

FONTS = [
    ("Barlow Condensed", "barlow-condensed-latin-600-normal.woff2", "normal", "600"),
    ("Barlow Condensed", "barlow-condensed-latin-700-normal.woff2", "normal", "700"),
    ("Barlow Condensed", "barlow-condensed-latin-700-italic.woff2", "italic", "700"),
    ("Inter", "inter-latin-400-normal.woff2", "normal", "400"),
    ("Inter", "inter-latin-600-normal.woff2", "normal", "600"),
    ("Inter", "inter-latin-700-normal.woff2", "normal", "700"),
    ("DM Mono", "dm-mono-latin-400-normal.woff2", "normal", "400"),
    ("DM Mono", "dm-mono-latin-500-normal.woff2", "normal", "500"),
]

# ---------------------------------------------------------------------------
# Colour tokens. Mirrors packages/ui/src/color.ts (proposed values from the
# brief, to be replaced from the club's CI manual).
# ---------------------------------------------------------------------------
BRAND = {"gold": "#E0B43C", "black": "#101010", "charcoal": "#242424", "ivory": "#F5F0E4", "mutedGold": "#A9822B"}


def _rgb(h):
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]


def mix(a, b, t):
    pa, pb = _rgb(a), _rgb(b)
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(pa, pb))


def rgba(h, a):
    r, g, b = _rgb(h)
    return f"rgba({r}, {g}, {b}, {a})"


TOKENS = {
    "bg": BRAND["black"],
    "bg-raised": mix(BRAND["black"], BRAND["charcoal"], 0.45),
    "surface": BRAND["charcoal"],
    "surface-high": mix(BRAND["charcoal"], BRAND["ivory"], 0.08),
    "ivory": BRAND["ivory"],
    "text": BRAND["ivory"],
    "text-2": mix(BRAND["ivory"], BRAND["black"], 0.25),
    "text-3": mix(BRAND["ivory"], BRAND["black"], 0.36),
    "ink": BRAND["black"],
    "ink-2": mix(BRAND["black"], BRAND["ivory"], 0.35),
    "gold": BRAND["gold"],
    "gold-pressed": mix(BRAND["gold"], BRAND["black"], 0.15),
    "gold-muted": BRAND["mutedGold"],
    "line": rgba(BRAND["ivory"], 0.12),
    "line-2": rgba(BRAND["ivory"], 0.24),
    "line-gold": rgba(BRAND["gold"], 0.5),
    "scrim": "rgba(0, 0, 0, 0.6)",
    "chrome": rgba(BRAND["black"], 0.72),
    "live": "#F05252",
    "success": "#4CC38A",
    "danger": "#F05252",
}

# ---------------------------------------------------------------------------
# Demo data. Same rules as the app: lettered opponents, nothing confirmed,
# no scores, no names, no prices, no balances.
# ---------------------------------------------------------------------------
FIXTURES = [("A", True, "Scheduled", "outline", True), ("B", False, "Scheduled", "outline", False),
            ("C", True, "To be confirmed", "outline", False), ("D", False, "Postponed", "danger", False)]
RESULTS = [("E", True), ("F", False)]
POSITIONS = [("Goalkeepers", 2), ("Defenders", 4), ("Midfielders", 4), ("Forwards", 3)]


def svg(name, cls="ico"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#i-{name}"/></svg>'


def fixture_card(letter, home, status_label, tone, tickets, completed=False):
    side = "H" if home else "A"
    teams = f"Kaizer Chiefs versus Opponent {letter}" if home else f"Opponent {letter} versus Kaizer Chiefs"
    label = f"{teams}. Competition name, demo. Date to be confirmed. {status_label}. Demo fixture."
    extra = '<span class="micro">Result from match feed</span>' if completed else ""
    return f'''<a class="fixture press" href="#match-centre" aria-label="{label}" data-venue="{'home' if home else 'away'}">
  <div class="fx-main">
    <div class="fx-date"><span class="micro">Date</span><b class="data-xl">TBC</b></div>
    <div class="fx-mid">
      <div class="fx-badges"><span class="crest-slot sm" aria-hidden="true"></span><span class="micro gold">VS</span><span class="badge-slot" aria-hidden="true"></span></div>
      <b class="fx-opp">OPPONENT {letter}</b>
      <span class="micro gold">Competition name (demo)</span>
    </div>
    <div class="fx-side"><span class="ha {'ha--home' if home else ''}">{side}</span><span class="data">Time TBC</span></div>
  </div>
  <div class="fx-foot"><span class="pill pill--{tone}">{status_label}</span>{extra}<span class="grow"></span><span class="tag demo">Demo</span></div>
</a>'''


def build_fixtures():
    return "\n".join(fixture_card(l, h, s, t, k) for l, h, s, t, k in FIXTURES)


def build_results():
    return "\n".join(fixture_card(l, h, "Full time", "neutral", False, completed=True) for l, h in RESULTS)


def build_squad():
    out = []
    for title, n in POSITIONS:
        tiles = "".join(
            f'<a class="player press" href="#player" aria-label="Player name, placeholder profile">'
            f'<span class="silhouette" aria-hidden="true">{svg("person", "ico silh")}</span>'
            f'<span class="player-meta"><b class="data gold">—</b><span>Player name</span></span></a>'
            for _ in range(n)
        )
        out.append(f'<p class="eyebrow eyebrow--plain">{title}</p><div class="players">{tiles}</div>')
    return "\n".join(out)


def encode_image(path, width):
    im = Image.open(path).convert("RGB")
    src = im.size
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    buf = io.BytesIO()
    # JPEG for the widest support (iPhone Quick Look, Android HTML viewers).
    # Re-encoding without exif strips any camera or location metadata.
    im.save(buf, "JPEG", quality=72, optimize=True, progressive=True)
    return buf.getvalue(), im.size, src


def og_image(out_dir):
    """1200x630 link-preview image: the stadium concept with a typeset, honest label."""
    im = Image.open(CONCEPT / "stadium.jpg").convert("RGB")
    scale = 1200 / im.width
    im = im.resize((1200, round(im.height * scale)), Image.LANCZOS)
    top = max(0, (im.height - 630) // 2 + 60)
    im = im.crop((0, top, 1200, top + 630))
    # Left-to-right shade so the type sits on near-black, the stadium shows on the right.
    shade = Image.new("L", (1200, 630))
    for x in range(1200):
        shade.paste(int(235 * max(0.0, 1 - x / 760)), (x, 0, x + 1, 630))
    dark = Image.new("RGB", (1200, 630), (16, 16, 16))
    im = Image.composite(dark, im, shade)
    d = ImageDraw.Draw(im)
    fdir = ROOT / "node_modules" / "@expo-google-fonts"
    bold = ImageFont.truetype(str(fdir / "barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf"), 112)
    ital = ImageFont.truetype(str(fdir / "barlow-condensed/700Bold_Italic/BarlowCondensed_700Bold_Italic.ttf"), 112)
    mono = ImageFont.truetype(str(fdir / "dm-mono/500Medium/DMMono_500Medium.ttf"), 22)
    gold, ivory = (224, 180, 60), (245, 240, 228)
    d.rectangle((72, 118, 112, 120), fill=gold)
    d.text((128, 106), "AMAKHOSI · ONE APP", font=mono, fill=gold)
    d.text((70, 160), "EVERY KHOSI", font=bold, fill=ivory)
    d.text((70, 272), "matters.", font=ital, fill=gold)
    d.text((72, 470), "KAIZER CHIEFS ONE · CONCEPT PROTOTYPE", font=mono, fill=ivory)
    d.text((72, 504), "Not an official club app. Concept imagery.", font=mono, fill=(187, 184, 175))
    path = out_dir / "og-image.jpg"
    im.save(path, "JPEG", quality=84, optimize=True, progressive=True)
    return path


def git_rev():
    try:
        return subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except Exception:
        return "unknown"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "single-file" / "Kaizer_Chiefs_One_Concept.html"))
    ap.add_argument("--site-url", default="", help="where the file will be hosted, for absolute preview tags")
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    site = a.site_url and (a.site_url if a.site_url.endswith("/") else a.site_url + "/")

    # Images, embedded once each.
    css, manifest_images = [], []
    for key, fname, width, use, alt, node in IMAGES:
        data, (w, h), (sw, sh) = encode_image(CONCEPT / fname, width)
        css.append(f".i-{key}{{background-image:url(data:image/jpeg;base64,{base64.b64encode(data).decode('ascii')})}}")
        manifest_images.append({
            "id": key, "file": fname, "status": "concept", "use": use, "alt": alt,
            "canvasNode": node, "width": w, "height": h, "sourceWidth": sw, "sourceHeight": sh,
            "format": "image/jpeg", "bytes": len(data),
        })

    fonts = "\n".join(
        f'@font-face{{font-family:"{fam}";src:url(data:font/woff2;base64,{base64.b64encode((HERE / "fonts" / f).read_bytes()).decode("ascii")}) format("woff2");'
        f"font-style:{style};font-weight:{weight};font-display:swap}}"
        for fam, f, style, weight in FONTS
    )
    tokens = ":root{" + "".join(f"--{k}:{v};" for k, v in TOKENS.items()) + "}"

    icon = Image.open(ROOT / "apps" / "mobile" / "assets" / "brand" / "icon.png").convert("RGB").resize((180, 180), Image.LANCZOS)
    ibuf = io.BytesIO()
    icon.save(ibuf, "PNG", optimize=True)
    touch_icon = base64.b64encode(ibuf.getvalue()).decode("ascii")

    og = og_image(out.parent)

    built = dt.date.today().isoformat()
    rev = git_rev()
    manifest = {
        "name": "Kaizer Chiefs One",
        "status": "Concept prototype. Not an official Kaizer Chiefs product and not approved by the club.",
        "built": built,
        "sourceRevision": rev,
        "brief": "Kaizer Chiefs One App: Product and Claude Code Brief, 10 November 2026",
        "referenceCanvas": "https://higgsfield.ai/canvas/04f1701f-1b16-479d-97f4-d196c135b398",
        "content": "All content is DEMO or SAMPLE. No fixtures, scores, players, membership, tickets, prices, balances or partner offers are real.",
        "imagesNote": "Generated concept images from the reference canvas. They show generated approximations of club marks and must be replaced with licensed, consented photography before release. EXIF and location metadata stripped.",
        "crest": "Not included. Reserved placeholder until the club supplies approved artwork.",
        "fonts": "Barlow Condensed, Inter and DM Mono, SIL Open Font License 1.1.",
        "images": manifest_images,
    }
    manifest_json = json.dumps(manifest, ensure_ascii=False, indent=1).replace("</", "<\\/")

    asset_rows = "\n".join(
        f'<tr><td><span class="thumb i-{m["id"]}" role="img" aria-label="{html.escape(m["alt"], quote=True)}"></span></td>'
        f'<td><b>{html.escape(m["file"])}</b><br><span class="micro">{m["width"]}×{m["height"]} · {round(m["bytes"] / 1024)} KB · concept</span>'
        f'<br><span class="muted">{html.escape(m["use"])}</span><br><span class="micro">Canvas node {m["canvasNode"][:8]}…</span></td></tr>'
        for m in manifest_images
    )

    head = (HERE / "head.html").read_text("utf8")
    body = (HERE / "body.html").read_text("utf8")
    page = head + "\n" + body
    total_img = sum(m["bytes"] for m in manifest_images)
    preview = (site + "og-image.jpg") if site else "og-image.jpg"
    replacements = {
        "__FONTS__": fonts,
        "__TOKENS__": tokens,
        "__IMAGES__": "\n".join(css),
        "__STYLES__": (HERE / "styles.css").read_text("utf8"),
        "__APP_JS__": (HERE / "app.js").read_text("utf8"),
        "__MANIFEST__": manifest_json,
        "__TOUCH_ICON__": touch_icon,
        "__OG_IMAGE__": preview,
        "__CANONICAL__": f'<link rel="canonical" href="{site}">\n<meta property="og:url" content="{site}">' if site else "",
        "__FIXTURES__": build_fixtures(),
        "__RESULTS__": build_results(),
        "__SQUAD__": build_squad(),
        "__ASSET_ROWS__": asset_rows,
        "__BUILT__": built,
        "__REV__": rev,
        "__IMG_COUNT__": str(len(manifest_images)),
        "__IMG_KB__": str(round(total_img / 1024)),
    }
    for k, v in replacements.items():
        page = page.replace(k, v)
    for key, _f, _w, _u, alt, _n in IMAGES:
        page = page.replace(f"__ALT_{key.upper()}__", html.escape(alt, quote=True))
    left = sorted(set(re.findall(r"__[A-Z_]+__", page)))
    if left:
        sys.exit(f"unfilled placeholders: {left}")
    out.write_text(page, "utf8")
    print(f"wrote {out} ({out.stat().st_size / 1048576:.2f} MB; {len(manifest_images)} images, {total_img / 1024:.0f} KB)")
    print(f"wrote {og} ({og.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
