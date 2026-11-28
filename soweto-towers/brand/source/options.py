"""Six logo options for Soweto Towers, drawn in code and presented on one page.

    python options.py <archivo-variable.woff2> <out-dir> <font-cache-dir>

Writes <out-dir>/option-N-*/ SVG files, <out-dir>/index.html, and a PNG
render list (png-jobs.json in the cache dir).
"""
import sys, os, math, json, base64
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from geom import Hyper, side, f
from mark import Mark
from wordmark import Text
import vec
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

SRC, OUT, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]
RED, BLACK, BONE, WHITE = "#DA291C", "#151412", "#F3EFE7", "#FFFFFF"
NAME = Text(SRC, CACHE, wght=500, wdth=118)
DESC = Text(SRC, CACHE, wght=500, wdth=118)
TRACK = 0.20


# =============================================================== art container
class Art:
    """Paths with a role ('ink' or 'acc') and a transform, plus a bounding box."""

    def __init__(self):
        self.items, self.bb = [], None

    def _grow(self, b):
        if self.bb is None:
            self.bb = list(b)
        else:
            self.bb = [min(self.bb[0], b[0]), min(self.bb[1], b[1]), max(self.bb[2], b[2]), max(self.bb[3], b[3])]

    def add(self, role, d, bb, tr=""):
        self.items.append((role, d, tr))
        self._grow(bb)
        return self

    def addp(self, role, p):
        """Add a pathops path."""
        return self.add(role, vec.svg(p), vec.bounds(p))

    def place(self, other, dx=0.0, dy=0.0, k=1.0):
        T = f"translate({f(dx)} {f(dy)})" + (f" scale({f(k)})" if k != 1 else "")
        for role, d, tr in other.items:
            self.items.append((role, d, (T + " " + tr).strip()))
        x0, y0, x1, y1 = other.bb
        self._grow((dx + k * x0, dy + k * y0, dx + k * x1, dy + k * y1))
        return self

    @property
    def w(self):
        return self.bb[2] - self.bb[0]

    @property
    def h(self):
        return self.bb[3] - self.bb[1]

    def body(self, way):
        out = []
        for role, d, tr in self.items:
            t = f' transform="{tr}"' if tr else ""
            out.append(f'<path fill="{way[role]}"{t} d="{d}"/>')
        return "".join(out)

    def svg(self, way, pad=0.0, title="Soweto Towers", attrs=""):
        x0, y0, x1, y1 = self.bb
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{f(x0 - pad)} {f(y0 - pad)} {f(x1 - x0 + 2 * pad)} {f(y1 - y0 + 2 * pad)}" '
                f'{attrs}role="img" aria-label="{title}"><title>{title}</title>{self.body(way)}</svg>')


def tile(art, way, bg, size=1024, fill=0.62, by="w", radius=0):
    k = size * fill / (art.w if by == "w" else art.h)
    dx = (size - art.w * k) / 2 - art.bb[0] * k
    dy = (size - art.h * k) / 2 - art.bb[1] * k
    t = Art()
    t.place(art, dx, dy, k)
    rr = f' rx="{radius}"' if radius else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" role="img" aria-label="Soweto Towers app icon">'
            f'<title>Soweto Towers</title><rect width="{size}" height="{size}"{rr} fill="{bg}"/>{t.body(way)}</svg>')


# =============================================================== type helpers
def shaped(txt, s):
    buf = hb.Buffer()
    buf.add_str(s)
    buf.guess_segment_properties()
    hb.shape(txt.hb, buf, {"kern": True, "liga": False})
    names = txt.font.getGlyphOrder()
    return [(names[i.codepoint], p.x_advance) for i, p in zip(buf.glyph_infos, buf.glyph_positions)]


def glyph_d(txt, name, k, x=0.0):
    pen = SVGPathPen(txt.gs, ntos=vec._n)
    txt.gs[name].draw(TransformPen(pen, (k, 0, 0, -k, x, 0)))
    return pen.getCommands()


