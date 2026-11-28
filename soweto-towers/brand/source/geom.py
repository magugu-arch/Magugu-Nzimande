"""Geometry helpers for the Soweto Towers mark.

The tower silhouette is a true hyperbola (the profile of a hyperboloid
cooling tower), converted to cubic Beziers with exact tangents.
"""
import math


def f(v):
    s = f"{v:.3f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


class Hyper:
    """Half-width w(h) of a hyperboloid profile, h measured up from the base."""

    def __init__(self, H, base, throat, throat_h):
        self.H, self.a, self.y0 = H, throat, throat_h
        self.b = throat_h / math.sqrt((base / throat) ** 2 - 1)

    def w(self, h):
        return self.a * math.sqrt(1 + ((h - self.y0) / self.b) ** 2)

    def dw(self, h):
        t = (h - self.y0) / self.b
        return self.a * t / self.b / math.sqrt(1 + t * t)


def side(hyp, cx, base_y, h0, h1, sign, n=6):
    """Cubic path segments along one side, from height h0 to h1.
    sign=-1 left edge, +1 right edge. Returns list of 'C' commands (no M)."""
    out = []
    hs = [h0 + (h1 - h0) * i / n for i in range(n + 1)]
    for i in range(n):
        ha, hb = hs[i], hs[i + 1]
        dh = (hb - ha) / 3
        xa, ya = cx + sign * hyp.w(ha), base_y - ha
        xb, yb = cx + sign * hyp.w(hb), base_y - hb
        c1 = (xa + sign * hyp.dw(ha) * dh, ya - dh)
        c2 = (xb - sign * hyp.dw(hb) * dh, yb + dh)
        out.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(xb)} {f(yb)}")
    return out


def tower(hyp, cx, base_y, h0=0.0, h1=None):
    """Closed tower slice between heights h0 and h1."""
    h1 = hyp.H if h1 is None else h1
    d = [f"M{f(cx - hyp.w(h0))} {f(base_y - h0)}"]
    d += side(hyp, cx, base_y, h0, h1, -1)
    d.append(f"L{f(cx + hyp.w(h1))} {f(base_y - h1)}")
    d += side(hyp, cx, base_y, h1, h0, +1)
    d.append("Z")
    return " ".join(d)
