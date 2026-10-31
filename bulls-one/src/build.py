"""Build the single-file Bulls One prototype.

Usage:
    python3 -I build.py <briefing.docx> <out_dir> [apple_touch_icon.png]

Reads the 22 reference images embedded in the briefing document (in document
order), re-encodes them as WebP (which strips EXIF/GPS metadata), attaches
their metadata, and inlines everything into one self-contained HTML file.
Also writes og-image.jpg (1200x630) for the social-preview URL.
"""
import base64
import datetime as dt
import html
import io
import json
import pathlib
import re
import sys
import zipfile

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent

# Per-reference metadata: where it is used in the app, and descriptive alt text.
META = {
    "01": ("Fan Cam sample photo · Fan Cam “Fan Cam celebration” moment", "Smiling supporter in a blue jersey celebrating with one arm raised in a packed, floodlit stadium"),
    "02": ("Live Centre hero · away-fixture detail · Home stories", "Rugby player in a blue kit sprints with the ball as opponents in white chase him under floodlights"),
    "03": ("Home · Fan Cam feature card", "Giant stadium LED screen showing a celebrating supporter above a cheering crowd at night"),
    "04": ("Home rewards card · Rewards merch offer", "Blue supporter jersey, cap, water bottle, gift box and phone arranged on a dark navy platform"),
    "05": ("Stadium guide · wayfinding card", "Supporter in a blue jersey checks a stadium map on a phone in the concourse beside a section sign"),
    "06": ("Home · Rewards Golden Ticket Drop", "Glowing golden ticket on a giant stadium screen above supporters raising their phones"),
    "07": ("Matchday · getting here · Fan Cam “First game” moment", "Supporters in blue walk towards the stadium at dusk beneath lit screens"),
    "08": ("Home stories · Club news · operator queue sample", "Supporters with painted faces cheering in the stands during a night match"),
    "09": ("Home hero · home-fixture detail", "Wide view of a packed, floodlit rugby stadium at night"),
    "10": ("Home offer · Rewards Supporter Combo", "Burger, chips, chicken wings and a drink on a table overlooking the pitch"),
    "11": ("Fan Cam “Welcome back” moment · operator queue sample", "Smiling older supporter in a blue jersey and scarf seated in the stands"),
    "12": ("Digital pass sheet (concept reference)", "Phone showing a digital match ticket with block, row and seat and a QR code"),
    "13": ("Home stories · Club community · Fan Cam “Birthday” moment · operator queue sample", "Group of young supporters taking a selfie and cheering in the stands"),
    "14": ("Fan Cam hero · Matchday Fan Cam card", "Supporter cheering below a stadium screen that shows her face"),
    "15": ("Home · install guidance · og-image.jpg", "Supporter holding a phone with the Bulls One app in a packed stadium beside the Bulls One campaign line"),
    "16": ("Live Centre predictions · Club news · Home stories", "Supporters using phones in the stands while stadium screens show live engagement"),
    "17": ("Asset library (mobile home-screen concept)", "Smartphone on a navy background showing a Bulls One home-screen concept"),
    "18": ("Operator console · Screen Studio fallback loop", "Floodlit stadium with large LED screens and ribbon boards glowing blue around the pitch"),
    "19": ("Club · featured player profile", "Rugby player in a blue jersey holding a ball against a dark blue studio background"),
    "20": ("Profile · notification settings", "Hand holding a phone with a blue notification in front of a floodlit stadium"),
    "21": ("Stadium guide fan zone · Rewards fan-zone spin", "Fan zone in a stadium concourse with tall blue screens, touchscreens and a prize wheel"),
    "22": ("Home stories · Club Family Day · Fan Cam “Family day” moment · operator queue sample", "Family of four in blue supporter gear cheering and pointing towards the pitch"),
}


