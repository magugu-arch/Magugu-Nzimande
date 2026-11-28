"""The Soweto Towers brand book: A4 landscape pages, one HTML file.

On screen the pages scale to the window; printed (or saved as PDF from
Chromium) each page is exactly one A4 sheet."""
import base64, math, random
from geom import f, Hyper
import vec
from kit import Art, tile, tower_t_paths, hyper_d, TT, RED, BLACK, BONE, WHITE

COL = {"ink": BLACK, "acc": RED}
REV = {"ink": BONE, "acc": RED}
MONO_W = {"ink": WHITE, "acc": WHITE}
MONO_B = {"ink": BLACK, "acc": BLACK}
SKY, GOLD, GREEN, CONCRETE = "#1D5FD0", "#F2B33D", "#1F8A5B", "#8F8A82"
DATE = "November 2026"


def inl(art, way, cls="lk", pad=None, label="Soweto Towers"):
    s = art.svg(way, art.h * 0.02 if pad is None else pad, title=label)
    return s.replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ", f'<svg class="{cls}" ', 1)


def lum(h):
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    c = lambda v: v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)


def contrast(a, b):
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def render(A, P, pattern_svg, font_path, files):
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()
    mono, hz, st, std, name, lp, up = (A[k] for k in ("monogram", "horizontal", "stacked", "stacked-descriptor", "name", "loop", "loop-upright"))
    g = mono.geo
    pages = []

    def pat_url(ink, bg):
        svg = pattern_svg(ink, bg)
        return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

    PAT_DARK = pat_url("#24211e", BLACK)
    PAT_RED = pat_url("#c92417", RED)
    PAT_BONE = pat_url("#e8e2d6", BONE)
    PAT_FAINT_DARK = pat_url("#1d1b19", BLACK)

    def page(sec, title, body, n, cls="", dark=False):
        head = f'<p class="lab"><i>{sec}</i>{title}</p>' if sec else ""
        foot = f'<footer class="pf"><span>Soweto Towers · Identity guidelines</span><span>{DATE}</span><span class="pn">{n:02d}</span></footer>'
        pages.append(f'<div class="pw"><section class="page {cls}{" dark" if dark else ""}">{head}{body}{foot}</section></div>')

    # ===================================================================== 01 cover
    pages.append(f"""<div class="pw"><section class="page cover dark" style="background-image:url({PAT_FAINT_DARK});background-size:62mm">
      <div class="cover-top"><span>Soweto Towers</span><span>Identity guidelines</span></div>
      <div class="cover-mono">{inl(mono, REV, 'lk')}</div>
      <div class="cover-name">{inl(name, REV, 'lk')}</div>
      <div class="cover-foot"><span>Vertical Adventure Centre · Orlando East, Soweto</span><span>Version 1.0 · {DATE}</span></div>
    </section></div>""")

    # ===================================================================== 02 contents
    toc = [("01", "The idea", 3), ("02", "The name", 4), ("03", "The monogram", 5), ("04", "The Loop", 6),
           ("05", "Logo lockups", 7), ("06", "Clear space and size", 8), ("07", "Colour versions", 9),
           ("08", "Colour", 10), ("09", "Typography", 11), ("10", "The Loop as pattern", 12),
           ("11", "Pictograms", 13), ("12", "Stationery", 14), ("13", "Tickets and wristbands", 15),
           ("14", "Wayfinding", 16), ("15", "Digital", 17), ("16", "Merchandise", 18), ("17", "Misuse", 19)]
    half = (len(toc) + 1) // 2
    cols = "".join(
        '<ol class="toc">' + "".join(f'<li><b>{a}</b><span>{b}</span><i>{c:02d}</i></li>' for a, b, c in part) + "</ol>"
        for part in (toc[:half], toc[half:]))
    page("", "", f"""<div class="contents"><div><p class="lab" style="position:static"><i>—</i>Contents</p>
      <h1 class="big">One place,<br>one line.</h1>
      <p class="lede">These guidelines show how the Soweto Towers identity is built and how to use it, from a browser tab to the gate.</p></div>
      <div class="toc-wrap">{cols}</div></div>""", 2)

    # ===================================================================== 03 idea
    three = [
        ("The name", "Both T’s in Soweto Towers are drawn as cooling towers: a waist, a flared base, and a crossbar resting on the rim.", inl(name, COL)),
        ("The monogram", "An S whose top stroke runs on as the T’s crossbar: the bridge. The red stem is the drop, stopping short of the ground.", inl(mono, COL)),
        ("The Loop", "The two rims seen from above, joined by the bridge. One line. Turn it upright and it becomes an S.", inl(lp, COL)),
    ]
    cards = "".join(f'<div class="idea-card"><div class="ic-art">{svg}</div><h3>{t}</h3><p>{d}</p></div>' for t, d, svg in three)
    page("01", "The idea", f"""<div class="split"><h2 class="h">Two towers.<br>One bridge.<br>One line.</h2>
      <p class="lede">Soweto Towers is two cooling towers joined by a suspension bridge, with a 100 m jump between them. The identity is built the same way: three parts, drawn with one line, and a single red kept for the drop.</p></div>
      <div class="idea-grid">{cards}</div>""", 3)

    # ===================================================================== 04 the name
    x0, x1, lo, cap = TT["bar"]
    make = tower_t_paths()
    k = 0.22
    tparts = make(k, 0)
    sh = (lo - 24) * k
    half_stem = TT["stem"] / 2 * k
    cxT = TT["cx"] * k
    by = 0
    tsvg_body = "".join(f'<path fill="{BLACK}" d="{d}"/>' for d in tparts)
    lab = lambda x, y, t, anchor="start": f'<text x="{f(x)}" y="{f(y)}" text-anchor="{anchor}">{t}</text>'
    lines = [
        # crossbar
        f'<line x1="{f(x1 * k + 6)}" y1="{f(-cap * k + 12)}" x2="{f(x1 * k + 30)}" y2="{f(-cap * k + 12)}"/>',
        lab(x1 * k + 33, -cap * k + 15, "Crossbar: the bridge"),
        # cut
        f'<line x1="{f(cxT + half_stem * 1.4)}" y1="{f(-lo * k + 2.6)}" x2="{f(x1 * k + 30)}" y2="{f(-lo * k + 26)}"/>',
        lab(x1 * k + 33, -lo * k + 29, "One cut"),
        # waist
        f'<line x1="{f(cxT + half_stem * 0.9 + 3)}" y1="{f(-sh * 0.72)}" x2="{f(x1 * k + 30)}" y2="{f(-sh * 0.72)}"/>',
        lab(x1 * k + 33, -sh * 0.72 + 3, "Waist at 72%"),
        # base
        f'<line x1="{f(cxT + half_stem * 2.6 + 3)}" y1="{f(-4)}" x2="{f(x1 * k + 30)}" y2="{f(-4)}"/>',
        lab(x1 * k + 33, -1, "Base: 2.6 × the stem"),
    ]
    tsvg = (f'<svg class="tcon" viewBox="-6 {f(-cap * k - 10)} {f(x1 * k + 150)} {f(cap * k + 22)}" role="img" aria-label="Construction of the tower T">'
            f'{tsvg_body}<g stroke="{RED}" stroke-width=".6" fill="none">{"".join(l for l in lines if l.startswith("<line"))}</g>'
            f'<g font-size="7.2" fill="{BLACK}" style="font-stretch:104%">{"".join(l for l in lines if l.startswith("<text"))}</g></svg>')
    page("02", "The name", f"""<div class="name-hero">{inl(name, COL)}</div>
      <div class="split2"><div class="tcon-wrap">{tsvg}</div>
      <div><h2 class="h">Two T’s, two towers.</h2>
      <p class="body">There are exactly two T’s in Soweto Towers, and the towers stand in them. Each stem curves in to a waist and flares to its base like a cooling tower, and the crossbar rests on it with one fine cut, like the bridge on a rim.</p>
      <p class="body">Set in Archivo Medium, extended to 118%, with +16% tracking. The name is supplied as artwork. Never retype it.</p></div></div>""", 4)

    # ===================================================================== 05 the monogram
    Rt, Rb, w, xs, top, base = g["Rt"], g["Rb"], g["w"], g["xs"], g["top"], g["base"]
    pad = 26
    vb = f"{f(-Rb - pad)} {f(top - pad)} {f(g['bar_end'] + Rb + 2 * pad)} {f(base - top + 2 * pad)}"
    con = [
        f'<circle cx="0" cy="{f(-Rt)}" r="{f(Rt)}"/>', f'<circle cx="0" cy="{f(Rb)}" r="{f(Rb)}"/>',
        f'<line x1="{f(-Rb - 18)}" y1="{f(top)}" x2="{f(g["bar_end"] + 18)}" y2="{f(top)}"/>',
        f'<line x1="{f(-Rb - 18)}" y1="{f(base)}" x2="{f(g["bar_end"] + 18)}" y2="{f(base)}"/>',
        f'<line x1="{f(xs)}" y1="{f(top - 16)}" x2="{f(xs)}" y2="{f(base + 16)}"/>',
    ]
    mlabels = [
        lab(g["bar_end"], top - w / 2 - 5, "bridge", "end"),
        lab(xs + w, base - g["short"] + 2, "drop", "start"),
        lab(-Rb, top - w / 2 - 5, f"Rt = {Rt / Rb:.2f} Rb", "start"),
        lab(xs + w, top + w / 2 + w * 0.5 + 3, "½ w cut", "start"),
    ]
    mon_svg = (f'<svg class="con" viewBox="{vb}" role="img" aria-label="Construction of the monogram">'
               f'<g fill="none" stroke="rgba(243,239,231,.22)" stroke-width=".45" stroke-dasharray="2 2">{"".join(con)}</g>'
               f'<g opacity=".95">{mono.body({"ink": "rgba(243,239,231,.12)", "acc": "rgba(218,41,28,.35)"})}</g>'
               f'<g fill="none" stroke="{BONE}" stroke-width=".55">' +
               "".join(f'<path d="{d}"/>' for r, d, t in mono.items) +
               f'</g><g font-size="5.4" fill="{BONE}" style="font-stretch:104%">{"".join(mlabels)}</g></svg>')
    page("03", "The monogram", f"""<div class="split2"><div class="con-panel">{mon_svg}</div>
      <div><h2 class="h">Soweto, bridged to Towers.</h2>
      <ol class="rules">
        <li><h3>Two circles</h3><p>The S is drawn from two circles, the upper slightly smaller (0.89), so it sits upright and doesn’t look top-heavy.</p></li>
        <li><h3>One line</h3><p>The S and the crossbar are one continuous stroke of one weight, with round ends.</p></li>
        <li><h3>One cut</h3><p>The stem hangs half a line width below the bridge. The same cut appears in the name and the Loop.</p></li>
        <li><h3>The drop</h3><p>The stem is the only red. It stops short of the baseline, like the cord at full stretch.</p></li>
      </ol></div></div>""", 5)

    # ===================================================================== 06 the Loop
    r, D, lw = lp.geo["r"], lp.geo["D"], lp.geo["w"]
    vbl = f"{f(-D - r - 30)} {f(-r - 30)} {f(2 * D + 2 * r + 60)} {f(2 * r + 60)}"
    a = lp.geo["a"]
    # the bridge line in the mirrored (rising) orientation passes through the origin
    p1 = vec.pt(-D, 0, r, -90 + a)
    dx, dy = -p1[0], p1[1]                       # mirrored point
    L = 2.2
    loop_con = (f'<svg class="con" viewBox="{vbl}" role="img" aria-label="Construction of the Loop">'
                f'<g fill="none" stroke="rgba(243,239,231,.22)" stroke-width=".5" stroke-dasharray="2 2">'
                f'<circle cx="{f(-D)}" cy="0" r="{f(r)}"/><circle cx="{f(D)}" cy="0" r="{f(r)}"/>'
                f'<line x1="{f(dx * L)}" y1="{f(dy * L)}" x2="{f(-dx * L)}" y2="{f(-dy * L)}"/>'
                f'<line x1="{f(-D - r - 20)}" y1="0" x2="{f(D + r + 20)}" y2="0"/></g>'
                f'{lp.body({"ink": "rgba(243,239,231,.14)", "acc": RED})}'
                f'<g fill="none" stroke="{BONE}" stroke-width=".55">' + "".join(f'<path d="{d}"/>' for _, d, _ in lp.items) + "</g>"
                f'<circle cx="{f(-D)}" cy="0" r="1.2" fill="{RED}"/><circle cx="{f(D)}" cy="0" r="1.2" fill="{RED}"/>'
                f'<g font-size="6" fill="{BONE}" style="font-stretch:104%">{lab(-D, r + 18, "rim", "middle")}{lab(D, r + 18, "rim", "middle")}'
                f'{lab(0, -r - 14, "bridge", "middle")}</g></svg>')
    page("04", "The Loop", f"""<div class="split2"><div class="con-panel">{loop_con}</div>
      <div><h2 class="h">Seen from above.</h2>
      <p class="body">From the air, the towers are two rims and the bridge runs between them. The Loop is that view, drawn in the same line as the monogram: two rims, one bridge, one cut where the line meets itself.</p>
      <div class="upright"><div>{inl(up, COL)}</div><p><b>Upright, it is an S.</b> The bridge climbs left to right, so the Loop turned on end reads as the S of Soweto.</p></div>
      <p class="note">The Loop is a graphic device, not a logo. It never replaces the name or the monogram. Use it as a pattern, a stamp, a frame, or in motion.</p></div></div>""", 6)

    # ===================================================================== 07 lockups
    page("05", "Logo lockups", f"""<div class="lock-hero">{inl(hz, COL)}<span class="cap">Primary · Horizontal. Use it wherever the space allows.</span></div>
      <div class="lock-grid">
        <div class="lc">{inl(st, COL)}<span class="cap"><b>Stacked</b> Square and portrait spaces: social, posters, merchandise.</span></div>
        <div class="lc">{inl(std, COL)}<span class="cap"><b>Stacked with descriptor</b> First meetings: signage, print, press.</span></div>
        <div class="lc">{inl(mono, COL)}<span class="cap"><b>Monogram</b> App icon, favicon, stamps, embroidery.</span></div>
        <div class="lc">{inl(name, COL)}<span class="cap"><b>Name</b> Narrow spaces and sign-offs.</span></div>
      </div>""", 7)

    # ===================================================================== 08 clear space and size
    x = g["w"] * 2
    hzp = x * 1.4
    cs = (f'<svg class="clear" viewBox="{f(-hzp)} {f(-hzp)} {f(hz.w + 2 * hzp)} {f(hz.h + 2 * hzp)}" role="img" aria-label="Clear space around the horizontal lockup">'
          f'<rect x="{f(-x)}" y="{f(-x)}" width="{f(hz.w + 2 * x)}" height="{f(hz.h + 2 * x)}" fill="rgba(218,41,28,.06)" stroke="{RED}" stroke-width=".7" stroke-dasharray="3 3"/>'
          + "".join(f'<rect x="{f(px)}" y="{f(py)}" width="{f(x)}" height="{f(x)}" fill="{RED}" opacity=".85"/>'
                    for px, py in ((-x, -x), (hz.w, -x), (-x, hz.h), (hz.w, hz.h)))
          + f'<text x="{f(-x / 2)}" y="{f(-x / 2 + 5)}" fill="#fff" font-size="13" text-anchor="middle" font-weight="600">x</text>'
          + hz.body(COL) + "</svg>")
    sizes = "".join(f'<figure class="msz"><div style="width:{z}px;height:{z}px">{inl(mono, COL, "ic", 0)}</div><figcaption>{z} px</figcaption></figure>'
                    for z in (64, 32, 24, 16))
    page("06", "Clear space and size", f"""<div class="split2 top"><div class="clear-wrap">{cs}</div>
      <div><h2 class="h">Give it room.</h2>
      <p class="body">Keep a clear space of <b>x</b> on every side of any lockup, where x is twice the line weight of the monogram. Nothing enters it.</p>
      <table class="tbl"><tr><td>Horizontal</td><td>30 mm · 120 px wide</td></tr><tr><td>Stacked</td><td>22 mm · 88 px wide</td></tr>
      <tr><td>Name</td><td>35 mm · 140 px wide</td></tr><tr><td>Monogram</td><td>5 mm · 16 px tall</td></tr></table>
      <div class="msizes">{sizes}</div><p class="note">The monogram is a single heavy line, so it holds down to a browser tab without a separate small-size version.</p></div></div>""", 8)

    # ===================================================================== 09 colour versions
    page("07", "Colour versions", f"""<div class="vers">
      <div class="vt" style="background:{BONE};box-shadow:inset 0 0 0 .3mm rgba(21,20,18,.12)">{inl(hz, COL)}<span>Full colour · Bone or white</span></div>
      <div class="vt" style="background:{BLACK};color:{BONE}">{inl(hz, REV)}<span>Reverse · Tower Black</span></div>
      <div class="vt" style="background:{RED};color:#fff">{inl(hz, MONO_W)}<span>White · Drop Red and photography</span></div>
      <div class="vt" style="background:#fff;box-shadow:inset 0 0 0 .3mm rgba(21,20,18,.12)">{inl(hz, MONO_B)}<span>Black · one-colour print, stamps, engraving</span></div>
    </div><p class="note wide">In full colour, only the drop is red. In one colour, the whole logo takes that colour, and the cut between the bridge and the drop still draws the T.</p>""", 9)

    # ===================================================================== 10 colour
    prim = [("Drop Red", RED, "218 41 28", "0 95 100 0", "Pantone 485 C", "The drop. The only red in the logo."),
            ("Tower Black", BLACK, "21 20 18", "60 50 50 100", "Rich black", "Structure, type, night."),
            ("Bone", BONE, "243 239 231", "3 4 8 0", "Natural white stock", "Concrete in sunlight. Space and calm.")]
    sec = [("Highveld Sky", SKY, "29 95 208", "SCAD freefall · BASE"), ("Mural Gold", GOLD, "242 179 61", "Zipline"),
           ("Kasi Green", GREEN, "31 138 91", "Paintball"), ("Concrete", CONCRETE, "143 138 130", "Viewing deck · info")]
    ink = lambda bg: BLACK if contrast(bg, BLACK) >= contrast(bg, WHITE) else WHITE
    sw = "".join(f'<div class="sw" style="background:{h};color:{ink(h)}{";box-shadow:inset 0 0 0 .3mm rgba(21,20,18,.14)" if h == BONE else ""}">'
                 f'<b>{n}</b><span>{u}</span><dl><dt>HEX</dt><dd>{h}</dd><dt>RGB</dt><dd>{rgb}</dd><dt>CMYK</dt><dd>{cm}</dd><dt>Print</dt><dd>{pm}</dd></dl></div>'
                 for n, h, rgb, cm, pm, u in prim)
    sw2 = "".join(f'<div class="sw s2" style="background:{h};color:{ink(h)}"><b>{n}</b><dl><dt>HEX</dt><dd>{h}</dd><dt>RGB</dt><dd>{rgb}</dd></dl><span>{u}</span></div>'
                  for n, h, rgb, u in sec)
    page("08", "Colour", f"""<div class="col-grid"><div class="sws">{sw}</div>
      <div class="col-side"><h2 class="h">Concrete, steel and one red.</h2>
      <div class="ratio"><i style="flex:55;background:{BONE};box-shadow:inset 0 0 0 .3mm rgba(21,20,18,.14)"></i><i style="flex:30;background:{BLACK}"></i><i style="flex:10;background:{RED}"></i><i style="flex:5;background:linear-gradient(90deg,{SKY},{GOLD},{GREEN},{CONCRETE})"></i></div>
      <p class="note">Bone 55 · Black 30 · Red 10 · Mural palette 5</p>
      <h3 class="sub">Mural palette</h3><p class="body sm">From the murals on the towers. Each colour codes one family of activities across the website, booking, wristbands and signs.</p>
      <div class="sws2">{sw2}</div></div></div>""", 10)

    # ===================================================================== 11 typography
    page("09", "Typography", f"""<div class="type-grid">
      <div class="spec"><span class="meta">The name · Archivo Medium, width 118, capitals, +16–20%</span><div class="t-name">{inl(name, COL)}</div>
        <span class="meta">The name is supplied as artwork with its two tower T’s. The same face, extended and tracked, sets short labels on signs. Never sentences.</span></div>
      <div class="spec"><span class="meta">Headlines · Archivo SemiBold, width 104, sentence case, −3% at large sizes</span>
        <div class="t-head">Jump from the bridge.</div><div class="t-abc">Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz 0123456789</div></div>
      <div class="spec"><span class="meta">Text · Archivo Regular and Medium, width 100</span>
        <p class="t-body">Open Thursday from 12:00, and Friday to Sunday from 10:00, until sunset. Corner of Sheffield Road and Chris Hani Road, Orlando East.</p>
        <div class="hier"><div><small>Display 40/42</small><span style="font-weight:600;font-stretch:104%;font-size:24pt;letter-spacing:-.03em;line-height:1">Bungee jump</span></div>
        <div><small>Heading 18/24</small><span style="font-weight:600;font-size:14pt;letter-spacing:-.015em">Before you jump</span></div>
        <div><small>Body 10/15</small><span style="font-size:10pt">Jump from the suspension bridge with a cord around your feet.</span></div>
        <div><small>Label 7/10</small><span style="font-stretch:118%;font-weight:500;font-size:7pt;letter-spacing:.2em;text-transform:uppercase">Weight 35–110 kg</span></div></div></div>
      <p class="note">Archivo is free and open source (SIL Open Font License) on Google Fonts. One variable file covers every style here.</p>
    </div>""", 11)

    # ===================================================================== 12 the Loop as pattern
    page("10", "The Loop as pattern", f"""<div class="pat-grid">
      <div class="pt" style="background-image:url({PAT_DARK})"><span>Tower Black · for night, packaging, the back of a card</span></div>
      <div class="pt" style="background-image:url({PAT_RED})"><span>Drop Red · wristbands, tickets, event moments</span></div>
      <div class="pt" style="background-image:url({PAT_BONE});box-shadow:inset 0 0 0 .3mm rgba(21,20,18,.12)"><span style="color:{BLACK}">Bone · backgrounds, tissue paper, stationery</span></div>
      <div class="pat-text"><h2 class="h">A pattern of S’s and views from above.</h2>
      <p class="body">The Loop and its upright S alternate on a square grid. Keep the pattern tone-on-tone, within about 5% of the background, so type and logos stay clear on top of it.</p>
      <p class="note">Supplied as a seamless tile: pattern/loop-pattern-tile-*.svg</p></div></div>""", 12)

    # ===================================================================== 13 pictograms
    pic = "".join(f'<figure class="pic"><div>{inl(a, COL, "pi", 0, k)}</div><figcaption>{k}</figcaption></figure>' for k, a in P.items())
    pic_rev = "".join(f'<div class="pr">{inl(a, REV, "pi", 0, k)}</div>' for k, a in P.items())
    page("11", "Pictograms", f"""<div class="pic-grid">{pic}</div>
      <div class="split2 tight"><div class="pic-rev">{pic_rev}</div>
      <div><h2 class="h sm">Drawn with the same line.</h2><p class="body sm">Six activity pictograms on a 48-unit grid, with one line weight (3.6) and round ends, like the monogram. Red always marks the person or the moment.</p></div></div>""", 13)

    # ===================================================================== 14 stationery
    card_front = f'<div class="bc front">{inl(mono, COL, "bc-mono")}<div class="bc-name">{inl(name, COL)}</div></div>'
    card_back = (f'<div class="bc back" style="background-image:url({PAT_DARK});background-size:28mm">'
                 f'<div class="bc-txt"><b>Name Surname</b><span>Role</span><span class="gap">+27 71 674 4343</span><span>info@sowetotowers.co.za</span>'
                 f'<span>sowetotowers.co.za</span><span class="gap">Cnr Sheffield Rd &amp; Chris Hani Rd<br>Orlando East, Soweto</span></div>'
                 f'<div class="bc-m">{inl(mono, REV, "lk")}</div></div>')
    sig = (f'<div class="sig"><div class="sig-mono">{inl(mono, COL, "lk")}</div><div><b>Name Surname</b><span>Role · Soweto Towers</span>'
           f'<span>+27 71 674 4343 · sowetotowers.co.za</span></div></div>')
    letter_lines = "".join(f'<i style="width:{w}%"></i>' for w in (92, 100, 96, 88, 100, 74, 0, 98, 94, 100, 61, 0, 40))
    letter = (f'<div class="lh"><div class="lh-top">{inl(mono, COL, "lh-m")}<div class="lh-name">{inl(name, COL)}</div></div>'
              f'<div class="lh-to">Name Surname<br>Company<br>Address</div><div class="lh-date">28 November 2026</div>'
              f'<div class="lh-body">{letter_lines}</div>'
              f'<div class="lh-loop">{inl(lp, {"ink": "#ece6da", "acc": "#ece6da"}, "lk")}</div>'
              f'<div class="lh-foot">Cnr Sheffield Road &amp; Chris Hani Road, Orlando East, Soweto · +27 71 674 4343 · sowetotowers.co.za</div></div>')
    page("12", "Stationery", f"""<div class="stat"><div>{letter}<span class="cap">Letterhead · A4, shown at half size</span></div>
      <div class="stat-side"><div class="cards2">{card_front}<span class="cap">Business card, front · 85 × 55 mm, actual size</span>{card_back}<span class="cap">Back · Loop pattern on Tower Black</span></div>
      <div class="sig-wrap">{sig}<span class="cap">Email signature</span></div></div></div>""", 14)

    # ===================================================================== 15 tickets and wristbands
    rnd = random.Random(7)
    q = 21
    cells = []
    for yy in range(q):
        for xx in range(q):
            if (xx < 7 and yy < 7) or (xx >= q - 7 and yy < 7) or (xx < 7 and yy >= q - 7):
                fx = xx - (q - 7) if xx >= q - 7 else xx
                fy = yy - (q - 7) if yy >= q - 7 else yy
                on = fx in (0, 6) or fy in (0, 6) or (2 <= fx <= 4 and 2 <= fy <= 4)
            else:
                on = rnd.random() < 0.48
            if on:
                cells.append(f'<rect x="{xx}" y="{yy}" width="1.02" height="1.02"/>')
    code = f'<svg class="code" viewBox="-1 -1 {q + 2} {q + 2}" aria-hidden="true"><rect x="-1" y="-1" width="{q + 2}" height="{q + 2}" fill="{BONE}"/><g fill="{BLACK}">{"".join(cells)}</g></svg>'
    voucher = (f'<div class="vch"><div class="vch-main"><div class="vch-top">{inl(mono, REV, "vm")}{inl(P["Bungee"], REV, "vp", 0, "Bungee")}</div>'
               f'<div class="vch-act"><small>Activity voucher</small>Bungee jump</div>'
               f'<div class="vch-row"><span>Height<b>100 m</b></span><span>From<b>The bridge</b></span><span>Valid<b>365 days</b></span></div></div>'
               f'<div class="vch-stub">{code}<span>Admit one</span></div></div>')
    def darker(h, t=0.09):
        r, g_, b_ = (int(h[i:i + 2], 16) for i in (1, 3, 5))
        return "#%02x%02x%02x" % (int(r * (1 - t)), int(g_ * (1 - t)), int(b_ * (1 - t)))

    def band(bg, label, picto):
        fg = BLACK if contrast(bg, BLACK) > contrast(bg, WHITE) else BONE
        wv = {"ink": fg, "acc": fg}
        url = pat_url(darker(bg), bg)
        return (f'<div class="wb" style="background-image:url({url});background-size:30mm;color:{fg}">'
                f'<span class="wb-m">{inl(mono, wv, "lk")}</span><span class="wb-n">{inl(name, wv, "lk")}</span>'
                f'<span class="wb-p">{inl(P[picto], wv, "pi", 0, picto)}</span><b>{label}</b></div>')
    bands = (band(RED, "Bungee", "Bungee") + band(SKY, "SCAD freefall", "SCAD freefall") +
             band(GOLD, "Zipline", "Zipline") + band(GREEN, "Paintball", "Paintball"))
    page("13", "Tickets and wristbands", f"""<div class="tix"><div class="tix-v">{voucher}<span class="cap">Activity voucher, emailed and printed</span></div>
      <div class="tix-w">{bands}<span class="cap">Wristbands in the activity colours, so crew can see at a glance who is jumping, falling, flying or playing.</span></div></div>""", 15)

    # ===================================================================== 16 wayfinding
    rows = [("Bungee", RED, "↑"), ("SCAD freefall", SKY, "↑"), ("Zipline", GOLD, "←"), ("Paintball", GREEN, "→"), ("Viewing deck", CONCRETE, "↑")]
    totem_rows = "".join(f'<div class="tr"><span class="tp">{inl(P[n], REV, "pi", 0, n)}</span><span>{n}</span><i style="background:{c}"></i><b>{arr}</b></div>' for n, c, arr in rows)
    page("14", "Wayfinding", f"""<div class="way"><div class="totem">{inl(mono, REV, "tm")}<div class="tname">{inl(name, REV, "lk")}</div>{totem_rows}</div>
      <div class="way-side"><h2 class="h sm">Find it by colour.</h2><p class="body sm">Every sign pairs a pictogram with the activity’s colour from the mural palette, so visitors can follow the colour before they can read the word.</p>
      <div class="dir">{"".join(f'<div class="dr" style="border-left-color:{c}">{inl(P[n], COL, "pi", 0, n)}<span>{n}</span><b>{arr}</b></div>' for n, c, arr in rows[:3])}</div>
      <span class="cap">Directional sign · Bone on posts across the site</span></div></div>""", 16)

    # ===================================================================== 17 digital
    phone_icons = "".join('<div class="app"><div class="aic"><img src="icons/app-icon.svg" alt=""></div><span>Soweto Towers</span></div>' if i == 5
                          else '<div class="app"><div class="aic ph"></div><span></span></div>' for i in range(16))
    chips = "".join(f'<span><i style="background:{c}"></i>{n}</span>' for n, c in (("Bungee", RED), ("SCAD freefall", "#6FA3FF"), ("Zipline", GOLD), ("Paintball", "#3DBB7F")))
    page("15", "Digital", f"""<div class="dig">
      <div class="web"><div class="web-nav">{inl(hz, REV, "wl")}<ul><li>Adventures</li><li>Plan your visit</li><li>Groups</li></ul><span class="btn">Buy a voucher</span></div>
        <div class="web-hero" style="background-image:url({PAT_FAINT_DARK});background-size:46mm"><h4>Jump from Soweto’s skyline.</h4><p>Bungee, SCAD freefall, zipline and paintball at the Orlando cooling towers.</p><div class="chips">{chips}</div>
        <div class="web-loop">{inl(lp, {"ink": "#2b2825", "acc": RED}, "lk")}</div></div></div>
      <div class="phone-col"><div class="phone"><div class="grid">{phone_icons}</div></div></div>
      <div class="post" style="background-image:url({PAT_RED});background-size:22mm"><div class="post-in">{inl(mono, {"ink": BONE, "acc": BLACK}, "pm")}<b>Open Friday to Sunday from 10:00 until sunset.</b><span>sowetotowers.co.za</span></div></div>
    </div><div class="dig-caps"><span class="cap">Website header</span><span class="cap">App icon</span><span class="cap">Social post</span></div>""", 17)

    # ===================================================================== 18 merchandise
    tee = ("M14 10 L36 4 Q50 12 64 4 L86 10 L98 34 L82 42 L78 34 L78 96 L22 96 L22 34 L18 42 L2 34 Z")
    tee_front = (f'<svg class="tee" viewBox="0 0 100 100" aria-hidden="true"><path d="{tee}" fill="{BLACK}"/>'
                 f'<g transform="translate(58 26) scale(.11)">{mono.body(REV)}</g></svg>')
    tee_back_art = Art()
    tee_back_art.place(name, 0, 0)
    tee_back = (f'<svg class="tee" viewBox="0 0 100 100" aria-hidden="true"><path d="{tee}" fill="{BONE}" stroke="rgba(21,20,18,.15)" stroke-width=".4"/>'
                f'<g transform="translate(26 28) scale({f(48 / name.w)})">{name.body(COL)}</g>'
                f'<g transform="translate(50 62) scale(.16)">{lp.body(COL)}</g></svg>')
    cap_svg = (f'<svg class="capm" viewBox="0 0 100 70" aria-hidden="true"><path d="M10 52 Q12 12 50 10 Q88 12 90 52 Z" fill="{RED}"/>'
               f'<path d="M4 52 Q50 44 96 52 Q96 60 50 62 Q4 60 4 52 Z" fill="#b51f14"/><circle cx="50" cy="11" r="2.4" fill="#b51f14"/>'
               f'<g transform="translate(43 22) scale(.13)">{mono.body({"ink": BONE, "acc": BLACK})}</g></svg>')
    page("16", "Merchandise", f"""<div class="merch"><figure>{tee_front}<figcaption>Tee, front · the monogram, small, on the chest</figcaption></figure>
      <figure>{tee_back}<figcaption>Tee, back · the name and the Loop</figcaption></figure>
      <figure>{cap_svg}<figcaption>Cap · embroidered monogram</figcaption></figure></div>""", 18)

    # ===================================================================== 19 misuse
    def bad(body, vb):
        return f'<svg viewBox="{vb}" aria-hidden="true">{body}</svg>'

    mvb = f"{f(mono.bb[0] - 8)} {f(mono.bb[1] - 8)} {f(mono.w + 16)} {f(mono.h + 16)}"
    donts = [
        ("Recolour the drop", "Only the drop is red, and only Drop Red.", bad(mono.body({"ink": BLACK, "acc": SKY}), mvb)),
        ("Stretch or squash", "Scale proportionally, always.", bad(f'<g transform="translate({f(mono.bb[0])} {f(mono.bb[1])}) scale(1.5 .8) translate({f(-mono.bb[0])} {f(-mono.bb[1] + 12)})">{mono.body(COL)}</g>',
                                                                     f"{f(mono.bb[0] - 8)} {f(mono.bb[1] - 8)} {f(mono.w * 1.5 + 16)} {f(mono.h + 16)}")),
        ("Outline the monogram", "It is a solid line, never a hollow one.",
         bad(f'<g fill="none" stroke="{BLACK}" stroke-width="1.6">' + "".join(f'<path d="{d}"/>' for _, d, _ in mono.items) + "</g>", mvb)),
        ("Use ordinary T’s", "The name is artwork. Never set it in type.",
         bad(f'<text x="0" y="22" font-family="Archivo, sans-serif" font-size="24" style="font-stretch:118%;letter-spacing:.16em" font-weight="500" fill="{BLACK}">SOWETO TOWERS</text>', "-4 0 340 30")),
        ("Use the Loop as the logo", "The Loop is a device. It never replaces the monogram or the name.",
         bad(f'<g>{lp.body(COL)}</g><g transform="translate({f(lp.bb[0])} {f(lp.bb[3] + 12)}) scale({f(lp.w / name.w)})">{name.body(COL)}</g>',
             f"{f(lp.bb[0] - 8)} {f(lp.bb[1] - 8)} {f(lp.w + 16)} {f(lp.h + name.h * lp.w / name.w + 30)}")),
        ("Add effects", "No shadows, gradients, bevels or glows.",
         bad(f'<defs><filter id="sh"><feDropShadow dx="4" dy="6" stdDeviation="3" flood-opacity=".45"/></filter></defs><g filter="url(#sh)">{mono.body({"ink": "#555", "acc": "#ff6a4d"})}</g>', mvb)),
    ]
    dhtml = "".join(f'<figure class="dont"><div class="da">{s}<i class="x"></i></div><figcaption><b>Don’t {t[0].lower() + t[1:]}</b>{d}</figcaption></figure>' for t, d, s in donts)
    page("17", "Misuse", f'<div class="donts">{dhtml}</div>', 19)

    # ===================================================================== 20 back cover
    pages.append(f"""<div class="pw"><section class="page backc" style="background-image:url({PAT_DARK});background-size:62mm">
      <div class="bk">{inl(st, REV, 'lk')}</div>
      <div class="bk-foot"><span>Cnr Sheffield Road &amp; Chris Hani Road, Orlando East, Soweto</span><span>sowetotowers.co.za · info@sowetotowers.co.za</span></div>
    </section></div>""")

    files_note = ""
    return TEMPLATE.replace("%FONT%", font64).replace("%PAGES%", "\n".join(pages))


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soweto Towers Identity</title>
<meta name="description" content="Corporate identity guidelines for Soweto Towers, the vertical adventure centre at the Orlando cooling towers.">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/favicon.ico" sizes="any">
<style>
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,%FONT%) format("woff2");font-weight:100 900;font-stretch:62% 125%}
@page{size:297mm 210mm;margin:0}
:root{--red:#DA291C;--black:#151412;--bone:#F3EFE7;--paper:#FBF9F5;--muted:#6B665E;--rule:rgba(21,20,18,.12);--s:1}
*{box-sizing:border-box}
html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Archivo",sans-serif;color:var(--black);-webkit-font-smoothing:antialiased;background:#d6d0c5}
svg{display:block;max-width:100%}
@media screen{
  body{padding:24px 0}
  .pw{width:calc(297mm * var(--s));height:calc(210mm * var(--s));margin:0 auto 20px;box-shadow:0 10px 30px rgba(0,0,0,.18);overflow:hidden}
  .page{transform:scale(var(--s));transform-origin:0 0}
}
@media print{.pw{width:297mm;height:210mm}}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;background:var(--bone);padding:14mm 16mm 0;break-after:page;page-break-after:always;background-repeat:repeat}
.pw:last-child .page{break-after:auto;page-break-after:auto}
.dark{background-color:var(--black);color:var(--bone)}
.lab{position:absolute;top:12mm;left:16mm;margin:0;font-stretch:118%;font-weight:500;font-size:6.5pt;letter-spacing:.22em;text-transform:uppercase;color:var(--muted)}
.lab i{font-style:normal;color:var(--red);margin-right:3mm}
.pf{position:absolute;left:16mm;right:16mm;bottom:8mm;display:flex;gap:8mm;font-stretch:118%;font-weight:500;font-size:6pt;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.pf .pn{margin-left:auto;color:var(--red)}
.dark .pf{color:rgba(243,239,231,.5)}
h1,h2,h3{margin:0;font-weight:600;letter-spacing:-.02em}
.h{font-stretch:104%;font-size:24pt;line-height:1.04;letter-spacing:-.025em}
.h.sm{font-size:18pt}
.big{font-stretch:104%;font-size:40pt;line-height:1;letter-spacing:-.03em;margin:8mm 0 0}
.lede{font-size:11pt;line-height:1.5;color:#3a3733;max-width:120mm;margin:6mm 0 0}
.body{font-size:9.5pt;line-height:1.55;color:#3a3733;margin:4mm 0 0;max-width:110mm}
.body.sm{font-size:8.8pt}
.note{font-size:7.5pt;line-height:1.5;color:var(--muted);margin:4mm 0 0;max-width:110mm}
.note.wide{max-width:none}
.cap{display:block;font-size:6.8pt;color:var(--muted);margin-top:2.5mm;line-height:1.4}
.cap b{color:var(--black);font-weight:600;margin-right:1.5mm}
.split{display:grid;grid-template-columns:1fr 1.1fr;gap:14mm;align-items:end;margin-top:12mm}
.split2{display:grid;grid-template-columns:1.25fr 1fr;gap:12mm;align-items:center;margin-top:10mm;height:152mm}
.split2.top{align-items:start}
.split2.tight{height:auto;margin-top:8mm;grid-template-columns:1.3fr 1fr}

/* cover / back */
.cover{padding:12mm 16mm}
.cover-top{display:flex;justify-content:space-between;font-stretch:118%;font-weight:500;font-size:6.8pt;letter-spacing:.22em;text-transform:uppercase;opacity:.75}
.cover-mono{position:absolute;left:16mm;top:44mm;width:92mm}
.cover-mono .lk{width:100%;height:auto}
.cover-name{position:absolute;left:16mm;bottom:30mm;width:150mm}
.cover-name .lk{width:100%;height:auto}
.cover-foot{position:absolute;left:16mm;right:16mm;bottom:12mm;display:flex;justify-content:space-between;font-stretch:118%;font-weight:500;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;opacity:.6}
.backc{background-color:var(--black);color:var(--bone);display:grid;place-items:center}
.bk{width:110mm}.bk .lk{width:100%;height:auto}
.bk-foot{position:absolute;left:16mm;right:16mm;bottom:12mm;display:flex;justify-content:space-between;font-size:7pt;opacity:.6}

/* contents */
.contents{display:grid;grid-template-columns:1fr 1.1fr;gap:16mm;margin-top:8mm}
.toc-wrap{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:14mm}
.toc{list-style:none;margin:0;padding:0}
.toc li{display:grid;grid-template-columns:8mm 1fr 7mm;gap:2mm;padding:2.6mm 0;border-top:.25mm solid var(--rule);font-size:8.6pt;align-items:baseline}
.toc b{color:var(--red);font-weight:500;font-size:7pt}
.toc i{font-style:normal;text-align:right;color:var(--muted);font-size:7pt}

/* idea */
.idea-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:12mm}
.idea-card{background:var(--paper);border-radius:3mm;padding:6mm;display:flex;flex-direction:column;gap:2.5mm}
.ic-art{height:66mm;display:grid;place-items:center}
.ic-art .lk{max-height:44mm;width:auto;max-width:100%}
.idea-card h3{font-size:11pt}
.idea-card p{margin:0;font-size:8.4pt;line-height:1.5;color:#3a3733}

/* name */
.name-hero{margin-top:14mm;background:var(--paper);border-radius:3mm;height:52mm;display:grid;place-items:center}
.name-hero .lk{width:220mm;height:auto}
.tcon-wrap{background:var(--paper);border-radius:3mm;height:100%;display:grid;place-items:center;padding:8mm}
.tcon{width:100%;height:auto;max-height:80mm}
.tcon text{font-family:"Archivo",sans-serif}
.name-hero + .split2{height:96mm;margin-top:6mm}

/* construction panels */
.con-panel{background:var(--black);border-radius:3mm;height:100%;display:grid;place-items:center;padding:8mm}
.con{width:100%;height:auto;max-height:136mm}
.con text{font-family:"Archivo",sans-serif}
.rules{list-style:none;margin:5mm 0 0;padding:0;counter-reset:r}
.rules li{counter-increment:r;padding:3.2mm 0 3.2mm 9mm;border-top:.25mm solid var(--rule);position:relative}
.rules li::before{content:counter(r,decimal-leading-zero);position:absolute;left:0;top:3.6mm;color:var(--red);font-size:7pt;font-weight:500}
.rules h3{font-size:9.5pt}
.rules p{margin:1mm 0 0;font-size:8.4pt;line-height:1.5;color:#3a3733}
.upright{display:grid;grid-template-columns:22mm 1fr;gap:5mm;align-items:center;margin-top:6mm;background:var(--paper);border-radius:3mm;padding:4mm}
.upright .lk{width:100%;height:auto;max-height:42mm}
.upright p{margin:0;font-size:8.4pt;line-height:1.5}

/* lockups */
.lock-hero{margin-top:12mm;background:var(--paper);border-radius:3mm;height:74mm;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative}
.lock-hero .lk{width:150mm;height:auto}
.lock-hero .cap{position:absolute;left:6mm;bottom:4mm}
.lock-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4mm;margin-top:4mm}
.lc{background:var(--paper);border-radius:3mm;height:66mm;padding:6mm 5mm 5mm;display:flex;flex-direction:column;justify-content:space-between}
.lc .lk{width:auto;max-width:100%;height:auto;max-height:36mm;margin:auto}

/* clear space */
.clear-wrap{background:var(--paper);border-radius:3mm;padding:8mm;height:100%;display:grid;place-items:center}
.clear{width:100%;height:auto}
.tbl{width:100%;border-collapse:collapse;font-size:8.6pt;margin-top:5mm}
.tbl td{padding:2.4mm 0;border-top:.25mm solid var(--rule)}
.tbl td:last-child{text-align:right;font-weight:500}
.msizes{display:flex;gap:6mm;align-items:flex-end;margin-top:6mm}
.msz{margin:0;display:flex;flex-direction:column;align-items:center;gap:1.5mm}
.msz .ic{width:100%;height:100%}
.msz figcaption{font-size:6pt;color:var(--muted)}

/* versions */
.vers{display:grid;grid-template-columns:1fr 1fr;gap:5mm;margin-top:12mm}
.vt{height:72mm;border-radius:3mm;display:grid;place-items:center;position:relative}
.vt .lk{width:110mm;height:auto}
.vt span{position:absolute;left:5mm;bottom:4mm;font-size:6.8pt;font-weight:500;opacity:.75}

/* colour */
.col-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:10mm;margin-top:12mm}
.sws{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.sw{border-radius:3mm;padding:5mm;height:150mm;display:flex;flex-direction:column;gap:2mm}
.sw b{font-size:11pt;font-weight:600;letter-spacing:-.01em}
.sw span{font-size:7.6pt;line-height:1.45;opacity:.85}
.sw dl{margin:auto 0 0;display:grid;grid-template-columns:11mm 1fr;gap:.8mm 2mm;font-size:7pt}
.sw dt{opacity:.6}.sw dd{margin:0;font-weight:500}
.ratio{display:flex;height:4mm;border-radius:2mm;overflow:hidden;margin-top:6mm}
.ratio i{display:block}
.sub{font-size:9.5pt;margin-top:8mm}
.sws2{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:4mm}
.sw.s2{height:34mm;padding:4mm}
.sw.s2 b{font-size:9pt}
.sw.s2 dl{margin-top:auto}

/* type */
.type-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:12mm}
.spec{background:var(--paper);border-radius:3mm;padding:9mm 10mm}
.type-grid .spec:nth-child(3){grid-column:1/-1;display:grid;grid-template-columns:1fr 1.2fr;gap:3mm 10mm}
.type-grid .spec:nth-child(3) .meta{grid-column:1/-1}
.meta{display:block;font-size:6.6pt;color:var(--muted)}
.t-name{margin:10mm 0}
.t-name .lk{width:100%;height:auto}
.t-head{font-weight:600;font-stretch:104%;font-size:36pt;letter-spacing:-.03em;line-height:1;margin:7mm 0 5mm}
.t-abc{font-size:9pt;line-height:1.5;color:#3a3733}
.t-body{font-size:13pt;line-height:1.5;margin:5mm 0}
.hier{display:grid;gap:4mm;align-content:center}
.hier div{display:grid;grid-template-columns:24mm 1fr;align-items:baseline;border-top:.25mm solid var(--rule);padding-top:2.5mm}
.hier small{font-size:6.4pt;color:var(--muted)}
.type-grid .note{grid-column:1/-1}

/* pattern */
.pat-grid{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:112mm auto;gap:4mm;margin-top:12mm}
.pt{border-radius:3mm;background-size:40mm;position:relative}
.pt span{position:absolute;left:4mm;bottom:3mm;font-size:6.6pt;color:var(--bone);font-weight:500;opacity:.85}
.pat-text{grid-column:1/-1;padding-top:3mm}

/* pictograms */
.pic-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:4mm;margin-top:12mm}
.pic{margin:0;background:var(--paper);border-radius:3mm;padding:18mm 4mm 10mm;display:flex;flex-direction:column;align-items:center;gap:7mm}
.pic .pi{width:35mm;height:35mm}
.pic figcaption{font-size:7.6pt;font-weight:500}
.pic-rev{display:grid;grid-template-columns:repeat(6,1fr);gap:7mm;background:var(--black);border-radius:3mm;padding:18mm 11mm}
.pr .pi{width:100%;height:auto}

/* stationery */
.stat{display:grid;grid-template-columns:105mm 1fr;gap:12mm;margin-top:12mm}
.lh{width:105mm;height:148.5mm;background:#fff;position:relative;overflow:hidden;box-shadow:0 2mm 7mm rgba(0,0,0,.12)}
.lh-top{position:absolute;left:9mm;right:9mm;top:9mm;display:flex;justify-content:space-between;align-items:flex-start}
.lh-m{width:7mm;height:auto}.lh-name{width:34mm}.lh-name .lk{width:100%;height:auto}
.lh-to{position:absolute;left:9mm;top:30mm;font-size:4.6pt;line-height:1.5;color:#3a3733}
.lh-date{position:absolute;right:9mm;top:30mm;font-size:4.6pt;color:var(--muted)}
.lh-body{position:absolute;left:9mm;right:9mm;top:48mm;display:flex;flex-direction:column;gap:2.2mm}
.lh-body i{display:block;height:1.1mm;border-radius:.5mm;background:#e6e1d8}
.lh-loop{position:absolute;right:-14mm;bottom:10mm;width:62mm}.lh-loop .lk{width:100%;height:auto}
.lh-foot{position:absolute;left:9mm;right:9mm;bottom:6mm;font-size:3.6pt;color:var(--muted);border-top:.2mm solid var(--rule);padding-top:1.6mm}
.stat-side{display:grid;grid-template-columns:85mm 1fr;gap:8mm;align-content:start}
.cards2{display:flex;flex-direction:column}
.cards2 .bc + .cap{margin-bottom:5mm}
.sig-wrap{align-self:end}
.bc{width:85mm;height:55mm;border-radius:1mm;position:relative;box-shadow:0 2mm 6mm rgba(0,0,0,.14)}
.bc.front{background:var(--bone);box-shadow:0 2mm 6mm rgba(0,0,0,.12),inset 0 0 0 .2mm rgba(21,20,18,.1)}
.bc-mono{position:absolute;left:7mm;top:7mm;width:12mm;height:auto}
.bc-name{position:absolute;left:7mm;bottom:7mm;width:46mm}
.bc-name .lk{width:100%;height:auto}
.bc.back{background-color:var(--black);color:var(--bone)}
.bc-txt{position:absolute;left:7mm;top:7mm;display:flex;flex-direction:column;font-size:6pt;line-height:1.5}
.bc-txt b{font-size:7.4pt;font-weight:600}
.bc-txt .gap{margin-top:2.4mm}
.bc-m{position:absolute;right:7mm;bottom:7mm;width:9mm}
.bc-m .lk{width:100%;height:auto}
.sig{display:grid;grid-template-columns:12mm 1fr;gap:4mm;align-items:center;margin-top:8mm;background:#fff;border-radius:2mm;padding:5mm;font-size:7.4pt;line-height:1.5}
.sig b{display:block;font-size:8.4pt}
.sig span{display:block;color:var(--muted)}
.sig-mono .lk{width:100%;height:auto}

/* tickets */
.tix{display:grid;grid-template-columns:1.05fr 1fr;gap:10mm;margin-top:16mm;align-items:start}
.vch{display:grid;grid-template-columns:1fr 40mm;background:var(--black);color:var(--bone);border-radius:4mm;overflow:hidden;box-shadow:0 3mm 8mm rgba(0,0,0,.16);height:118mm}
.vch-main{padding:7mm;display:flex;flex-direction:column;justify-content:space-between}
.vch-top{display:flex;justify-content:space-between;align-items:flex-start}
.vm{width:14mm;height:auto}.vp{width:11mm;height:11mm}
.vch-act{font-weight:600;font-stretch:104%;font-size:28pt;letter-spacing:-.025em;line-height:1}
.vch-act small{display:block;font-stretch:118%;font-weight:500;font-size:6.4pt;letter-spacing:.22em;text-transform:uppercase;color:var(--red);margin-bottom:2mm}
.vch-row{display:flex;gap:7mm;font-size:6.4pt;opacity:.8}
.vch-row b{display:block;font-size:8pt;font-weight:600;opacity:1}
.vch-stub{background:var(--red);padding:6mm 5mm;display:flex;flex-direction:column;justify-content:space-between;border-left:.6mm dashed rgba(21,20,18,.45)}
.code{width:30mm;height:30mm;border-radius:1mm}
.vch-stub span{font-stretch:118%;font-weight:600;font-size:6.4pt;letter-spacing:.2em;text-transform:uppercase;color:#fff}
.tix-w{display:flex;flex-direction:column;gap:6.5mm}
.wb{height:25mm;border-radius:2mm;display:flex;align-items:center;gap:5mm;padding:0 6mm;overflow:hidden;white-space:nowrap}
.wb-p .pi{width:9mm;height:9mm}
.wb b{margin-left:auto;font-stretch:118%;font-weight:600;font-size:6.6pt;letter-spacing:.2em;text-transform:uppercase}
.wb-m{width:7mm;flex:none}.wb-m .lk{width:100%;height:auto}
.wb-n{width:42mm;flex:none}.wb-n .lk{width:100%;height:auto}

/* wayfinding */
.way{display:grid;grid-template-columns:72mm 1fr;gap:14mm;margin-top:10mm;height:156mm}
.totem{background:var(--black);color:var(--bone);border-radius:1.5mm 1.5mm 0 0;padding:9mm 7mm;display:flex;flex-direction:column;gap:3.6mm;align-self:end;height:150mm}
.tm{width:22mm;height:auto;margin:0 auto}
.tname{width:46mm;margin:1mm auto 5mm}.tname .lk{width:100%;height:auto}
.tr{display:grid;grid-template-columns:9mm 1fr 3mm 6mm;align-items:center;gap:3mm;border-top:.25mm solid rgba(243,239,231,.16);padding-top:3.2mm;font-size:8pt;font-weight:500}
.tr i{width:3mm;height:3mm;border-radius:50%}
.tr b{text-align:right;font-weight:400}
.tp .pi{width:9mm;height:9mm}
.way-side{align-self:center}
.dir{margin-top:8mm;background:var(--paper);border-radius:2mm;padding:3mm 5mm;box-shadow:0 2mm 6mm rgba(0,0,0,.08)}
.dr{display:grid;grid-template-columns:10mm 1fr 8mm;align-items:center;gap:4mm;padding:3mm 0 3mm 4mm;border-left:1.4mm solid;font-size:10pt;font-weight:600}
.dr + .dr{border-top:.25mm solid var(--rule)}
.dr .pi{width:10mm;height:10mm}
.dr b{text-align:right;font-weight:400;font-size:13pt}

/* digital */
.dig{display:grid;grid-template-columns:1.9fr .8fr .9fr;gap:6mm;margin-top:14mm;height:132mm;align-items:center}
.web{border-radius:3mm;overflow:hidden;height:118mm;background:var(--black);color:var(--bone);display:flex;flex-direction:column;box-shadow:0 3mm 8mm rgba(0,0,0,.15)}
.web-nav{display:flex;align-items:center;gap:6mm;padding:4mm 6mm;border-bottom:.25mm solid rgba(243,239,231,.1)}
.wl{height:9mm;width:auto}
.web-nav ul{display:flex;gap:5mm;list-style:none;margin:0 0 0 auto;padding:0;font-size:6.8pt}
.btn{background:var(--red);color:#fff;font-size:6.6pt;font-weight:600;padding:2mm 3.5mm;border-radius:10mm}
.web-hero{flex:1;position:relative;padding:12mm 8mm;background-color:var(--black)}
.web-hero h4{margin:0;font-weight:600;font-stretch:104%;font-size:22pt;letter-spacing:-.03em;line-height:1.02;max-width:80mm}
.web-hero p{font-size:7.6pt;opacity:.85;max-width:70mm;margin:4mm 0 5mm}
.chips{display:flex;flex-wrap:wrap;gap:2mm;max-width:90mm}
.chips span{display:inline-flex;align-items:center;gap:1.6mm;font-size:6.2pt;padding:1.6mm 2.8mm;border-radius:10mm;background:rgba(243,239,231,.08)}
.chips i{width:2mm;height:2mm;border-radius:50%}
.web-loop{position:absolute;right:-8mm;bottom:8mm;width:72mm}.web-loop .lk{width:100%;height:auto}
.phone{width:56mm;height:116mm;margin:0 auto;background:linear-gradient(160deg,#2a2622,#0f0e0c);border-radius:8mm;padding:14mm 4.5mm 4mm;box-shadow:0 0 0 1.6mm #151412,0 4mm 10mm rgba(0,0,0,.22)}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3.4mm 2.4mm}
.app{display:flex;flex-direction:column;align-items:center;gap:1mm;min-width:0}
.aic{width:100%;aspect-ratio:1;border-radius:23%;overflow:hidden}
.aic img{width:100%;height:100%;display:block}
.aic.ph{background:rgba(243,239,231,.1)}
.app span{font-size:4pt;color:#eee;white-space:nowrap;min-height:5mm}
.post{aspect-ratio:1;border-radius:3mm;background-color:var(--red);display:grid;place-items:center;box-shadow:0 3mm 8mm rgba(0,0,0,.15)}
.post-in{display:flex;flex-direction:column;align-items:center;gap:4mm;text-align:center;color:var(--bone);padding:6mm}
.pm{width:18mm;height:auto}
.post-in b{font-weight:600;font-stretch:104%;font-size:12pt;line-height:1.1;letter-spacing:-.02em}
.post-in span{font-size:6.4pt;opacity:.85}
.dig-caps{display:grid;grid-template-columns:1.9fr .8fr .9fr;gap:6mm}

/* merch */
.merch{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6mm;margin-top:16mm}
.merch figure{margin:0;background:var(--paper);border-radius:3mm;height:136mm;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8mm}
.tee{width:68mm;height:auto}.capm{width:70mm;height:auto}
.merch figcaption{font-size:6.8pt;color:var(--muted);margin-top:6mm;text-align:center}

/* misuse */
.donts{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin-top:14mm}
.dont{margin:0}
.da{background:var(--paper);border-radius:3mm;height:52mm;display:grid;place-items:center;padding:6mm;position:relative}
.da svg{max-height:36mm;width:auto;max-width:100%}
.x{position:absolute;top:3mm;right:3mm;width:5mm;height:5mm;border-radius:50%;background:var(--red)}
.x::before,.x::after{content:"";position:absolute;left:1.1mm;right:1.1mm;top:2.3mm;height:.45mm;background:#fff;transform:rotate(45deg)}
.x::after{transform:rotate(-45deg)}
.dont figcaption{font-size:7.4pt;line-height:1.45;color:var(--muted);padding-top:2.5mm}
.dont figcaption b{display:block;color:var(--black);font-weight:600;font-size:8.4pt}
</style>
</head>
<body>
%PAGES%
<script>
(function(){
  function fit(){
    var px = 297 * 96 / 25.4, s = Math.min(1, (window.innerWidth - 24) / px);
    document.documentElement.style.setProperty('--s', s.toFixed(4));
  }
  fit(); window.addEventListener('resize', fit);
  window.addEventListener('beforeprint', function(){ document.documentElement.style.setProperty('--s', 1); });
  window.addEventListener('afterprint', fit);
})();
</script>
</body>
</html>
"""