def line_art(s, cap, track=TRACK, txt=NAME, width=None, tower_t=None):
    """One line of capitals; cap top at y=0, baseline at y=cap, ink from x=0.
    tower_t: callable(k) -> list of (d) replacing the glyph 'T'."""
    if width is not None:
        lo, hi = -0.05, 1.5
        for _ in range(50):
            mid = (lo + hi) / 2
            a = line_art(s, cap, mid, txt, None, tower_t)
            lo, hi = (mid, hi) if a.w < width else (lo, mid)
        track = (lo + hi) / 2
    k = cap / txt.cap
    x = 0.0
    raw = Art()
    gl = shaped(txt, s)
    for i, (nm, adv) in enumerate(gl):
        if nm == "T" and tower_t:
            for d in tower_t(k, x):
                raw.addp("ink", vec.fill(d))
        elif nm != "space":
            p = vec.fill(glyph_d(txt, nm, k, x))
            raw.addp("ink", p)
        x += adv * k + (track * cap / (txt.cap / txt.upm) if i < len(gl) - 1 else 0)
    out = Art()
    out.place(raw, -raw.bb[0], cap)
    out.bb = [0, 0, raw.bb[2] - raw.bb[0], cap]          # optical box: cap height
    out.track = track
    return out


def hyper_d(hyp, cx, by, h0=0.0, h1=None):
    h1 = hyp.H if h1 is None else h1
    return (f"M{f(cx - hyp.w(h0))} {f(by - h0)} " + " ".join(side(hyp, cx, by, h0, h1, -1)) +
            f" L{f(cx + hyp.w(h1))} {f(by - h1)} " + " ".join(side(hyp, cx, by, h1, h0, +1)) + " Z")


def stacked(sym, name, gap_k=0.30, desc=None):
    """Symbol centred over the name (and optional descriptor)."""
    W = max(sym.w, name.w)
    a = Art()
    a.place(sym, (W - sym.w) / 2 - sym.bb[0], -sym.bb[1])
    y = sym.h + sym.h * gap_k
    a.place(name, (W - name.w) / 2, y)
    if desc is not None:
        y2 = y + name.h * 2.15
        a.place(desc, (W - desc.w) / 2, y2)
    a.bb = [0, 0, W, (y2 + desc.h) if desc is not None else (y + name.h)]
    return a


# =============================================================== 1. The Jump
def opt_jump():
    m = Mark()
    sym = Art()
    for role, d in m.layers():
        sym.add("ink" if role == "tw" else "acc", d, (0, 0, m.W, m.Ht))
    sym.bb = [0, 0, m.W, m.Ht]
    sm = Mark(small=True, bridge=0.18, dot=0.36, dot_at=0.52, gap=1.36)
    small = Art()
    for role, d in sm.layers():
        small.add("ink" if role == "tw" else "acc", d, (0, 0, sm.W, sm.Ht))
    small.bb = [0, 0, sm.W, sm.Ht]
    name = line_art("SOWETO TOWERS", m.Ht * 0.16)
    return sym, small, stacked(sym, name)


# =============================================================== 2. ST monogram
def opt_st(Rt=20.0, Rb=22.5, w=11.0, gap=7.0, short=14.0, cut=0.5):
    top, base = -2 * Rt, 2 * Rb
    xs = Rb + w + gap
    bar_end = 2 * xs
    s_d = (f"M{f(bar_end)} {f(top)} L0 {f(top)} " + vec.arc_cubic(0, -Rt, Rt, -90, -270) + " " +
           vec.arc_cubic(0, Rb, Rb, -90, 150))
    s_p = vec.outline(s_d, w)
    stem_top = top + w / 2 + cut * w + w / 2       # the drop hangs just below the bridge
    stem_p = vec.outline(f"M{f(xs)} {f(stem_top)} L{f(xs)} {f(base - short)}", w)
    sym = Art()
    sym.addp("ink", s_p)
    sym.addp("acc", stem_p)
    # the S and the bar are one stroke; the red stem is the drop
    name_cap = sym.h * 0.17
    n1 = line_art("SOWETO", name_cap)
    n2 = line_art("TOWERS", name_cap, width=n1.w)
    lock = Art()
    lock.place(sym, -sym.bb[0], -sym.bb[1])
    gx = sym.w + sym.h * 0.26
    block_h = name_cap * 2 + name_cap * 0.75
    y0 = (sym.h - block_h) / 2
    lock.place(n1, gx, y0)
    lock.place(n2, gx, y0 + name_cap * 1.75)
    lock.bb = [0, 0, gx + n1.w, sym.h]
    return sym, sym, lock


