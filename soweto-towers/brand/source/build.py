"""Build the Soweto Towers logo suite.

    python build.py <archivo-variable.woff2> <out-dir> <font-cache-dir>

Writes logo/svg/*.svg, icons/*.svg and a render job list (png-jobs.json)
for the PNG/ICO step.
"""
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from mark import Mark
from geom import f
from wordmark import Text

SRC, OUT, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]

C = {
    "red": "#DA291C",
    "black": "#151412",
    "bone": "#F3EFE7",
    "white": "#FFFFFF",
}
WAYS = {
    "colour":  {"tee": C["red"],   "tw": C["black"], "ink": C["black"]},
    "reverse": {"tee": C["red"],   "tw": C["bone"],  "ink": C["bone"]},
    "black":   {"tee": C["black"], "tw": C["black"], "ink": C["black"]},
    "white":   {"tee": C["white"], "tw": C["white"], "ink": C["white"]},
}

MAIN = Mark()                                                    # master
SMALL = Mark(B=26, a=17.4, throat=0.70, c=17, s=6.5, H_total=126)  # <= 32 px

disp = Text(SRC, CACHE, wght=600, wdth=125)
desc = Text(SRC, CACHE, wght=500, wdth=125)


# ---------------------------------------------------------------- parts
class Part:
    """A drawable in local coordinates, ink box from (0,0) to (w,h)."""

    def __init__(self, name, layers, w, h):
        self.name, self.layers, self.w, self.h = name, layers, w, h  # layers: [(role, d)]


def mark_part(m, name):
    p = m.paths()
    return Part(name, [("tee", p["tee"]), ("tw", p["left"]), ("tw", p["right"])], m.W, m.Ht)


def text_part(name, txt, s, cap, tracking=None, width=None):
    if width is not None:
        tracking = txt.fit(s, cap, width)
    d, adv, l, r = txt.layout(s, cap, tracking)
    # shift so ink starts at x=0 and cap top is y=0
    return Part(name, [("ink", d)], r - l, cap), (-l, cap), tracking


def place(part, x, y, k=1.0, shift=(0, 0)):
    return {"part": part, "x": x, "y": y, "k": k, "shift": shift}


PARTS = {}


def reg(p):
    PARTS[p.name] = p
    return p


reg(mark_part(MAIN, "mark"))
reg(mark_part(SMALL, "mark-small"))

# ---- horizontal: two justified lines spanning the tower height --------
m = MAIN
span = m.Ht - (m.c + m.s)
cap_h = span / 2.5                       # 2 caps + a half-cap leading
p1, sh1, tr1 = text_part("soweto", disp, "SOWETO", cap_h, tracking=0.06)
p2, sh2, tr2 = text_part("towers", disp, "TOWERS", cap_h, width=p1.w)
reg(p1); reg(p2)
gap_x = 0.30 * m.W
y_top = m.c + m.s
HORIZONTAL = {
    "w": m.W + gap_x + p1.w, "h": m.Ht,
    "items": [place(PARTS["mark"], 0, 0),
              place(p1, m.W + gap_x, y_top, shift=sh1),
              place(p2, m.W + gap_x, m.Ht - cap_h, shift=sh2)],
}

# ---- single line wordmark ---------------------------------------------
cap_l = m.Ht * 0.17
pl, shl, trl = text_part("line", disp, "SOWETO TOWERS", cap_l, tracking=0.06)
reg(pl)
WORDMARK = {"w": pl.w, "h": cap_l, "items": [place(pl, 0, 0, shift=shl)]}

# ---- stacked ------------------------------------------------------------
gap_y = cap_l * 1.2
SW = max(pl.w, m.W)
STACKED = {
    "w": SW, "h": m.Ht + gap_y + cap_l,
    "items": [place(PARTS["mark"], (SW - m.W) / 2, 0),
              place(pl, (SW - pl.w) / 2, m.Ht + gap_y, shift=shl)],
}

# ---- stacked + descriptor ----------------------------------------------
cap_d = cap_l * 0.46
pd, shd, trd = text_part("descriptor", desc, "VERTICAL ADVENTURE CENTRE", cap_d, width=pl.w)
reg(pd)
gap_d = cap_l * 0.85
STACKED_D = {
    "w": SW, "h": STACKED["h"] + gap_d + cap_d,
    "items": STACKED["items"] + [place(pd, (SW - pd.w) / 2, STACKED["h"] + gap_d, shift=shd)],
}

MARK = {"w": m.W, "h": m.Ht, "items": [place(PARTS["mark"], 0, 0)]}
MARK_SMALL = {"w": SMALL.W, "h": SMALL.Ht, "items": [place(PARTS["mark-small"], 0, 0)]}

FORMS = {
    "horizontal": HORIZONTAL,
    "stacked": STACKED,
    "stacked-descriptor": STACKED_D,
    "mark": MARK,
    "wordmark": WORDMARK,
}


# ---------------------------------------------------------------- emitters
def body_paths(form, way, ox=0, oy=0):
    out = []
    for it in form["items"]:
        p = it["part"]
        sx, sy = it["shift"]
        tr = f'translate({f(ox + it["x"] + sx * it["k"])} {f(oy + it["y"] + sy * it["k"])})'
        if it["k"] != 1:
            tr += f' scale({f(it["k"])})'
        inner = "".join(f'<path fill="{way[r]}" d="{d}"/>' for r, d in p.layers)
        out.append(f'<g transform="{tr}">{inner}</g>')
    return "".join(out)


