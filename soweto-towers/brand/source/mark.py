"""Soweto Towers mark, v2: the twin towers, the bridge, and the jump.

Everything is a ratio of B, the half-width of a tower base, so the mark
scales as one system. All shapes are filled paths (no strokes, no masks).
"""
import math
from geom import Hyper, side, f


class Mark:
    def __init__(self, B=34.0, ratio=1.5, throat=0.62, throat_at=0.76, gap=1.24,
                 band=0.085, cut=0.065, bridge=0.095, cord=0.06, dot=0.22, dot_at=0.50,
                 small=False):
        self.B = B
        self.H = 2 * B * ratio                       # tower height
        self.hyp = Hyper(H=self.H, base=B, throat=B * throat, throat_h=self.H * throat_at)
        self.gap = gap * B                           # space between the two bases
        self.W = 4 * B + self.gap
        self.Ht = self.H
        self.L, self.R = B, self.W - B
        self.by = self.H
        self.band_h = self.H * band                  # rim band height
        self.cut = cut * B                           # the cut under the rim band
        self.bridge = bridge * B
        self.cord = cord * B
        self.dot_r = dot * B
        self.dot_y = self.H * (1 - dot_at)
        self.small = small

    def _tower(self, cx, h0, h1):
        hyp, by = self.hyp, self.by
        return (f"M{f(cx - hyp.w(h0))} {f(by - h0)} " + " ".join(side(hyp, cx, by, h0, h1, -1)) +
                f" L{f(cx + hyp.w(h1))} {f(by - h1)} " + " ".join(side(hyp, cx, by, h1, h0, +1)) + " Z")

    def towers(self):
        H = self.H
        if self.small:
            return [self._tower(self.L, 0, H), self._tower(self.R, 0, H)]
        lo = H - self.band_h
        return [self._tower(cx, 0, lo - self.cut) for cx in (self.L, self.R)] + \
               [self._tower(cx, lo, H) for cx in (self.L, self.R)]

    def bridge_d(self):
        hyp = self.hyp
        x0 = self.L + hyp.w(self.H) - 0.01
        x1 = self.R - hyp.w(self.H) + 0.01
        return f"M{f(x0)} 0 H{f(x1)} V{f(self.bridge)} H{f(x0)} Z"

    def jump_d(self):
        """Cord from under the bridge down to the jumper, as one path."""
        r, cy, w = self.dot_r, self.dot_y, self.cord / 2
        cx = self.W / 2
        if self.small:
            return f"M{f(cx - r)} {f(cy)} A{f(r)} {f(r)} 0 1 0 {f(cx + r)} {f(cy)} A{f(r)} {f(r)} 0 1 0 {f(cx - r)} {f(cy)} Z"
        # where the cord meets the circle
        yj = cy - math.sqrt(r * r - w * w)
        return (f"M{f(cx - w)} {f(self.bridge - 0.01)} H{f(cx + w)} V{f(yj)} "
                f"A{f(r)} {f(r)} 0 1 1 {f(cx - w)} {f(yj)} Z")

    def layers(self):
        """[(role, d)] — role 'tw' = towers + bridge, 'tee' = the jump (accent)."""
        out = [("tw", d) for d in self.towers()]
        out.append(("tw", self.bridge_d()))
        out.append(("tee", self.jump_d()))
        return out
