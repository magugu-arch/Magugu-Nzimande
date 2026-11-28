"""Small vector toolkit: circular arcs as cubics, stroke outlining and
boolean union via Skia PathOps, so monoline artwork ships as filled outlines."""
import math
import re
import pathops
from fontTools.pens.svgPathPen import SVGPathPen


def _n(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def pt(cx, cy, r, a):
    a = math.radians(a)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def arc_cubic(cx, cy, r, a0, a1):
    """Cubic segments for a circular arc from a0 to a1 (degrees, y down).
    Returns 'C ...' commands (no move)."""
    n = max(1, math.ceil(abs(a1 - a0) / 90))
    step = (a1 - a0) / n
    k = 4 / 3 * math.tan(math.radians(step) / 4)
    out = []
    for i in range(n):
        s, e = math.radians(a0 + step * i), math.radians(a0 + step * (i + 1))
        x0, y0 = cx + r * math.cos(s), cy + r * math.sin(s)
        x3, y3 = cx + r * math.cos(e), cy + r * math.sin(e)
        x1, y1 = x0 - k * r * math.sin(s), y0 + k * r * math.cos(s)
        x2, y2 = x3 + k * r * math.sin(e), y3 - k * r * math.cos(e)
        out.append(f"C{_n(x1)} {_n(y1)} {_n(x2)} {_n(y2)} {_n(x3)} {_n(y3)}")
    return " ".join(out)


_tok = re.compile(r"[MLHVCQZmlhvcqz]|-?\d*\.?\d+(?:e-?\d+)?")


def to_path(d):
    """Absolute M/L/H/V/C/Z only."""
    p = pathops.Path()
    toks = _tok.findall(d)
    i, cmd, x, y, open_ = 0, None, 0.0, 0.0, False
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t
            i += 1
            if cmd in "Zz":
                p.close()
                open_ = False
            continue
        nums = lambda k: [float(v) for v in toks[i:i + k]]
        if cmd == "M":
            x, y = nums(2); i += 2
            p.moveTo(x, y); open_ = True; cmd = "L"
        elif cmd == "L":
            x, y = nums(2); i += 2; p.lineTo(x, y)
        elif cmd == "H":
            x = nums(1)[0]; i += 1; p.lineTo(x, y)
        elif cmd == "V":
            y = nums(1)[0]; i += 1; p.lineTo(x, y)
        elif cmd == "C":
            a = nums(6); i += 6; p.cubicTo(*a); x, y = a[4], a[5]
        elif cmd == "Q":
            a = nums(4); i += 4; p.quadTo(*a); x, y = a[2], a[3]
        else:
            raise ValueError(cmd)
    return p


def outline(d, w, cap="round", join="round"):
    p = to_path(d)
    caps = {"round": pathops.LineCap.ROUND_CAP, "butt": pathops.LineCap.BUTT_CAP, "square": pathops.LineCap.SQUARE_CAP}
    joins = {"round": pathops.LineJoin.ROUND_JOIN, "miter": pathops.LineJoin.MITER_JOIN}
    p.stroke(w, caps[cap], joins[join], 4)
    p.convertConicsToQuads()
    p.simplify()
    return p


def ring(cx, cy, r, w):
    """Annulus with opposite windings, so it never fills in."""
    ro, ri = r + w / 2, r - w / 2
    d = (f"M{_n(cx + ro)} {_n(cy)} " + arc_cubic(cx, cy, ro, 0, 360) + " Z "
         f"M{_n(cx + ri)} {_n(cy)} " + arc_cubic(cx, cy, ri, 360, 0) + " Z")
    return to_path(d)


def fill(d):
    p = to_path(d)
    p.simplify()
    return p


def union(*paths):
    out = pathops.Path()
    pathops.union(list(paths), out.getPen())
    return out


def difference(a, b):
    out = pathops.Path()
    pathops.difference([a], [b], out.getPen())
    return out


def svg(p):
    pen = SVGPathPen(None, ntos=_n)
    p.draw(pen)
    return pen.getCommands()


def bounds(p):
    return p.bounds  # (xmin, ymin, xmax, ymax)