# =============================================================== 3. Two T's
TT = {"bar": (26, 721, 578, 687), "cx": 373, "stem": 124}


def tower_t_paths(cut=True, flare=2.6, throat=0.9):
    """The Archivo T, with its stem redrawn as a cooling tower."""
    x0, x1, lo, cap = TT["bar"]
    sh = lo - (24 if cut else 0)
    half = TT["stem"] / 2

    def make(k, x):
        bar = f"M{f(x + x0 * k)} {f(-cap * k)} H{f(x + x1 * k)} V{f(-lo * k)} H{f(x + x0 * k)} Z"
        hy = Hyper(H=sh * k, base=half * flare * k, throat=half * throat * k, throat_h=sh * 0.72 * k)
        return [bar, hyper_d(hy, x + TT["cx"] * k, 0)]
    return make


def opt_twot():
    make = tower_t_paths()
    cap = 30.0
    logo = line_art("SOWETO TOWERS", cap, track=0.16, tower_t=make)
    # icon: the pair of tower-T's, set as in the name: twin towers under a split bridge
    t = Art()
    for x in (0, 747 + 0.16 * 1000):
        for d in make(1.0, x):
            t.addp("ink", vec.fill(d))
    return t, t, logo


# =============================================================== 4. The Arch
def opt_arch(Rr=64.0, w=7.0, open_deg=40.0):
    chord = Rr * math.sin(math.radians(open_deg))
    by = Rr * math.cos(math.radians(open_deg)) + w / 2
    gap = 18.0
    B = (2 * chord - gap) / 4
    H = 2 * B * 1.5
    hyp = Hyper(H=H, base=B, throat=B * 0.62, throat_h=H * 0.76)
    L, R = -gap / 2 - B, gap / 2 + B
    ring = vec.outline(f"M{f(vec.pt(0, 0, Rr, 90 + open_deg)[0])} {f(vec.pt(0, 0, Rr, 90 + open_deg)[1])} " +
                       vec.arc_cubic(0, 0, Rr, 90 + open_deg, 450 - open_deg), w, cap="butt")
    sym = Art()
    sym.addp("acc", ring)
    top = by - H
    br = B * 0.095
    sym.addp("ink", vec.fill(hyper_d(hyp, L, by)))
    sym.addp("ink", vec.fill(hyper_d(hyp, R, by)))
    sym.addp("ink", vec.fill(f"M{f(L + hyp.w(H) - .2)} {f(top)} H{f(R - hyp.w(H) + .2)} V{f(top + br)} H{f(L + hyp.w(H) - .2)} Z"))
    cw, r = B * 0.06, B * 0.22
    cy = top + H * 0.5
    jump = vec.union(vec.fill(f"M{f(-cw / 2)} {f(top + br - .1)} H{f(cw / 2)} V{f(cy)} H{f(-cw / 2)} Z"),
                     vec.fill(f"M{f(r)} {f(cy)} " + vec.arc_cubic(0, cy, r, 0, 360) + " Z"))
    sym.addp("acc", jump)
    name = line_art("SOWETO TOWERS", sym.h * 0.115)
    return sym, sym, stacked(sym, name, gap_k=0.22)


