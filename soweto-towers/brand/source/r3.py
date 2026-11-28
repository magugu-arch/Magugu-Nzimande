"""Round 3: three standalone identity options for Soweto Towers.

    python r3.py <archivo-variable.woff2> <out-dir> <font-cache-dir>

  1  S + T monogram    the monogram with the name in plain capitals
  2  Two T's           the name is the logo; both T's drawn as cooling towers
  3  The Loop          the two rims seen from above, in one red line

Writes per-option artwork, icons, the presentation (index.html) and a PNG
render list. Print index.html to PDF with Chromium.
"""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from geom import f
import vec
import kit
from kit import Art, tile, line_art, tower_t_paths, RED, BLACK, BONE, WHITE

SRC, OUT, CACHE = sys.argv[1], sys.argv[2], sys.argv[3]
kit.init(SRC, CACHE)
import ci_assets as A

WAYS = {
    "colour":  {"ink": BLACK, "acc": RED},
    "reverse": {"ink": BONE, "acc": RED},
    "black":   {"ink": BLACK, "acc": BLACK},
    "white":   {"ink": WHITE, "acc": WHITE},
}


def as_role(art, role):
    """Copy an Art with every path set to one role."""
    a = Art()
    for _, d, t in art.items:
        a.items.append((role, d, t))
    a.bb = list(art.bb)
    if hasattr(art, "geo"):
        a.geo = art.geo
    return a


def plain(cap, track=0.2):
    return line_art("SOWETO TOWERS", cap, track=track)


def plain_two(cap):
    n1 = line_art("SOWETO", cap)
    return n1, line_art("TOWERS", cap, width=n1.w)


def horizontal_two_lines(sym, k=0.2, gap=0.3):
    cap = sym.h * k
    n1, n2 = plain_two(cap)
    a = Art()
    a.place(sym, -sym.bb[0], -sym.bb[1])
    gx = sym.w + sym.h * gap
    y0 = (sym.h - cap * 2.75) / 2
    a.place(n1, gx, y0)
    a.place(n2, gx, y0 + cap * 1.75)
    a.bb = [0, 0, gx + n1.w, sym.h]
    return a


def horizontal_one_line(sym, k=0.17, gap=0.32):
    cap = sym.h * k
    n = plain(cap)
    a = Art()
    a.place(sym, -sym.bb[0], -sym.bb[1])
    gx = sym.w + sym.h * gap
    a.place(n, gx, (sym.h - cap) / 2)
    a.bb = [0, 0, gx + n.w, sym.h]
    return a


def stacked(sym, name, gap_k=0.34, desc=False):
    d = line_art("VERTICAL ADVENTURE CENTRE", name.h * 0.5, width=name.w) if desc else None
    return kit.stacked(sym, name, gap_k=gap_k, desc=d)


# ================================================================= option 1: S + T monogram
mono = A.monogram()
o1 = {
    "n": 1, "slug": "st-monogram", "title": "S + T monogram", "line": "Soweto, bridged to Towers.",
    "idea": "An S drawn from two circles. Its top stroke runs straight on to become the T’s crossbar, the bridge, and the T’s stem in red is the drop, stopping short of the ground. One continuous line, one weight, round ends. The name sits beside it in widely spaced capitals.",
    "strength": "Ownable initials that work as an app icon, a stamp, embroidery and a wristband. It reads as letters first, so it travels well beyond the site.",
    "watch": "It doesn’t picture the towers, so until people know it the name sits beside it.",
    "sym": mono,
    "primary": horizontal_two_lines(mono),
    "alt": stacked(mono, plain(mono.h * 0.15)),
    "alt_desc": stacked(mono, plain(mono.h * 0.15), desc=True),
    "name": plain(30.0),
    "icon_sym": mono, "icon_bg": BLACK, "icon_way": {"ink": BONE, "acc": RED}, "icon_fill": 0.56, "icon_by": "h",
    "names": {"primary": "Horizontal", "alt": "Stacked", "alt_desc": "Stacked with descriptor"},
}

# ================================================================= option 2: Two T's
make_t = tower_t_paths()
logo2 = A.name_line(30.0, track=0.16)
n1, n2 = A.name_two_lines(30.0)
st2 = Art()
st2.place(n1, 0, 0)
st2.place(n2, 0, 30.0 * 1.75)
st2.bb = [0, 0, n1.w, 30.0 * 2.75]
desc2 = line_art("VERTICAL ADVENTURE CENTRE", 30.0 * 0.42, width=logo2.w)
ld2 = Art()
ld2.place(logo2, 0, 0)
ld2.place(desc2, 0, 30.0 * 2.0)
ld2.bb = [0, 0, logo2.w, 30.0 * 2.0 + desc2.h]
tt = Art()
for x in (0, 747 + 160):
    for d in make_t(1.0, x):
        tt.addp("ink", vec.fill(d))
