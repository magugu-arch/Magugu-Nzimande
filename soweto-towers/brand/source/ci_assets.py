"""Corporate identity assets for Soweto Towers.

The system has three parts:
  - the Name: SOWETO TOWERS with both T's drawn as cooling towers (kit.tower_t_paths)
  - the Monogram: S + T, one line, the red stem is the drop
  - the Loop: the two tower rims seen from above, joined by the bridge
Plus activity pictograms drawn in the same single-weight, round-ended line.
"""
import math
from geom import f
import vec
import kit
from kit import Art, line_art, tower_t_paths


# ---------------------------------------------------------------- monogram
def monogram(Rt=20.0, Rb=22.5, w=11.0, gap=7.0, short=14.0, cut=0.5):
    top, base = -2 * Rt, 2 * Rb
    xs = Rb + w + gap
    bar_end = 2 * xs
    s_d = (f"M{f(bar_end)} {f(top)} L0 {f(top)} " + vec.arc_cubic(0, -Rt, Rt, -90, -270) + " " +
           vec.arc_cubic(0, Rb, Rb, -90, 150))
    stem_top = top + w / 2 + cut * w + w / 2
    a = Art()
    a.addp("ink", vec.outline(s_d, w))
    a.addp("acc", vec.outline(f"M{f(xs)} {f(stem_top)} L{f(xs)} {f(base - short)}", w))
    a.geo = dict(Rt=Rt, Rb=Rb, w=w, xs=xs, top=top, base=base, bar_end=bar_end, stem_top=stem_top, short=short)
    return a


# ---------------------------------------------------------------- the Loop
def loop_geometry(r=26.0, D_k=1.48, w=13.0, cut=0.5):
    """Two rims (radius r, centres at ±D) joined by the internal tangent.
    Each loop ends where its cap stands `cut*w` clear of the bridge."""
    D = r * D_k
    a = math.degrees(math.asin(r / D))
    thL = -90 + a                        # where the bridge leaves the left rim
    p1 = vec.pt(-D, 0, r, thL)
    p2 = vec.pt(D, 0, r, 90 + a)
    # bridge line through the origin, direction p1 -> p2
    ux, uy = p2[0] - p1[0], p2[1] - p1[1]
    n = math.hypot(ux, uy)
    nx, ny = -uy / n, ux / n             # unit normal of the bridge

    def clearance(ang):
        x, y = vec.pt(-D, 0, r, ang)
        return abs(x * nx + y * ny)      # distance from the cap centre to the bridge line

    # Walk round from the tangent point until the free end clears the bridge
    # by cut*w (plus both half widths): one cut, as in the monogram.
    need = w + cut * w
    start = thL - 360
    for step in range(1, 3600):
        ang = thL - 360 + step * 0.05
        if clearance(ang) >= need:
            start = ang
            break
    left = vec.arc_cubic(-D, 0, r, start, thL)
    # the line flows on round the right rim the other way, so the figure is
    # point-symmetric and the bridge joins both rims without a kink
    right = vec.arc_cubic(D, 0, r, 90 + a, 90 + a - (thL - start))
    x0, y0 = vec.pt(-D, 0, r, start)
    d = f"M{f(x0)} {f(y0)} {left} L{f(p2[0])} {f(p2[1])} {right}"
    return d, dict(r=r, D=D, w=w, a=a, p1=p1, p2=p2, start=start, thL=thL)


def loop(r=26.0, D_k=1.48, w=13.0, cut=0.5, vertical=False, rising=True):
    """The Loop. `rising`: mirrored so the bridge climbs left to right, which
    makes the upright version a true S. `vertical`: turned upright."""
    d, g = loop_geometry(r, D_k, w, cut)
    p = vec.outline(d, w)
    if rising:
        p = p.transform(-1, 0, 0, 1, 0, 0)
    if vertical:
        p = p.transform(0, 1, -1, 0, 0, 0)
    a = Art()
    a.addp("ink", p)
    a.geo = g
    return a


# ---------------------------------------------------------------- lockups
def name_line(cap, track=0.16):
    return line_art("SOWETO TOWERS", cap, track=track, tower_t=tower_t_paths())


def name_two_lines(cap):
    n1 = line_art("SOWETO", cap, tower_t=tower_t_paths())
    n2 = line_art("TOWERS", cap, width=n1.w, tower_t=tower_t_paths())
    return n1, n2


def lockup_horizontal(mono):
    cap = mono.h * 0.17
    n1, n2 = name_two_lines(cap)
    a = Art()
    a.place(mono, -mono.bb[0], -mono.bb[1])
    gx = mono.w + mono.h * 0.26
    block = cap * 2 + cap * 0.75
    y0 = (mono.h - block) / 2
    a.place(n1, gx, y0)
    a.place(n2, gx, y0 + cap * 1.75)
    a.bb = [0, 0, gx + n1.w, mono.h]
    return a


def lockup_stacked(mono, desc=False):
    name = name_line(mono.h * 0.15, track=0.2)
    d = line_art("VERTICAL ADVENTURE CENTRE", name.h * 0.5, width=name.w) if desc else None
    return kit.stacked(mono, name, gap_k=0.34, desc=d)


# ---------------------------------------------------------------- pictograms
def _o(d, w):
    return vec.outline(d, w)


def _dot(cx, cy, r):
    return vec.fill(f"M{f(cx + r)} {f(cy)} " + vec.arc_cubic(cx, cy, r, 0, 360) + " Z")


def pictograms(w=3.6):
    """48-unit grid, one line weight, round ends. Red marks the person."""
    P = {}

    def icon(name, ink, acc):
        a = Art()
        for p in ink:
            a.addp("ink", p)
        for p in acc:
            a.addp("acc", p)
        a.bb = [0, 0, 48, 48]
        P[name] = a

    # Bungee: the bridge, the cord, the jumper
    icon("Bungee", [_o("M9 10 L39 10", w), _o("M24 10 L24 29", w)], [_dot(24, 35, 4.2)])
    # SCAD freefall: the jumper above the net
    icon("SCAD freefall", [_o("M8 26 L8 38", w), _o("M40 26 L40 38", w), _o("M8 30 C16 40 32 40 40 30", w),
                            _o("M24 17 L24 23", w)], [_dot(24, 10, 4.2)])
    # Zipline: cable, trolley, rider
    icon("Zipline", [_o("M6 9 L42 24", w), vec.ring(24, 16.5, 2.6, w * 0.8), _o("M24 19 L24 27", w)], [_dot(24, 33.5, 4.2)])
    # Paintball: the target ring, the hit
    icon("Paintball", [vec.ring(24, 24, 14, w)], [_dot(29.5, 19.5, 4.2)])
    # BASE jump: canopy and lines
    icon("BASE jump", [_o("M8 22 " + vec.arc_cubic(24, 22, 16, 180, 360), w),
                       _o("M9.5 23 L21.5 35", w * 0.8), _o("M38.5 23 L26.5 35", w * 0.8)], [_dot(24, 37.5, 4.2)])
    # Viewing deck: the horizon and the sun
    icon("Viewing deck", [_o("M7 32 L41 32", w)], [_o("M15 32 " + vec.arc_cubic(24, 32, 9, 180, 360), w)])
    return P