# =============================================================== 5. The Seal
def on_arc(txt, s, R, cap, track=None, bottom=False, span_deg=None):
    """Text on a circle. With span_deg, the tracking is solved so the text
    covers exactly that angle."""
    if span_deg is not None:
        lo, hi = -0.05, 2.0
        for _ in range(50):
            mid = (lo + hi) / 2
            if on_arc(txt, s, R, cap, mid, bottom).span < span_deg:
                lo = mid
            else:
                hi = mid
        track = (lo + hi) / 2
    gl = shaped(txt, s)
    k = cap / txt.cap
    tr_px = track * cap / (txt.cap / txt.upm)
    advs = [a * k for _, a in gl]
    total = sum(advs) + tr_px * (len(gl) - 1)
    span = total / R
    a = Art()
    acc = 0.0
    for (nm, _), adv in zip(gl, advs):
        mid = acc + adv / 2
        ang = mid / R - span / 2
        if nm != "space":
            d = glyph_d(txt, nm, k)
            if not bottom:
                px, py = R * math.sin(ang), -R * math.cos(ang)
                tr = f"translate({f(px)} {f(py)}) rotate({f(math.degrees(ang))}) translate({f(-adv / 2)} 0)"
            else:
                px, py = R * math.sin(ang), R * math.cos(ang)
                tr = f"translate({f(px)} {f(py)}) rotate({f(-math.degrees(ang))}) translate({f(-adv / 2)} 0)"
            a.add("ink", d, (-R, -R, R, R), tr)
        acc += adv + tr_px
    a.span = math.degrees(span)
    return a


def opt_seal():
    R_out, R_in, band = 74.0, 47.0, 60.5
    a = Art()
    a.addp("ink", vec.ring(0, 0, R_out, 3.0))
    a.addp("ink", vec.ring(0, 0, R_in, 1.1))
    cap_t, cap_b = 7.2, 4.3
    a.place(on_arc(NAME, "SOWETO TOWERS", band - cap_t / 2, cap_t, span_deg=128))
    a.place(on_arc(DESC, "VERTICAL ADVENTURE CENTRE", band + cap_b / 2, cap_b, span_deg=118, bottom=True))
    for sx in (-1, 1):
        cx = sx * band
        a.addp("acc", vec.fill(f"M{f(cx + 1.7)} 0 " + vec.arc_cubic(cx, 0, 1.7, 0, 360) + " Z"))
    # towers in the centre
    m = Mark(B=12.0)
    inner = Art()
    for role, d in m.layers():
        inner.add("ink" if role == "tw" else "acc", d, (0, 0, m.W, m.Ht))
    inner.bb = [0, 0, m.W, m.Ht]
    a.place(inner, -m.W / 2, -m.Ht / 2 - 2)
    a.bb = [-R_out - 1.5, -R_out - 1.5, R_out + 1.5, R_out + 1.5]
    # icon: the centre emblem inside the inner ring
    icon = Art()
    icon.addp("ink", vec.ring(0, 0, R_in, 3.2))
    icon.place(inner, -m.W / 2, -m.Ht / 2 - 2)
    icon.bb = [-R_in - 1.6, -R_in - 1.6, R_in + 1.6, R_in + 1.6]
    return icon, icon, a


# =============================================================== 6. Skyline
def skyline_path(B=21.0, gap=20.0, ratio=1.5, lead=44.0):
    H = 2 * B * ratio
    hyp = Hyper(H=H, base=B, throat=B * 0.62, throat_h=H * 0.76)
    L, R = -gap / 2 - B, gap / 2 + B
    d = [f"M{f(L - B - lead)} 0 L{f(L - B)} 0"]
    d += side(hyp, L, 0, 0, H, -1)
    d.append(f"L{f(L + hyp.w(H))} {f(-H)}")
    d += side(hyp, L, 0, H, 0, +1)
    d.append(f"L{f(R - B)} 0")
    d += side(hyp, R, 0, 0, H, -1)
    d.append(f"L{f(R + hyp.w(H))} {f(-H)}")
    d += side(hyp, R, 0, H, 0, +1)
    d.append(f"L{f(R + B + lead)} 0")
    return " ".join(d), H