def doc_images(docx: pathlib.Path):
    z = zipfile.ZipFile(docx)
    rels = z.read("word/_rels/document.xml.rels").decode("utf8")
    rmap = {}
    for m in re.finditer(r"<Relationship\b[^>]*>", rels):
        tag = m.group(0)
        rid = re.search(r'Id="([^"]+)"', tag)
        tgt = re.search(r'Target="([^"]+)"', tag)
        if rid and tgt and tgt.group(1).startswith("media/"):
            rmap[rid.group(1)] = tgt.group(1)
    doc = z.read("word/document.xml").decode("utf8")
    order = re.findall(r'r:embed="([^"]+)"', doc)
    text = html.unescape(re.sub(r"<[^>]+>", " ", re.sub(r"</w:p>", "\n", doc)))
    captions = re.findall(r"(\d{2})\.\s+(.+?)\s+\|\s+(IMG_\d+\.jpe?g)", text)
    images = [z.read("word/" + rmap[r]) for r in order]
    return images, captions


def encode(raw: bytes):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    src = im.size
    long_edge = 1536 if im.width >= im.height else 1400
    im.thumbnail((long_edge, long_edge), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=74, method=6)  # no exif/icc passed → metadata stripped
    return buf.getvalue(), im.size, src, im


def ratio(w, h):
    r = w / h
    for name, v in (("16:9", 16 / 9), ("4:5", 4 / 5), ("9:16", 9 / 16), ("1:1", 1.0)):
        if abs(r - v) < 0.03:
            return name
    return f"{w}:{h}"


def main():
    docx, out_dir = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
    icon = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else None
    out_dir.mkdir(parents=True, exist_ok=True)
    images, captions = doc_images(docx)
    if len(images) != 22 or len(captions) != 22:
        sys.exit(f"expected 22 images/captions, got {len(images)}/{len(captions)}")

    assets = []
    og_src = None
    for raw, (num, title, fname) in zip(images, captions):
        data, (w, h), (sw, sh), im = encode(raw)
        use, alt = META[num]
        assets.append({
            "id": num, "title": title.strip(), "file": fname, "use": use, "alt": alt,
            "width": w, "height": h, "srcWidth": sw, "srcHeight": sh, "ratio": ratio(w, h),
            "format": "image/webp", "bytes": len(data),
            "data": base64.b64encode(data).decode("ascii"),
        })
        if num == "15":
            og_src = Image.open(io.BytesIO(raw)).convert("RGB")

    # Social preview image (1200x630) from the campaign hero, cropped from the left where the headline sits.
    tw = round(og_src.height * 1200 / 630)
    og = og_src.crop((0, 0, min(tw, og_src.width), og_src.height)).resize((1200, 630), Image.LANCZOS)
    og.save(out_dir / "og-image.jpg", "JPEG", quality=84, optimize=True, progressive=True)

    manifest = {
        "source": docx.name,
        "generated": dt.date.today().isoformat(),
        "note": "Generated concept visuals supplied as creative direction. Not official Vodacom Bulls photography or approved brand artwork.",
        "assets": assets,
    }
    manifest_json = json.dumps(manifest, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

    icon_b64 = base64.b64encode(icon.read_bytes()).decode("ascii") if icon and icon.exists() else ""
    head = (HERE / "head.html").read_text("utf8")
    css = (HERE / "styles.css").read_text("utf8")
    body = (HERE / "body.html").read_text("utf8")
    js = (HERE / "app.js").read_text("utf8")
    if not icon_b64:
        head = re.sub(r'\s*<link rel="apple-touch-icon"[^>]*>', "", head)
    page = (
        head.replace("__STYLES__", css).replace("__APPLE_TOUCH_ICON__", icon_b64)
        + "\n"
        + body.replace("__ASSET_MANIFEST__", manifest_json).replace("__APP_JS__", js)
    )
    out = out_dir / "Bulls_One_Loftus_Experience.html"
    out.write_text(page, "utf8")
    total = sum(a["bytes"] for a in assets)
    print(f"wrote {out} ({out.stat().st_size / 1048576:.2f} MB; images {total / 1048576:.2f} MB raw WebP)")
    print(f"wrote {out_dir / 'og-image.jpg'}")


if __name__ == "__main__":
    main()