o2 = {
    "n": 2, "slug": "two-ts", "title": "Two T’s", "line": "Two T’s, two towers.",
    "idea": "There are exactly two T’s in Soweto Towers, and the towers stand in them. Each stem curves in to a waist and flares to its base like a cooling tower, and the crossbar rests on it with one fine cut, like the bridge on a rim. The name is the logo.",
    "strength": "The quietest and most timeless of the three. Every use builds recognition of the name itself, and it sits comfortably next to partners and sponsors.",
    "watch": "The idea is subtle at small sizes. The app icon uses the two tower-T’s on their own.",
    "sym": tt,
    "primary": logo2, "alt": st2, "alt_desc": ld2, "name": logo2,
    "icon_sym": tt, "icon_bg": RED, "icon_way": {"ink": BONE, "acc": BONE}, "icon_fill": 0.66, "icon_by": "w",
    "names": {"primary": "Logotype", "alt": "Stacked", "alt_desc": "With descriptor"},
}

# ================================================================= option 3: The Loop
loop = as_role(A.loop(), "acc")
upright = as_role(A.loop(vertical=True), "acc")
o3 = {
    "n": 3, "slug": "the-loop", "title": "The Loop", "line": "Seen from above.",
    "idea": "From the air, the two towers are two rims and the bridge runs between them. The Loop draws that view in one red line, with one cut where the line meets itself. It also reads as a loop without end, and turned upright it becomes the S of Soweto.",
    "strength": "The boldest and simplest: one colour, one line, instantly memorable. The upright S makes a strong app icon, and the Loop repeats into a pattern for wristbands, packaging and the web.",
    "watch": "It is abstract: people learn it rather than recognise the towers at first sight. Infinity-like shapes are common in logos, so it should always appear with the name.",
    "sym": loop,
    "primary": stacked(loop, plain(loop.h * 0.24), gap_k=0.45),
    "alt": horizontal_one_line(loop, k=0.2),
    "alt_desc": stacked(loop, plain(loop.h * 0.24), gap_k=0.45, desc=True),
    "name": plain(30.0),
    "icon_sym": upright, "icon_bg": BLACK, "icon_way": {"ink": BONE, "acc": RED}, "icon_fill": 0.62, "icon_by": "h",
    "upright": upright,
    "names": {"primary": "Stacked", "alt": "Horizontal", "alt_desc": "Stacked with descriptor"},
}
OPTS = [o1, o2, o3]

# ================================================================= artwork files
jobs = []
for o in OPTS:
    d = f"{OUT}/option-{o['n']}-{o['slug']}"
    os.makedirs(f"{d}/svg", exist_ok=True)
    os.makedirs(f"{d}/png", exist_ok=True)
    arts = {"logo": o["primary"], "logo-alt": o["alt"], "logo-descriptor": o["alt_desc"], "symbol": o["sym"]}
    if "upright" in o:
        arts["symbol-upright"] = o["upright"]
    for name, art in arts.items():
        for wn, way in WAYS.items():
            p = f"{d}/svg/soweto-towers-{name}-{wn}.svg"
            open(p, "w").write(art.svg(way, art.h * 0.02) + "\n")
            if wn in ("colour", "reverse"):
                jobs.append({"svg": p, "png": p.replace("/svg/", "/png/").replace(".svg", ".png"),
                             "width": 1024 if name.startswith("symbol") else 2400})
    icon = tile(o["icon_sym"], o["icon_way"], o["icon_bg"], fill=o["icon_fill"], by=o["icon_by"])
    open(f"{d}/svg/app-icon.svg", "w").write(icon + "\n")
    jobs.append({"svg": f"{d}/svg/app-icon.svg", "png": f"{d}/png/app-icon-1024.png", "width": 1024})
    o["dir"] = os.path.relpath(d, OUT)

os.makedirs(CACHE, exist_ok=True)
json.dump(jobs, open(f"{CACHE}/r3-jobs.json", "w"), indent=1)

import r3_book
open(f"{OUT}/index.html", "w").write(r3_book.render(OPTS, A.pictograms(), SRC, WAYS))
print("round 3 built:", ", ".join(o["title"] for o in OPTS))