def svg_file(form, way, title="Soweto Towers", bg=None, pad=0.0):
    w, h = form["w"] + 2 * pad, form["h"] + 2 * pad
    scale = 4
    bgr = f'<rect width="100%" height="100%" fill="{bg}"/>' if bg else ""
    # overshoot: round letters dip ~1.5% below the baseline; allow for it
    ov = 0.02 * form["h"]
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(-pad)} {f(-pad - ov)} {f(w)} {f(h + 2 * ov)}" '
            f'width="{round(w * scale)}" height="{round((h + 2 * ov) * scale)}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{bgr}{body_paths(form, way)}</svg>\n')


os.makedirs(f"{OUT}/logo/svg", exist_ok=True)
os.makedirs(f"{OUT}/icons", exist_ok=True)
files = []
for fname, form in FORMS.items():
    for wname, way in WAYS.items():
        path = f"{OUT}/logo/svg/soweto-towers-{fname}-{wname}.svg"
        open(path, "w").write(svg_file(form, way))
        files.append((fname, wname, path))

for wname in ("colour", "reverse", "black", "white"):
    open(f"{OUT}/logo/svg/soweto-towers-mark-small-{wname}.svg", "w").write(svg_file(MARK_SMALL, WAYS[wname]))


# ---- app icon / favicon ---------------------------------------------------
def tile(form, way, bg, size=1024, fill=0.56, radius=0):
    k = size * fill / form["h"]
    ox = (size - form["w"] * k) / 2
    oy = (size - form["h"] * k) / 2
    items = []
    for it in form["items"]:
        items.append(dict(it, x=ox / k + it["x"], y=oy / k + it["y"]))
    inner = body_paths({"items": items}, way)
    rr = f' rx="{radius}"' if radius else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">'
            f'<title>Soweto Towers</title><rect width="{size}" height="{size}"{rr} fill="{bg}"/>'
            f'<g transform="scale({f(k)})">{inner}</g></svg>\n')


ICON_WAY = {"tee": C["red"], "tw": C["bone"], "ink": C["bone"]}
open(f"{OUT}/icons/app-icon.svg", "w").write(tile(MARK, ICON_WAY, C["black"], fill=0.56))
open(f"{OUT}/icons/app-icon-maskable.svg", "w").write(tile(MARK, ICON_WAY, C["black"], fill=0.46))
open(f"{OUT}/icons/app-icon-small.svg", "w").write(tile(MARK_SMALL, ICON_WAY, C["black"], fill=0.70))

# adaptive SVG favicon: dark towers on light tabs, bone towers on dark tabs
sm = SMALL.paths()
pad = 6
fav = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-pad - (SMALL.Ht - SMALL.W) / 2:.2f} {-pad} '
       f'{SMALL.Ht + 2 * pad} {SMALL.Ht + 2 * pad}"><title>Soweto Towers</title>'
       f'<style>.t{{fill:{C["black"]}}}@media (prefers-color-scheme:dark){{.t{{fill:{C["bone"]}}}}}</style>'
       f'<path fill="{C["red"]}" d="{sm["tee"]}"/><path class="t" d="{sm["left"]}"/><path class="t" d="{sm["right"]}"/></svg>\n')
open(f"{OUT}/icons/favicon.svg", "w").write(fav)

# ---- render jobs ---------------------------------------------------------
jobs = []
for fname, wname, path in files:
    width = 1024 if fname == "mark" else 2400
    jobs.append({"svg": path, "png": path.replace("/svg/", "/png/").replace(".svg", ".png"), "width": width})
for wname in ("colour", "reverse", "black", "white"):
    p = f"{OUT}/logo/svg/soweto-towers-mark-small-{wname}.svg"
    jobs.append({"svg": p, "png": p.replace("/svg/", "/png/").replace(".svg", ".png"), "width": 256})
ic = f"{OUT}/icons"
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
json.dump(jobs, open(f"{CACHE}/png-jobs.json", "w"), indent=1)

# ---- data for the guidelines page --------------------------------------
meta = {
    "colours": C,
    "main": {k: getattr(MAIN, k) for k in ("B", "a", "c", "s", "W", "Ht", "th", "throat")},
    "small": {k: getattr(SMALL, k) for k in ("B", "a", "c", "s", "W", "Ht")},
    "tracking": {"soweto": tr1, "towers": tr2, "line": trl, "descriptor": trd},
    "forms": {k: {"w": v["w"], "h": v["h"]} for k, v in FORMS.items()},
}
json.dump(meta, open(f"{CACHE}/meta.json", "w"), indent=1)

import page
open(f"{OUT}/index.html", "w").write(page.render(
    parts=PARTS, forms=FORMS, main=MAIN, small=SMALL, colours=C, meta=meta, font_path=SRC,
    files=sorted(os.path.relpath(os.path.join(dp, fn), OUT)
                 for dp, _, fns in os.walk(OUT) for fn in fns
                 if fn.endswith((".svg", ".png", ".ico")))))
print("tracking", json.dumps(meta["tracking"]))
