"""Text to outlines (Archivo variable, instanced), kerned with HarfBuzz."""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

_cache = {}


def instance(src, out_dir, wght, wdth):
    key = (src, wght, wdth)
    if key in _cache:
        return _cache[key]
    path = os.path.join(out_dir, f"archivo-w{wght}-d{wdth}.ttf")
    if not os.path.exists(path):
        vf = TTFont(src)
        inst = instantiateVariableFont(vf, {"wght": wght, "wdth": wdth})
        inst.flavor = None
        inst.save(path)
    font = TTFont(path)
    blob = hb.Blob.from_file_path(path)
    face = hb.Face(blob)
    hbfont = hb.Font(face)
    _cache[key] = (font, hbfont)
    return _cache[key]


class Text:
    def __init__(self, src, out_dir, wght=600, wdth=125):
        self.font, self.hb = instance(src, out_dir, wght, wdth)
        self.upm = self.font["head"].unitsPerEm
        self.cap = self.font["OS/2"].sCapHeight
        self.gs = self.font.getGlyphSet()

    def layout(self, text, cap_px, tracking=0.0):
        """Return (path_d, width, ink_left, ink_right). Baseline y=0, caps rise to -cap_px.
        tracking in em (added after every glyph except the last)."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb, buf, {"kern": True, "liga": False})
        k = cap_px / self.cap
        x = 0.0
        parts = []
        names = self.font.getGlyphOrder()
        infos, poss = buf.glyph_infos, buf.glyph_positions
        bounds = []
        from fontTools.pens.boundsPen import BoundsPen
        for i, (info, pos) in enumerate(zip(infos, poss)):
            name = names[info.codepoint]
            pen = SVGPathPen(self.gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
            tp = TransformPen(pen, (k, 0, 0, -k, x + pos.x_offset * k, -pos.y_offset * k))
            self.gs[name].draw(tp)
            d = pen.getCommands()
            if d:
                parts.append(d)
                bp = BoundsPen(self.gs)
                self.gs[name].draw(bp)
                if bp.bounds:
                    bounds.append((x + bp.bounds[0] * k, x + bp.bounds[2] * k))
            x += pos.x_advance * k
            if i < len(infos) - 1:
                x += tracking * cap_px / (self.cap / self.upm)
        ink_l = min(b[0] for b in bounds)
        ink_r = max(b[1] for b in bounds)
        return " ".join(parts), x, ink_l, ink_r

    def fit(self, text, cap_px, target_ink_width, lo=-0.05, hi=0.5):
        """Find tracking so that the ink width equals target."""
        for _ in range(60):
            mid = (lo + hi) / 2
            _, _, l, r = self.layout(text, cap_px, mid)
            if r - l < target_ink_width:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2
