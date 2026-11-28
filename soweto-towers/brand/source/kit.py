"""Shared drawing kit for the Soweto Towers identity: an Art container,
type set as outlines, tower-T letters, text on a circle."""
import math
from geom import Hyper, side, f
from wordmark import Text
import vec
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

RED, BLACK, BONE, WHITE = "#DA291C", "#151412", "#F3EFE7", "#FFFFFF"
TRACK = 0.20
NAME = DESC = None


def init(src, cache):
    """Load the typeface instances used for the name and descriptor."""
    global NAME, DESC
    NAME = Text(src, cache, wght=500, wdth=118)
    DESC = NAME


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


def line_art(s, cap, track=TRACK, txt=None, width=None, tower_t=None):
    """One line of capitals; cap top at y=0, baseline at y=cap, ink from x=0.
    tower_t: callable(k) -> list of (d) replacing the glyph 'T'."""
    txt = txt or NAME
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