def jump_art(top, H, w):
    cw, r = w * 0.42, w * 0.95
    cy = -H * 0.5
    return vec.union(vec.fill(f"M{f(-cw / 2)} {f(top)} H{f(cw / 2)} V{f(cy)} H{f(-cw / 2)} Z"),
                     vec.fill(f"M{f(r)} {f(cy)} " + vec.arc_cubic(0, cy, r, 0, 360) + " Z"))


def opt_skyline(w=6.0):
    name = line_art("SOWETO TOWERS", 12.0)
    B, gap = 21.0, 20.0
    towers_w = 4 * B + gap
    lead = (name.w - towers_w - w) / 2          # the horizon runs exactly the width of the name
    d, H = skyline_path(B, gap, lead=lead)
    sym = Art()
    sym.addp("ink", vec.outline(d, w))
    sym.addp("acc", jump_art(-H + w / 2 - 0.5, H, w))
    lock = stacked(sym, name, gap_k=0.30)
    # compact symbol for icons: short horizon
    d2, _ = skyline_path(B, gap, lead=14.0)
    icon = Art()
    icon.addp("ink", vec.outline(d2, w * 1.15))
    icon.addp("acc", jump_art(-H + w * 1.15 / 2 - 0.5, H, w * 1.15))
    return icon, icon, lock


# =============================================================== build
OPTIONS = [
    {"n": 1, "slug": "the-jump", "title": "The Jump", "fn": opt_jump,
     "line": "Two towers, one bridge, one jump.",
     "idea": "The Orlando towers drawn exactly as they stand, joined by the bridge across their rims. The only colour is the cord and the jumper: the moment the place is known for.",
     "best": "Instantly recognisable, says what happens here, and holds up in one colour.",
     "watch": "The most literal of the six. Below 48 px it needs its small-size version, which drops the cord.",
     "icon_bg": BLACK, "icon_way": {"ink": BONE, "acc": RED}, "icon_fill": 0.64},
    {"n": 2, "slug": "st-monogram", "title": "S + T monogram", "fn": opt_st,
     "line": "Soweto, bridged to Towers.",
     "idea": "An S built from two circles. Its top stroke runs straight on to become the T’s crossbar, the bridge, and the T’s stem in red is the drop, stopping short of the ground. One continuous line, like your infinity reference.",
     "best": "Ownable initials. Strong on an app icon, embroidery, a cap or a wristband.",
     "watch": "It doesn’t show the towers, so the name has to sit beside it until people know it.",
     "icon_bg": BLACK, "icon_way": {"ink": BONE, "acc": RED}, "icon_fill": 0.56},
    {"n": 3, "slug": "two-ts", "title": "Two T’s", "fn": opt_twot,
     "line": "Two T’s, two towers.",
     "idea": "There are exactly two T’s in Soweto Towers. Both are drawn as cooling towers: the stem curves in to a waist and flares to its base, and the crossbar rests on it with a fine cut, like a bridge on a rim. A pure logotype, no symbol needed.",
     "best": "The quietest and most timeless. One asset that works anywhere type works.",
     "watch": "The idea is subtle at small sizes, so the app icon uses the two tower-T’s on their own.",
     "icon_bg": RED, "icon_way": {"ink": BONE, "acc": BONE}, "icon_fill": 0.66},
    {"n": 4, "slug": "the-arch", "title": "The Arch", "fn": opt_arch,
     "line": "Held by the Highveld sun.",
     "idea": "A red arc, the sun or the O of Soweto, rises over the towers. They stand in its opening and close the circle, and the jumper hangs between them.",
     "best": "A contained emblem. Works well on signage, avatars, merchandise and the gate.",
     "watch": "Two reds (sun and jump) compete a little at small sizes. The jump can be dropped for tiny uses.",
     "icon_bg": BLACK, "icon_way": {"ink": BONE, "acc": RED}, "icon_fill": 0.64},
    {"n": 5, "slug": "the-seal", "title": "The Seal", "fn": opt_seal,
     "line": "A landmark’s stamp.",
     "idea": "A heritage badge. The name runs around the ring, Vertical Adventure Centre closes it below, and the towers stand at the centre. It reads like a stamp in a passport.",
     "best": "Premium and collectable: merchandise, jump certificates, vouchers, stamps.",
     "watch": "Too detailed below about 64 px. Digital icons use the centre on its own.",
     "icon_bg": BLACK, "icon_way": {"ink": BONE, "acc": RED}, "icon_fill": 0.70},
    {"n": 6, "slug": "skyline", "title": "Skyline", "fn": opt_skyline,
     "line": "One line, horizon to horizon.",
     "idea": "A single continuous line traces both towers, like a pulse that jumps at the sight of them. The jumper hangs between, and the horizon runs exactly the width of the name.",
     "best": "Light, elegant and energetic. The horizon line can run across layouts as a graphic device.",
     "watch": "The lightest of the six. It needs a thicker line in its icon version.",
     "icon_bg": BLACK, "icon_way": {"ink": BONE, "acc": RED}, "icon_fill": 0.70},
]

