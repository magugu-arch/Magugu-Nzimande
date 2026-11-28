"""Build the Soweto Towers corporate identity: artwork, icons, pictograms,
the Loop pattern and the brand book (HTML; print it to PDF with Chromium).

    python ci.py <archivo-variable.woff2> <out-dir> <font-cache-dir>
"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from geom import f
import vec
import kit
from kit import Art, tile, RED, BLACK, BONE, WHITE

SRC, OUT, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]
kit.init(SRC, CACHE)
import ci_assets as A

WAYS = {
    "colour":  {"ink": BLACK, "acc": RED},
    "reverse": {"ink": BONE, "acc": RED},
    "black":   {"ink": BLACK, "acc": BLACK},
    "white":   {"ink": WHITE, "acc": WHITE},
}

mono = A.monogram()
ASSETS = {
    "horizontal": A.lockup_horizontal(mono),
    "stacked": A.lockup_stacked(mono),
    "stacked-descriptor": A.lockup_stacked(mono, desc=True),
    "monogram": mono,
    "name": A.name_line(30.0),
    "loop": A.loop(),
    "loop-upright": A.loop(vertical=True),
}
PICTO = A.pictograms()


def pad_of(a):
    return a.h * 0.02


# ---------------------------------------------------------------- artwork
svg_dir, png_dir = f"{OUT}/logo/svg", f"{OUT}/logo/png"
for d in (svg_dir, png_dir, f"{OUT}/icons", f"{OUT}/pictograms", f"{OUT}/pattern"):
    os.makedirs(d, exist_ok=True)
keep = {f"soweto-towers-{n}-{w}" for n in ASSETS for w in WAYS}
for d in (svg_dir, png_dir):                      # clear artwork from earlier systems
    for fn in os.listdir(d):
        if os.path.splitext(fn)[0] not in keep:
            os.remove(os.path.join(d, fn))

jobs = []
for name, art in ASSETS.items():
    for wn, way in WAYS.items():
        p = f"{svg_dir}/soweto-towers-{name}-{wn}.svg"
        open(p, "w").write(art.svg(way, pad_of(art)) + "\n")
        width = {"monogram": 1024, "loop": 1600, "loop-upright": 800}.get(name, 2400)
        jobs.append({"svg": p, "png": p.replace("/svg/", "/png/").replace(".svg", ".png"), "width": width})

# ---------------------------------------------------------------- icons
ICON = {"ink": BONE, "acc": RED}
ic = f"{OUT}/icons"
open(f"{ic}/app-icon.svg", "w").write(tile(mono, ICON, BLACK, fill=0.56, by="h") + "\n")
open(f"{ic}/app-icon-maskable.svg", "w").write(tile(mono, ICON, BLACK, fill=0.46, by="h") + "\n")
fav_tile = tile(mono, ICON, BLACK, fill=0.66, by="h")
open(f"{ic}/app-icon-small.svg", "w").write(fav_tile + "\n")
# adaptive favicon: dark ink on light tabs, bone ink on dark tabs
x0, y0, x1, y1 = mono.bb
side = max(x1 - x0, y1 - y0) * 1.12
cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
fav = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(cx - side / 2)} {f(cy - side / 2)} {f(side)} {f(side)}">',
       f'<title>Soweto Towers</title><style>.i{{fill:{BLACK}}}@media (prefers-color-scheme:dark){{.i{{fill:{BONE}}}}}</style>']
for role, d, tr in mono.items:
    fav.append(f'<path class="i" d="{d}"/>' if role == "ink" else f'<path fill="{RED}" d="{d}"/>')
fav.append("</svg>\n")
open(f"{ic}/favicon.svg", "w").write("".join(fav))
for src, png, w in (("app-icon", "app-icon-1024", 1024), ("app-icon", "icon-512", 512), ("app-icon", "icon-192", 192),
                    ("app-icon", "apple-touch-icon", 180), ("app-icon-maskable", "icon-maskable-512", 512),
                    ("app-icon-small", "favicon-48", 48), ("app-icon-small", "favicon-32", 32), ("app-icon-small", "favicon-16", 16)):
    jobs.append({"svg": f"{ic}/{src}.svg", "png": f"{ic}/{png}.png", "width": w})

# ---------------------------------------------------------------- pictograms
for k, art in PICTO.items():
    slug = k.lower().replace(" ", "-")
    for wn in ("colour", "reverse"):
        open(f"{OUT}/pictograms/{slug}-{wn}.svg", "w").write(art.svg(WAYS[wn], 0, title=k) + "\n")


# ---------------------------------------------------------------- Loop pattern tile
def pattern_svg(ink, bg=None, cell=160.0, scale=0.86, standalone=True):
    """A seamless 2x2 tile: the Loop and the upright S, alternating."""
    lp, up = ASSETS["loop"], ASSETS["loop-upright"]
    out = []
    for (cx, cy, art) in ((cell / 2, cell / 2, lp), (cell * 1.5, cell / 2, up),
                          (cell / 2, cell * 1.5, up), (cell * 1.5, cell * 1.5, lp)):
        mx, my = (art.bb[0] + art.bb[2]) / 2, (art.bb[1] + art.bb[3]) / 2
        t = Art()
        t.place(art, cx - mx * scale, cy - my * scale, scale)
        out.append(t.body({"ink": ink, "acc": ink}))
    size = cell * 2
    bgr = f'<rect width="{f(size)}" height="{f(size)}" fill="{bg}"/>' if bg else ""
    ns = ' xmlns="http://www.w3.org/2000/svg"' if standalone else ""
    return f'<svg{ns} viewBox="0 0 {f(size)} {f(size)}" width="{f(size)}" height="{f(size)}">{bgr}{"".join(out)}</svg>'


open(f"{OUT}/pattern/loop-pattern-tile-black.svg", "w").write(pattern_svg(BLACK) + "\n")
open(f"{OUT}/pattern/loop-pattern-tile-bone.svg", "w").write(pattern_svg(BONE) + "\n")

os.makedirs(CACHE, exist_ok=True)
json.dump(jobs, open(f"{CACHE}/ci-jobs.json", "w"), indent=1)

# ---------------------------------------------------------------- brand book
import ci_book
files = sorted(os.path.relpath(os.path.join(dp, fn), OUT) for dp, _, fns in os.walk(OUT) for fn in fns
               if fn.endswith((".svg", ".png", ".ico", ".pdf")) and "/options/" not in os.path.join(dp, fn) + "/"
               and not os.path.relpath(dp, OUT).startswith(("options", "source")))
open(f"{OUT}/index.html", "w").write(ci_book.render(ASSETS, PICTO, pattern_svg, SRC, files))
print("identity built:", len(ASSETS), "lockups,", len(PICTO), "pictograms")
