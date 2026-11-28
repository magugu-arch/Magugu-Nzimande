"""Exact geometry for the Soweto Towers mark.

Two hyperboloid towers. The bridge across their tops and the drop between
them form a T. Everything is emitted as cubic Beziers and true arcs:
no masks, no strokes, so the files edit cleanly in any vector tool.
"""
import math
from geom import Hyper, side, f


class Mark:
    def __init__(self, B=26.5, a=16.4, throat=0.73, c=13.0, s=3.5, H_total=134.0):
        self.B, self.a, self.c, self.s = B, a, c, s
        self.throat = throat
        self.W = 4 * B + 2 * s           # bases sit exactly 2s apart, so the drop ends in a point
        self.Ht = H_total
        self.th = H_total - c - s         # tower height
        self.hyp = Hyper(H=self.th, base=B, throat=a, throat_h=self.th * throat)
        self.L = B                        # left tower centre
        self.R = self.W - B               # right tower centre
        self.by = H_total                 # baseline

    def tower(self, cx):
        h, by = self.hyp, self.by
        d = [f"M{f(cx - h.w(0))} {f(by)}"]
        d += side(h, cx, by, 0, h.H, -1)
        d.append(f"L{f(cx + h.w(h.H))} {f(by - h.H)}")
        d += side(h, cx, by, h.H, 0, +1)
        d.append("Z")
        return " ".join(d)

    def off_pt(self, hh, sign):
        """Inner tower edge at height hh, offset by s into the gap along its normal.
        sign=+1 left tower's right edge, -1 right tower's left edge."""
        hyp, s = self.hyp, self.s
        cx = self.L if sign > 0 else self.R
        wp = hyp.dw(hh)
        n = math.hypot(1, wp)
        px, py = cx + sign * hyp.w(hh), self.by - hh
        return px + s * sign / n, py + s * wp / n

    def tip_h(self):
        lo, hi = 0.0, self.hyp.H * 0.5
        for _ in range(80):
            mid = (lo + hi) / 2
            if self.off_pt(mid, +1)[0] >= self.W / 2:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    def _off_curve(self, h0, h1, sign, n=8):
        cmds = []
        hs = [h0 + (h1 - h0) * i / n for i in range(n + 1)]
        e = 1e-4
        for i in range(n):
            ha, hb = hs[i], hs[i + 1]
            pa, pb = self.off_pt(ha, sign), self.off_pt(hb, sign)
            da = [(u - v) / (2 * e) for u, v in zip(self.off_pt(ha + e, sign), self.off_pt(ha - e, sign))]
            db = [(u - v) / (2 * e) for u, v in zip(self.off_pt(hb + e, sign), self.off_pt(hb - e, sign))]
            dh = (hb - ha) / 3
            c1 = (pa[0] + da[0] * dh, pa[1] + da[1] * dh)
            c2 = (pb[0] - db[0] * dh, pb[1] - db[1] * dh)
            cmds.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(pb[0])} {f(pb[1])}")
        return cmds

    def tee(self):
        hyp, s, c, W = self.hyp, self.s, self.c, self.W
        H = hyp.H
        kL = self.L + hyp.w(H)            # left tower, top inner corner x
        kR = self.R - hyp.w(H)            # right tower, top inner corner x
        ht = self.tip_h()
        oR = self.off_pt(H, -1)
        d = ["M0 0", f"H{f(W)}", f"V{f(c)}", f"H{f(kR)}",
             f"A{f(s)} {f(s)} 0 0 0 {f(oR[0])} {f(oR[1])}"]
        d += self._off_curve(H, ht, -1)
        d += self._off_curve(ht, H, +1)
        d.append(f"A{f(s)} {f(s)} 0 0 0 {f(kL)} {f(c)}")
        d.append("H0Z")
        return " ".join(d)

    def paths(self):
        return {"tee": self.tee(), "left": self.tower(self.L), "right": self.tower(self.R)}

    def rulings(self, cx, n=13, spread=1.25):
        """Straight generator lines of the hyperboloid, projected: a hyperboloid
        is made entirely of straight lines, and these are tangent to its outline."""
        hyp = self.hyp
        lines = []
        for i in range(n):
            th = -spread + 2 * spread * i / (n - 1)
            for sgn in (+1, -1):
                pts = []
                for hh in (0, hyp.H):
                    z = hh - hyp.y0
                    x = hyp.a * math.cos(th) - hyp.a * math.sin(th) * z / hyp.b
                    pts.append((cx + sgn * x, self.by - hh))
                lines.append(pts)
        return lines