WAY_COL = {"ink": BLACK, "acc": RED}
WAY_REV = {"ink": BONE, "acc": RED}
WAY_MONO_W = {"ink": WHITE, "acc": WHITE}

os.makedirs(OUT, exist_ok=True)
jobs = []
for o in OPTIONS:
    sym, small, lock = o["fn"]()
    o["sym"], o["small"], o["lock"] = sym, small, lock
    d = f"{OUT}/option-{o['n']}-{o['slug']}"
    os.makedirs(d, exist_ok=True)
    pl, ps = lock.h * 0.02, sym.h * 0.02
    files = {
        "logo-colour.svg": lock.svg(WAY_COL, pl),
        "logo-reverse.svg": lock.svg(WAY_REV, pl),
        "logo-white.svg": lock.svg(WAY_MONO_W, pl),
        "symbol-colour.svg": sym.svg(WAY_COL, ps),
        "app-icon.svg": tile(small, o["icon_way"], o["icon_bg"], fill=o["icon_fill"], by=o.get("icon_by", "w")),
    }
    for fn, s in files.items():
        open(f"{d}/{fn}", "w").write(s + "\n")
    jobs.append({"svg": f"{d}/logo-colour.svg", "png": f"{d}/logo-colour.png", "width": 2000})
    jobs.append({"svg": f"{d}/logo-reverse.svg", "png": f"{d}/logo-reverse.png", "width": 2000})
    jobs.append({"svg": f"{d}/app-icon.svg", "png": f"{d}/app-icon-512.png", "width": 512})
    o["dir"] = os.path.relpath(d, OUT)

# recommended pairing: the Jump symbol over the two-T name
jump_sym = OPTIONS[0]["sym"]
pair_name = line_art("SOWETO TOWERS", jump_sym.h * 0.16, tower_t=tower_t_paths())
PAIR = stacked(jump_sym, pair_name)
rd = f"{OUT}/recommended"
os.makedirs(rd, exist_ok=True)
for fn, way in (("logo-colour.svg", WAY_COL), ("logo-reverse.svg", WAY_REV), ("logo-white.svg", WAY_MONO_W)):
    open(f"{rd}/{fn}", "w").write(PAIR.svg(way, PAIR.h * 0.02) + "\n")
jobs.append({"svg": f"{rd}/logo-colour.svg", "png": f"{rd}/logo-colour.png", "width": 2000})
jobs.append({"svg": f"{rd}/logo-reverse.svg", "png": f"{rd}/logo-reverse.png", "width": 2000})

os.makedirs(CACHE, exist_ok=True)
json.dump(jobs, open(f"{CACHE}/option-jobs.json", "w"), indent=1)

import options_page
open(f"{OUT}/index.html", "w").write(options_page.render(OPTIONS, PAIR, SRC, WAY_COL, WAY_REV, tile))
print("built", len(OPTIONS), "options")
