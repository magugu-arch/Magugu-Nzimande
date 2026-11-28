"""Build the Soweto Towers logo suite.

    python build.py <archivo-variable.woff2> <out-dir> <font-cache-dir>

Writes logo/svg/*.svg, icons/*.svg, index.html and a render job list
(png-jobs.json, in the cache dir) for the PNG/ICO step.
"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from mark import Mark
from geom import f
from wordmark import Text

SRC, OUT, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]

C = {"red": "#DA291C", "black": "#151412", "bone": "#F3EFE7", "white": "#FFFFFF"}
WAYS = {
    "colour":  {"tee": C["red"],   "tw": C["black"], "ink": C["black"]},
    "reverse": {"tee": C["red"],   "tw": C["bone"],  "ink": C["bone"]},
    "black":   {"tee": C["black"], "tw": C["black"], "ink": C["black"]},
    "white":   {"tee": C["white"], "tw": C["white"], "ink": C["white"]},
}

MAIN = Mark()
# Below ~48 px: no rim cut, no cord, a heavier bridge and a larger jumper.
SMALL = Mark(small=True, bridge=0.18, dot=0.36, dot_at=0.52, gap=1.36)

NAME = Text(SRC, CACHE, wght=500, wdth=118)
TRACK = 0.20


class Part:
    def __init__(self, name, layers, w, h):
        self.name, self.layers, self.w, self.h = name, layers, w, h


def text_part(name, s, cap, tracking=None, width=None):
    if width is not None:
        tracking = NAME.fit(s, cap, width, hi=1.5)
    d, adv, l, r = NAME.layout(s, cap, tracking)
    return Part(name, [("ink", d)], r - l, cap), (-l, cap), tracking


def place(part, x, y, shift=(0, 0), k=1.0):
    return {"part": part, "x": x, "y": y, "k": k, "shift": shift}


PARTS = {}


def reg(p):
    PARTS[p.name] = p
    return p


m = MAIN
reg(Part("mark", m.layers(), m.W, m.Ht))
reg(Part("mark-small", SMALL.layers(), SMALL.W, SMALL.Ht))

# ---- name -------------------------------------------------------------
cap = m.Ht * 0.16
pl, shl, trl = text_part("name", "SOWETO TOWERS", cap, tracking=TRACK)
reg(pl)
cap_d = cap * 0.5
pd, shd, trd = text_part("descriptor", "VERTICAL ADVENTURE CENTRE", cap_d, width=pl.w)
reg(pd)

# ---- stacked (primary) ----------------------------------------------
gap_y = m.Ht * 0.30
SW = max(pl.w, m.W)
STACKED = {
    "w": SW, "h": m.Ht + gap_y + cap,
    "items": [place(PARTS["mark"], (SW - m.W) / 2, 0),
              place(pl, (SW - pl.w) / 2, m.Ht + gap_y, shl)],
}
gap_d = cap * 1.15
STACKED_D = {
    "w": SW, "h": STACKED["h"] + gap_d + cap_d,
    "items": STACKED["items"] + [place(pd, (SW - pd.w) / 2, STACKED["h"] + gap_d, shd)],
}

# ---- horizontal ------------------------------------------------------
gap_x = m.B * 1.3
kh = 1.3                                  # the name is set larger beside the mark
HORIZONTAL = {
    "w": m.W + gap_x + pl.w * kh, "h": m.Ht,
    # the name sits on the optical centre of the towers (a touch below true centre)
    "items": [place(PARTS["mark"], 0, 0),
              place(pl, m.W + gap_x, (m.Ht - cap * kh) / 2 + m.Ht * 0.03, shl, kh)],
}

WORDMARK = {"w": pl.w, "h": cap, "items": [place(pl, 0, 0, shl)]}
MARK = {"w": m.W, "h": m.Ht, "items": [place(PARTS["mark"], 0, 0)]}
MARK_SMALL = {"w": SMALL.W, "h": SMALL.Ht, "items": [place(PARTS["mark-small"], 0, 0)]}

FORMS = {
    "stacked": STACKED,
    "stacked-descriptor": STACKED_D,
    "horizontal": HORIZONTAL,
    "mark": MARK,
    "wordmark": WORDMARK,
}


def body_paths(form, way):
    out = []
    for it in form["items"]:
        p = it["part"]
        sx, sy = it["shift"]
        k = it["k"]
        inner = "".join(f'<path fill="{way[r]}" d="{d}"/>' for r, d in p.layers)
        sc = f" scale({f(k)})" if k != 1 else ""
        out.append(f'<g transform="translate({f(it["x"] + sx * k)} {f(it["y"] + sy * k)}){sc}">{inner}</g>')
    return "".join(out)


def svg_file(form, way, title="Soweto Towers"):
    w, h = form["w"], form["h"]
    ov = 0.02 * h
    scale = 4
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 {f(-ov)} {f(w)} {f(h + 2 * ov)}" '
            f'width="{round(w * scale)}" height="{round((h + 2 * ov) * scale)}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body_paths(form, way)}</svg>\n')


svg_dir = f"{OUT}/logo/svg"
os.makedirs(svg_dir, exist_ok=True)
os.makedirs(f"{OUT}/icons", exist_ok=True)
# remove artwork left over from earlier versions of the suite
ALL = list(FORMS.items()) + [("mark-small", MARK_SMALL)]
keep = {f"soweto-towers-{fn}-{wn}" for fn, _ in ALL for wn in WAYS}
for d in (svg_dir, f"{OUT}/logo/png"):
    if os.path.isdir(d):
        for fn in os.listdir(d):
            if os.path.splitext(fn)[0] not in keep:
                os.remove(os.path.join(d, fn))

files = []
for fname, form in ALL:
    for wname, way in WAYS.items():
        path = f"{svg_dir}/soweto-towers-{fname}-{wname}.svg"
        open(path, "w").write(svg_file(form, way))
        files.append((fname, path))


def tile(form, way, bg, size=1024, fill=0.62):
    k = size * fill / form["w"]
    ox = (size - form["w"] * k) / 2
    oy = (size - form["h"] * k) / 2
    items = [dict(it, x=ox / k + it["x"], y=oy / k + it["y"]) for it in form["items"]]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">'
            f'<title>Soweto Towers</title><rect width="{size}" height="{size}" fill="{bg}"/>'
            f'<g transform="scale({f(k)})">{body_paths({"items": items}, way)}</g></svg>\n')


ICON_WAY = {"tee": C["red"], "tw": C["bone"], "ink": C["bone"]}
ic = f"{OUT}/icons"
open(f"{ic}/app-icon.svg", "w").write(tile(MARK, ICON_WAY, C["black"], fill=0.64))
open(f"{ic}/app-icon-maskable.svg", "w").write(tile(MARK, ICON_WAY, C["black"], fill=0.54))
open(f"{ic}/app-icon-small.svg", "w").write(tile(MARK_SMALL, ICON_WAY, C["black"], fill=0.80))

# adaptive SVG favicon: dark towers on light tabs, bone towers on dark tabs
pad = 8
side = SMALL.W + 2 * pad
fav = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad} {f(-(side - SMALL.Ht) / 2)} {f(side)} {f(side)}">'
       f'<title>Soweto Towers</title>'
       f'<style>.t{{fill:{C["black"]}}}@media (prefers-color-scheme:dark){{.t{{fill:{C["bone"]}}}}}</style>']
for r, d in SMALL.layers():
    fav.append(f'<path fill="{C["red"]}" d="{d}"/>' if r == "tee" else f'<path class="t" d="{d}"/>')
fav.append("</svg>\n")
open(f"{ic}/favicon.svg", "w").write("".join(fav))

jobs = []
for fname, path in files:
    width = {"mark": 1024, "mark-small": 256}.get(fname, 2400)
    jobs.append({"svg": path, "png": path.replace("/svg/", "/png/").replace(".svg", ".png"), "width": width})
jobs += [
    {"svg": f"{ic}/app-icon.svg", "png": f"{ic}/app-icon-1024.png", "width": 1024},
    {"svg": f"{ic}/app-icon.svg", "png": f"{ic}/icon-512.png", "width": 512},
    {"svg": f"{ic}/app-icon.svg", "png": f"{ic}/icon-192.png", "width": 192},
    {"svg": f"{ic}/app-icon.svg", "png": f"{ic}/apple-touch-icon.png", "width": 180},
    {"svg": f"{ic}/app-icon-maskable.svg", "png": f"{ic}/icon-maskable-512.png", "width": 512},
    {"svg": f"{ic}/app-icon-small.svg", "png": f"{ic}/favicon-48.png", "width": 48},
    {"svg": f"{ic}/app-icon-small.svg", "png": f"{ic}/favicon-32.png", "width": 32},
    {"svg": f"{ic}/app-icon-small.svg", "png": f"{ic}/favicon-16.png", "width": 16},
]
os.makedirs(CACHE, exist_ok=True)
json.dump(jobs, open(f"{CACHE}/png-jobs.json", "w"), indent=1)

meta = {"tracking": {"name": trl, "descriptor": trd},
        "forms": {k: {"w": v["w"], "h": v["h"]} for k, v in FORMS.items()}}

import page
open(f"{OUT}/index.html", "w").write(page.render(
    parts=PARTS, forms=FORMS, main=MAIN, small=SMALL, colours=C, meta=meta, font_path=SRC,
    files=sorted(os.path.relpath(os.path.join(dp, fn), OUT)
                 for dp, _, fns in os.walk(OUT) for fn in fns
                 if fn.endswith((".svg", ".png", ".ico")) and "/source/" not in os.path.join(dp, fn))))
print("tracking", json.dumps(meta["tracking"]))
