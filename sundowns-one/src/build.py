"""Build Sundowns One: one self-contained HTML file, or an installable site.

Usage:
    python3 -I build.py <out_dir> [--site-url https://host/path/] [--app-url https://link]
        [--pwa] [--out-name index.html]

Reads styles.css, app.js, head.html, body.html, icons.json, assets.json,
panels.json and the prepared images in img/ and brand/ (run
prepare_images.py first). Without --pwa every image is embedded once as a CSS
data URI, so the single file works offline and with JavaScript off. With
--pwa the images stay as files in img/ beside index.html (loaded only when a
screen shows them), plus a web app manifest, an offline service worker and
home-screen icons.

Run prerender.js on the output afterwards so the page reads fully when
JavaScript is off (iPhone Files, WhatsApp document previews).
"""
import argparse
import base64
import datetime as dt
import json
import pathlib
import re
import shutil
import sys

HERE = pathlib.Path(__file__).resolve().parent


def b64(path):
    return base64.b64encode(path.read_bytes()).decode("ascii")


def svg(body):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + "</svg>")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("--site-url", default="https://example.com/sundowns-one/")
    ap.add_argument("--app-url", default="")
    ap.add_argument("--pwa", action="store_true", help="hosted site build: images as files, manifest, service worker and icons")
    ap.add_argument("--out-name", default="Sundowns_One_Fan_App.html")
    a = ap.parse_args()
    out = pathlib.Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    site_url = a.site_url if a.site_url.endswith("/") else a.site_url + "/"

    assets = json.loads((HERE / "assets.json").read_text("utf8"))
    panels = json.loads((HERE / "panels.json").read_text("utf8"))
    icons = json.loads((HERE / "icons.json").read_text("utf8"))

    css = []
    total = 0
    for item in assets["assets"]:
        aid = item["id"]
        if aid == "7674":
            continue
        img = HERE / "img" / f"{aid}.webp"
        total += img.stat().st_size
        url = f"img/{aid}.webp" if a.pwa else f"data:image/webp;base64,{b64(img)}"
        css.append(f".a{aid}{{background-image:url({url})}}")
    # Each storyboard step shows one panel of its image, caption bar excluded.
    for aid, p in panels.items():
        iw, ih = p["size"]
        for i, (l, t, w, h) in enumerate(p["panels"]):
            sx, sy = iw / w * 100, ih / h * 100
            px = 0 if iw == w else l / (iw - w) * 100
            py = 0 if ih == h else t / (ih - h) * 100
            css.append(f".p{aid}-{i}{{background-size:{sx:.3f}% {sy:.3f}%;background-position:{px:.3f}% {py:.3f}%}}")
    css.append(f".crest{{background-image:url(data:image/webp;base64,{b64(HERE / 'brand' / 'crest.webp')})}}")

    public = {
        "note": assets["note"],
        "statuses": assets["statuses"],
        "assets": [{k: v for k, v in x.items() if k != "crop"} for x in assets["assets"]],
    }
    asset_json = json.dumps(public, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    panel_json = json.dumps({k: {"panels": v["panels"]} for k, v in panels.items()}, separators=(",", ":"))

    js = (HERE / "app.js").read_text("utf8")
    js = (js.replace("'__APP_URL__'", json.dumps(a.app_url))
            .replace("'__PWA__'", "'on'" if a.pwa else "'off'")
            .replace("__BUILD_DATE__", dt.date.today().strftime("%-d %B %Y")))

    head = (HERE / "head.html").read_text("utf8")
    body = (HERE / "body.html").read_text("utf8")
    page = (head.replace("__STYLES__", (HERE / "styles.css").read_text("utf8"))
                .replace("__ASSET_CSS__", "\n".join(css))
                .replace("__FAVICON__", b64(HERE / "brand" / "favicon.png"))
                .replace("__APPLE_TOUCH_ICON__", b64(HERE / "brand" / "apple-touch-icon.png"))
                .replace("__PWA_LINKS__", '<link rel="manifest" href="manifest.webmanifest">' if a.pwa else "")
                .replace("__SITE_URL__", site_url)
            + "\n"
            + body.replace("__ASSET_DATA__", asset_json)
                  .replace("__ICON_DATA__", json.dumps(icons, separators=(",", ":")).replace("</", "<\\/"))
                  .replace("__PANEL_DATA__", panel_json))
    page = re.sub(r"\{\{icon:(\w+)\}\}", lambda m: svg(icons[m.group(1)]), page)
    page = page.replace("__APP_JS__", js)  # last, so nothing inside the script is rewritten

    left = sorted(set(re.findall(r"__[A-Z_]{3,}__", page)))
    if left or "{{icon:" in page:
        sys.exit(f"unfilled placeholders: {left}")
    dest = out / a.out_name
    dest.write_text(page, "utf8")
    shutil.copyfile(HERE / "brand" / "og-image.jpg", out / "og-image.jpg")
    print(f"wrote {dest} ({dest.stat().st_size / 1048576:.2f} MB; images {total / 1048576:.2f} MB WebP)")
    if a.pwa:
        (out / "img").mkdir(exist_ok=True)
        for item in assets["assets"]:
            if item["id"] != "7674":
                shutil.copyfile(HERE / "img" / f"{item['id']}.webp", out / "img" / f"{item['id']}.webp")
        for f in ("manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"):
            shutil.copyfile(HERE / "pwa" / f, out / f)
        print(f"wrote images, manifest, service worker and icons to {out}")


if __name__ == "__main__":
    main()
