"""Round-3 presentation: three standalone identities, A4 landscape.

Layout rules (all in mm, page 297 x 210):
  - margins 14 on every side; header text sits in the top margin band,
    footer text in the bottom band; nothing else enters either band
  - content area: x 14..283, y 22..190 (269 x 168)
  - split pages: a full-bleed field on one side, all text in the other
  - objects stand upright on a grid, never overlap, and carry their own
    caption on a shared baseline
  - no decorative rules
Every element is tagged data-o (object) or data-t (text) so check_layout.js
can prove that nothing overlaps.
"""
import base64, random
from geom import f
import vec
from kit import Art, tile, TT, BLACK, BONE, WHITE

DATE = "November 2026"
OPTICAL = {"cover": {1: 20, 2: 13.5, 3: 15}, "intro": {1: 25, 2: 17, 3: 19}, "compare": {1: 36, 2: 0, 3: 34}}


def inl(art, way, cls="lk", pad=None, label="Soweto Towers", style=""):
    s = art.svg(way, art.h * 0.02 if pad is None else pad, title=label)
    st = f' style="{style}"' if style else ""
    return s.replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ", f'<svg class="{cls}"{st} ', 1)


def qr(dark):
    rnd = random.Random(7)
    q, cells = 21, []
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
    return (f'<svg class="code" viewBox="-1.5 -1.5 {q + 3} {q + 3}" aria-hidden="true"><rect x="-1.5" y="-1.5" width="{q + 3}" '
            f'height="{q + 3}" fill="{BONE}"/><g fill="{dark}">{"".join(cells)}</g></svg>')


def lab(x, y, t, anchor="start"):
    return f'<text x="{f(x)}" y="{f(y)}" text-anchor="{anchor}">{t}</text>'


GUIDE = 'fill="none" stroke="rgba(243,239,231,.22)" stroke-width=".3" stroke-dasharray="1.4 1.4"'
EXT = 10.0          # every construction guide extends exactly this far past what it measures


# ------------------------------------------------------------------ construction drawings
def con_monogram(mono, red):
    g = mono.geo
    Rt, Rb, w, xs, top, base, be = g["Rt"], g["Rb"], g["w"], g["xs"], g["top"], g["base"], g["bar_end"]
    x0, x1 = -Rb - w / 2, be + w / 2                     # ink extents
    pad = 26
    vb = f"{f(x0 - pad)} {f(top - w / 2 - pad)} {f(x1 - x0 + 2 * pad)} {f(base + w / 2 - top + w / 2 + 2 * pad)}"
    guides = (f'<circle cx="0" cy="{f(-Rt)}" r="{f(Rt)}"/><circle cx="0" cy="{f(Rb)}" r="{f(Rb)}"/>'
              f'<line x1="{f(x0 - EXT)}" y1="{f(top)}" x2="{f(x1 + EXT)}" y2="{f(top)}"/>'
              f'<line x1="{f(x0 - EXT)}" y1="{f(base)}" x2="{f(x1 + EXT)}" y2="{f(base)}"/>'
              f'<line x1="{f(xs)}" y1="{f(top - w / 2 - EXT)}" x2="{f(xs)}" y2="{f(base + w / 2 + EXT)}"/>')
    labels = (lab(x1, top - w / 2 - 4, "bridge", "end") + lab(x0, top - w / 2 - 4, f"Rt = {Rt / Rb:.2f} Rb") +
              lab(xs + w / 2 + 3, base - g["short"] + 1.6, "drop") + lab(xs + w / 2 + 3, top + w / 2 + w * 0.5 + 2, "½ w cut"))
    return (f'<svg class="con" viewBox="{vb}" role="img" aria-label="Construction of the monogram">'
            f'<g {GUIDE}>{guides}</g>'
            f'{mono.body({"ink": "rgba(243,239,231,.08)", "acc": "rgba(200,16,46,.3)"})}'
            f'<g fill="none" stroke="{BONE}" stroke-width=".35">' + "".join(f'<path d="{d}"/>' for _, d, _ in mono.items) +
            f'</g><g font-size="4.4" fill="rgba(243,239,231,.82)" style="font-stretch:110%;letter-spacing:.04em">{labels}</g></svg>')


def con_tower_t(make, red):
    bx0, bx1, lo, cap = TT["bar"]
    k = 0.2
    parts = make(k, 0)
    sh = (lo - 20) * k
    hs = TT["stem"] / 2 * k
    cx = TT["cx"] * k
    from geom import Hyper
    hy = Hyper(H=sh, base=hs * 2.35, throat=hs * 0.86, throat_h=sh * 0.72)
    LX = bx1 * k + 18                                    # every leader ends here; labels start 3 units on
    pts = [(bx1 * k, -cap * k + (cap - lo) * k / 2, "Crossbar: the bridge"),
           (cx + hy.w(sh), -lo * k + 1.6, "One cut"),
           (cx + hy.w(sh * 0.72), -sh * 0.72, "Waist at 72%"),
           (cx + hy.w(0), 0, "Base: 2.35 × the stem")]
    leaders = "".join(f'<line x1="{f(px + 2)}" y1="{f(py)}" x2="{f(LX)}" y2="{f(py)}"/>' for px, py, _ in pts)
    dots = "".join(f'<circle cx="{f(px)}" cy="{f(py)}" r=".8"/>' for px, py, _ in pts)
    tx = "".join(lab(LX + 3, py + 1.6, t) for _, py, t in pts)
    return (f'<svg class="con" viewBox="-14 {f(-cap * k - 16)} {f(LX + 74)} {f(cap * k + 32)}" role="img" aria-label="Construction of the tower T">'
            + "".join(f'<path d="{d}" fill="rgba(243,239,231,.08)" stroke="{BONE}" stroke-width=".35"/>' for d in parts)
            + f'<g stroke="rgba(243,239,231,.45)" stroke-width=".3">{leaders}</g><g fill="{red}">{dots}</g>'
            f'<g font-size="4.6" fill="rgba(243,239,231,.85)" style="font-stretch:110%;letter-spacing:.04em">{tx}</g></svg>')


def con_loop(lp, red):
    g = lp.geo
    r, D, a, w = g["r"], g["D"], g["a"], g["w"]
    p1 = vec.pt(-D, 0, r, -90 + a)
    t1 = (-p1[0], p1[1])                                 # tangent points of the (mirrored) bridge
    t2 = (p1[0], -p1[1])
    ux, uy = t2[0] - t1[0], t2[1] - t1[1]
    n = (ux * ux + uy * uy) ** 0.5
    ux, uy = ux / n, uy / n
    e0 = (t1[0] - ux * (EXT + w / 2), t1[1] - uy * (EXT + w / 2))
    e1 = (t2[0] + ux * (EXT + w / 2), t2[1] + uy * (EXT + w / 2))
    xo = D + r + w / 2
    pad = 24
    return (f'<svg class="con" viewBox="{f(-xo - pad)} {f(-r - w / 2 - pad)} {f(2 * xo + 2 * pad)} {f(2 * r + w + 2 * pad)}" role="img" aria-label="Construction of the Loop">'
            f'<g {GUIDE}><circle cx="{f(-D)}" cy="0" r="{f(r)}"/><circle cx="{f(D)}" cy="0" r="{f(r)}"/>'
            f'<line x1="{f(e0[0])}" y1="{f(e0[1])}" x2="{f(e1[0])}" y2="{f(e1[1])}"/>'
            f'<line x1="{f(-xo - EXT)}" y1="0" x2="{f(xo + EXT)}" y2="0"/></g>'
            f'{lp.body({"ink": "rgba(200,16,46,.28)", "acc": "rgba(200,16,46,.28)"})}'
            f'<g fill="none" stroke="#e0485f" stroke-width=".4">' + "".join(f'<path d="{d}"/>' for _, d, _ in lp.items) + "</g>"
            f'<circle cx="{f(-D)}" cy="0" r=".8" fill="{BONE}"/><circle cx="{f(D)}" cy="0" r=".8" fill="{BONE}"/>'
            f'<g font-size="4.6" fill="rgba(243,239,231,.85)" style="font-stretch:110%;letter-spacing:.04em">'
            f'{lab(-D, r + w / 2 + 9, "rim", "middle")}{lab(D, r + w / 2 + 9, "rim", "middle")}'
            f'{lab(0, -r - w / 2 - 6, "bridge", "middle")}</g></svg>')


# ------------------------------------------------------------------ render
def render(opts, P, font_path, WAYS, PAL, tower_t):
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()
    RED, PAPER = PAL["red"], PAL["paper"]
    COL, REV, MW, MB = WAYS["colour"], WAYS["reverse"], WAYS["white"], WAYS["black"]
    BONE_ONLY = {"ink": BONE, "acc": BONE}
    o1, o2, o3 = opts
    pages = []

    def hd(text, left=14):
        return f'<p class="hd" data-t style="left:{left}mm">{text}</p>'

    def ft(n, left=14, right=14):
        return f'<p class="ft" data-t style="left:{left}mm;right:{right}mm"><span>Soweto Towers · Identity options</span><span class="pn">{n:02d}</span></p>'

    def page(body, cls=""):
        pages.append(f'<div class="pw"><section class="page {cls}">{body}</section></div>')

    def loop_pattern(ink, bg, cell=160.0, scale=0.82):
        out = []
        for (cx, cy, art) in ((cell / 2, cell / 2, o3["sym"]), (cell * 1.5, cell / 2, o3["upright"]),
                              (cell / 2, cell * 1.5, o3["upright"]), (cell * 1.5, cell * 1.5, o3["sym"])):
            mx, my = (art.bb[0] + art.bb[2]) / 2, (art.bb[1] + art.bb[3]) / 2
            t = Art()
            t.place(art, cx - mx * scale, cy - my * scale, scale)
            out.append(t.body({"ink": ink, "acc": ink}))
        s = cell * 2
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(s)} {f(s)}" width="{f(s)}" height="{f(s)}">'
               f'<rect width="{f(s)}" height="{f(s)}" fill="{bg}"/>{"".join(out)}</svg>')
        return "data:image/svg+xml;base64," + base64.b64encode(svg.encode()).decode()

    PAT_RED = loop_pattern("#b80e2a", RED)
    PAT_DARK = loop_pattern("#1c1a18", BLACK)

    def icon_svg(o):
        s = tile(o["icon_sym"], o["icon_way"], o["icon_bg"], fill=o["icon_fill"], by=o["icon_by"])
        return s.replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ", '<svg class="ic" ', 1)

    sym_rev = {1: REV, 2: BONE_ONLY, 3: REV}
    nav = {1: o1["primary"], 2: o2["primary"], 3: o3["alt"]}

    # ============================================================== cover
    marks = "".join(f'<div class="cv-c"><div data-o>{inl(o["sym"], sym_rev[o["n"]], "lk", style=f"height:{OPTICAL["cover"][o["n"]]}mm")}</div></div>' for o in opts)
    page(f"""<p class="hd light" data-t style="left:14mm">Soweto Towers</p><p class="hd light right" data-t>Identity options · Round 3</p>
      <div class="cv-row">{marks}</div>
      <h1 class="cv-h" data-t>Three ways to<br>say <em>Soweto Towers.</em></h1>
      <p class="ft light" data-t style="left:14mm"><span>{DATE}</span></p>""", "dark")

    # ============================================================== intro
    cols = "".join(f'<div class="in-c"><div class="in-art" data-o>{inl(o["sym"], COL, "lk", style=f"height:{OPTICAL["intro"][o["n"]]}mm")}</div>'
                   f'<p class="num" data-t>0{o["n"]}</p><h3 data-t>{o["title"]}</h3><p class="sm" data-t>{o["line"]}</p></div>' for o in opts)
    page(f"""{hd("How to read this")}
      <div class="ct"><h2 class="display" data-t>Three complete identities,<br>judged side by side.</h2>
      <p class="lede" data-t>The Loop now stands on its own. Each option is shown whole: the mark and how it is drawn, its colours and app icon, and the same printed and digital pieces. One palette and one typeface run through all three, so you are comparing ideas, not decoration.</p>
      <div class="in-cols">{cols}</div></div>{ft(2)}""")

    # ============================================================== option pages
    for o in opts:
        n0 = 3 + (o["n"] - 1) * 5
        num = f"0{o['n']}"
        sym, prim, alt, altd, name = o["sym"], o["primary"], o["alt"], o["alt_desc"], o["name"]
        RC = 186                                          # right column starts here on split pages

        # (a) hero
        page(f"""<div class="field paper" data-o style="left:0;width:172mm"><div class="hero-art">{inl(prim, COL)}</div></div>
          {hd("Option " + num, RC)}
          <div class="rc" style="left:{RC}mm"><p class="numeral" data-t>{num}</p>
            <h2 class="title" data-t>{o['title']}</h2><p class="line" data-t>{o['line']}</p>
            <p class="body" data-t>{o['idea']}</p>
            <div class="sw2"><div data-t><h4>Strength</h4><p>{o['strength']}</p></div><div data-t><h4>Watch out</h4><p>{o['watch']}</p></div></div></div>
          {ft(n0, RC)}""")

        # (b) construction + lockups
        con = (con_monogram(sym, RED) if o["n"] == 1 else con_tower_t(tower_t, RED) if o["n"] == 2 else con_loop(sym, RED))
        nm = o["names"]
        third = ((o["upright"], "Upright", "Square spaces and the app icon. Turned on end, the Loop is the S of Soweto.")
                 if o["n"] == 3 else (sym, "Monogram" if o["n"] == 1 else "Tower-T pair", "App icon, favicon, stamps and embroidery."))
        rows = [(alt, nm["alt"], "For square and portrait formats: posters, social, merchandise." if o["n"] == 2 else "For wide spaces: the website header, email and vehicles." if o["n"] == 3 else "For square and portrait formats: posters, social, merchandise."),
                (altd, nm["alt_desc"], "Where people meet the brand for the first time: signs, print and press."),
                third]
        rows_html = "".join(f'<div class="lr"><div class="lr-art" data-o>{inl(a, COL)}</div><div class="lr-t" data-t><h4>{t}</h4><p>{d}</p></div></div>' for a, t, d in rows)
        page(f"""<div class="field dark" data-o style="left:0;width:172mm"><div class="con-wrap">{con}</div><p class="field-cap" data-t>Construction</p></div>
          {hd(num + " · " + o['title'] + " · The system", RC)}
          <div class="rc" style="left:{RC}mm"><div class="lrs">{rows_html}</div></div>{ft(n0 + 1, RC)}""")

        # (c) colour
        sizes = "".join(f'<figure class="isz"><div style="width:{z}px;height:{z}px">{icon_svg(o)}</div><figcaption data-t>{z}</figcaption></figure>' for z in (96, 60, 32, 16))
        page(f"""{hd(num + " · " + o['title'] + " · Colour")}
          <div class="ct cgrid">
            <div class="cf c-bone" data-o><span data-t>Full colour on Bone</span>{inl(prim, COL)}</div>
            <div class="cf c-black" data-o><span data-t>Reverse on Tower Black</span>{inl(prim, REV)}</div>
            <div class="cf c-red" data-o><span data-t>White on Crimson</span>{inl(prim, MW)}</div>
            <div class="cf c-white" data-o><span data-t>One colour</span>{inl(prim, MB)}</div>
            <div class="cf c-studio" data-o><span data-t>App icon · 96, 60, 32, 16 px</span><div class="isizes">{sizes}</div></div>
          </div>{ft(n0 + 2)}""")

        # (d) print: a measured grid on the studio surface
        if o["n"] == 1:
            front = f'<div class="bc front" data-o>{inl(sym, COL, "bc-mono")}<div class="bc-name">{inl(name, COL)}</div></div>'
            mark = f'<div class="bc-mk" style="width:8mm">{inl(sym, REV, "lk")}</div>'
            back_bg = ""
        elif o["n"] == 2:
            front = f'<div class="bc front center" data-o><div style="width:58mm">{inl(prim, COL)}</div></div>'
            mark = f'<div class="bc-mk" style="width:12mm">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</div>'
            back_bg = ""
        else:
            front = f'<div class="bc front center" data-o><div style="width:34mm">{inl(prim, COL)}</div></div>'
            mark = f'<div class="bc-mk" style="width:14mm">{inl(sym, REV, "lk")}</div>'
            back_bg = f'background-image:url({PAT_DARK});background-size:26mm;'
        back = (f'<div class="bc back" data-o style="{back_bg}"><div class="bc-txt"><b>Name Surname</b><span>Role</span>'
                f'<span class="gap">+27 71 674 4343</span><span>info@sowetotowers.co.za</span><span>sowetotowers.co.za</span>'
                f'<span class="gap">Cnr Sheffield Rd &amp; Chris Hani Rd, Orlando East</span></div>{mark}</div>')
        vh = {1: "12mm", 2: "8mm", 3: "9mm"}[o["n"]]
        voucher = (f'<div class="vch" data-o><div class="vch-main"><div class="vch-top"><div style="height:{vh}">{inl(sym, sym_rev[o["n"]], "lk vsym")}</div>'
                   f'{inl(P["Bungee"], {"ink": BONE, "acc": RED}, "vp", 0, "Bungee")}</div>'
                   f'<div class="vch-act"><small>Activity voucher</small>Bungee jump</div>'
                   f'<div class="vch-row"><span>Height<b>100 m</b></span><span>From<b>The bridge</b></span><span>Valid<b>365 days</b></span></div></div>'
                   f'<div class="vch-stub">{qr(BLACK)}<span>Admit one</span></div></div>')
        def band(bg, img, label, sym_way, show_sym=True, wide=False):
            st = f"background-color:{bg};" + (f"background-image:url({img});background-size:22mm;" if img else "")
            s_ = (f'<span class="wb-s" style="width:{8 if o["n"] == 2 else 5.5}mm">{inl(sym, sym_way, "lk")}</span>' if show_sym else "")
            n_ = f'<span class="wb-n{" wide" if wide else ""}">{inl(name, BONE_ONLY, "lk")}</span>'
            body_ = (n_ + s_) if o["n"] == 2 else (s_ + n_)
            return f'<div class="wb" data-o style="{st}color:{BONE}">{body_}<b>{label}</b></div>'
        if o["n"] == 1:
            bands = band(RED, None, "Jumper", {"ink": BONE, "acc": BLACK}) + band(BLACK, None, "Spectator", REV)
        elif o["n"] == 2:
            bands = band(BLACK, None, "Jumper", {"ink": RED, "acc": RED}, wide=True) + band(RED, None, "Spectator", BONE_ONLY, wide=True)
        else:
            bands = band(RED, PAT_RED, "Jumper", None, show_sym=False) + band(BLACK, PAT_DARK, "Spectator", None, show_sym=False)
        page(f"""{hd(num + " · " + o['title'] + " · Print")}
          <div class="ct studio" data-o>
            <div class="it" style="left:16mm;top:17.5mm">{front}<p class="cap" data-t>Business card, front · 85 × 55 mm</p></div>
            <div class="it" style="left:117mm;top:17.5mm">{voucher}<p class="cap" data-t>Activity voucher</p></div>
            <div class="it" style="left:16mm;top:88.5mm">{back}<p class="cap" data-t>Business card, back</p></div>
            <div class="it" style="left:117mm;top:88.5mm"><div class="bands">{bands}</div><p class="cap" data-t>Wristbands · jumper and spectator</p></div>
          </div>{ft(n0 + 3)}""")

        # (e) digital: one row, bottom-aligned, shared caption baseline
        chips = "".join(f'<span><i style="background:{c}"></i>{t}</span>' for t, c in (("Bungee", "#e0485f"), ("SCAD freefall", "#7ea3d1"), ("Zipline", PAL["gold"]), ("Paintball", "#79a88d")))
        deco_way = {"ink": RED, "acc": RED} if o["n"] == 3 else {"ink": "#24211e", "acc": "#24211e"}
        browser = (f'<div class="browser" data-o><div class="b-bar"><i></i><i></i><i></i><span>sowetotowers.co.za</span></div>'
                   f'<div class="s-nav">{inl(nav[o["n"]], REV, "s-logo")}<ul><li>Adventures</li><li>Plan your visit</li><li>Groups</li></ul><span class="btn">Buy a voucher</span></div>'
                   f'<div class="s-hero"><div class="s-txt"><h4>Jump from Soweto’s skyline.</h4><p>Bungee, SCAD freefall, zipline and paintball at the Orlando cooling towers.</p><div class="chips">{chips}</div></div>'
                   f'<div class="s-deco">{inl(sym, deco_way, "lk", 0, "")}</div></div></div>')
        apps = "".join(f'<div class="app"><div class="aic">{icon_svg(o)}</div></div>' if i == 5
                       else '<div class="app"><div class="aic ph"></div></div>' for i in range(24))
        phone = f'<div class="phone" data-o><div class="ph-grid">{apps}</div></div>'
        post_bg, post_way, post_h = ((RED, {"ink": BONE, "acc": BLACK}, "13mm") if o["n"] == 1 else
                                     (BLACK, {"ink": RED, "acc": RED}, "9mm") if o["n"] == 2 else (BLACK, REV, "10mm"))
        post = (f'<div class="post" data-o style="background:{post_bg}"><div style="height:{post_h}">{inl(sym, post_way, "lk")}</div>'
                f'<b>Open Friday to Sunday, 10:00 until sunset.</b><span>sowetotowers.co.za</span></div>')
        page(f"""{hd(num + " · " + o['title'] + " · Digital")}
          <div class="ct studio" data-o>
            <div class="it" style="left:16mm;top:36.5mm">{browser}<p class="cap" data-t>Website</p></div>
            <div class="it" style="left:154.1mm;top:36.5mm">{phone}<p class="cap" data-t>App icon</p></div>
            <div class="it" style="left:203mm;top:74.5mm">{post}<p class="cap" data-t>Social post</p></div>
          </div>{ft(n0 + 4)}""")

    # ============================================================== side by side
    cmp_ = "".join(
        f'<div class="cmp"><div class="cmp-art" data-o>{inl(o["primary"], COL, "lk", style=(f"height:{OPTICAL["compare"][o["n"]]}mm" if OPTICAL["compare"][o["n"]] else "width:100%"))}</div>'
        f'<div class="cmp-ic" data-o>{icon_svg(o)}</div><p class="num" data-t>0{o["n"]}</p><h3 data-t>{o["title"]}</h3><p class="sm" data-t>{o["strength"]}</p></div>'
        for o in opts)
    page(f"""{hd("Side by side")}<div class="ct cmps">{cmp_}</div>{ft(18)}""")

    # ============================================================== recommendation
    page(f"""<div class="field paper" data-o style="left:125mm;width:172mm"><div class="hero-art">{inl(o1["primary"], COL)}</div></div>
      {hd("Recommendation")}
      <div class="rc" style="left:14mm;width:97mm"><h2 class="display d-sm" data-t>Option 01,<br>the S + T monogram.</h2>
      <p class="body" data-t>It is the most ownable of the three: initials nobody else has, with the bridge and the drop drawn into the letters. It holds from a browser tab to the gate, and gives the brand a symbol that travels on wristbands, caps and the app.</p>
      <div class="sw2"><div data-t><h4>Choose 02</h4><p>for the quietest, most timeless identity, where the name itself carries the idea.</p></div>
      <div data-t><h4>Choose 03</h4><p>for the boldest: one crimson line, a pattern, and the most energy on social and merchandise.</p></div></div>
      <p class="body" data-t>Pick one, and it becomes the full system: artwork in every format, icons, pictograms, signage and guidelines.</p></div>
      {ft(19, 14, 186)}""")

    css = CSS.replace("%RED%", RED).replace("%PAPER%", PAPER).replace("%FONT%", font64)
    return HTML.replace("%CSS%", css).replace("%PAGES%", "\n".join(pages))


HTML = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soweto Towers Identity Options</title>
<meta name="description" content="Three identity options for Soweto Towers, the vertical adventure centre at the Orlando cooling towers.">
<style>%CSS%</style>
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

CSS = r"""
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,%FONT%) format("woff2");font-weight:100 900;font-stretch:62% 125%}
@page{size:297mm 210mm;margin:0}
:root{--red:%RED%;--black:#151412;--bone:#F3EFE7;--paper:%PAPER%;--ink2:#4a4640;--muted:#8a847b;--s:1}
*{box-sizing:border-box}
html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Archivo",sans-serif;color:var(--black);background:#cfc8bc;-webkit-font-smoothing:antialiased;font-kerning:normal}
svg{display:block;max-width:100%}
p,h1,h2,h3,h4,figure{margin:0}
@media screen{
  body{padding:28px 0}
  .pw{width:calc(297mm * var(--s));height:calc(210mm * var(--s));margin:0 auto 24px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 18px 40px rgba(0,0,0,.16);overflow:hidden}
  .page{transform:scale(var(--s));transform-origin:0 0}
}
@media print{.pw{width:297mm;height:210mm}}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;background:var(--bone);break-after:page;page-break-after:always}
.pw:last-child .page{break-after:auto;page-break-after:auto}
.page.dark{background:var(--black);color:var(--bone)}

/* frame: header band (y 9-14), content (y 22-190), footer band (y 196-201) */
.hd,.ft{position:absolute;font-stretch:118%;font-weight:450;font-size:5.8pt;line-height:1;letter-spacing:.26em;text-transform:uppercase;color:var(--muted)}
.hd{top:11mm}
.hd.right{right:14mm;left:auto}
.ft{bottom:9mm;right:14mm;display:flex;justify-content:space-between}
.ft .pn{color:var(--black);letter-spacing:.12em}
.light{color:rgba(243,239,231,.55)}
.ct{position:absolute;left:14mm;top:22mm;width:269mm;height:168mm}
.field{position:absolute;top:0;bottom:0;display:grid;place-items:center}
.field.paper{background:var(--paper)}
.field.dark{background:var(--black)}
.rc{position:absolute;top:22mm;bottom:20mm;right:14mm;display:flex;flex-direction:column;justify-content:center}
.rc.top{justify-content:flex-start}

/* type */
h2,h3,h4{font-weight:500;letter-spacing:-.02em}
.display{font-size:30pt;line-height:1.06;letter-spacing:-.035em;font-weight:450}
.display.d-sm{font-size:26pt}
.lede{font-size:10.5pt;line-height:1.6;color:var(--ink2);max-width:132mm;margin-top:7mm;font-weight:380}
.body{font-size:8.8pt;line-height:1.65;color:var(--ink2);font-weight:380;margin-top:7mm}
.title{font-size:22pt;letter-spacing:-.03em;font-weight:500}
.line{font-size:10pt;color:var(--muted);margin-top:2mm}
.numeral{font-weight:200;font-size:60pt;line-height:.86;letter-spacing:-.04em;color:var(--red);margin-bottom:7mm}
h4{font-stretch:118%;font-weight:500;font-size:5.6pt;line-height:1.2;letter-spacing:.24em;text-transform:uppercase;color:var(--black)}
.sw2{display:grid;grid-template-columns:1fr 1fr;gap:7mm;margin-top:8mm}
.sw2 p{margin-top:2.2mm;font-size:7.8pt;line-height:1.6;color:var(--ink2)}
.num{font-weight:250;font-size:16pt;line-height:1;letter-spacing:-.02em;color:var(--red);margin-bottom:3mm}
h3{font-size:12pt;line-height:1.2}
.sm{font-size:8.2pt;line-height:1.55;color:var(--ink2);margin-top:1.6mm}

/* cover */
.cv-row{position:absolute;left:14mm;right:14mm;top:44mm;height:40mm;display:grid;grid-template-columns:repeat(3,1fr);align-items:center}
.cv-c{display:grid;place-items:center}
.cv-c .lk{width:auto}
.cv-h{position:absolute;left:14mm;bottom:22mm;font-size:34pt;line-height:1.05;letter-spacing:-.035em;font-weight:400}
.cv-h em{font-style:normal;color:var(--red)}

/* intro */
.in-cols{position:absolute;left:0;right:0;bottom:4mm;display:grid;grid-template-columns:repeat(3,1fr);gap:14mm}
.in-art{height:28mm;display:flex;align-items:center;margin-bottom:8mm}
.in-art .lk{width:auto}

/* hero + system */
.hero-art{width:116mm}
.hero-art .lk{width:100%;height:auto;max-height:90mm}
.con-wrap{width:132mm}
.con{width:100%;height:auto}
.con text{font-family:"Archivo",sans-serif}
.field-cap{position:absolute;left:14mm;bottom:9mm;font-stretch:118%;font-size:5.8pt;line-height:1;letter-spacing:.26em;text-transform:uppercase;color:rgba(243,239,231,.45)}
.lrs{display:flex;flex-direction:column;gap:9mm}
.lr{display:flex;flex-direction:column;gap:4mm}
.lr-art{height:22mm;display:flex;align-items:center;align-self:flex-start;max-width:97mm}
.lr-art .lk{height:100%;width:auto;max-width:97mm}
.lr-t p{margin-top:1.6mm;font-size:7.6pt;line-height:1.55;color:var(--ink2)}

/* colour */
.cgrid{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:3mm}
.cf{position:relative;display:grid;place-items:center;padding:14mm 8mm 8mm}
.cf > span{position:absolute;left:6mm;top:6mm;font-stretch:118%;font-size:5.6pt;line-height:1;letter-spacing:.24em;text-transform:uppercase;opacity:.75}
.cf .lk{width:auto;max-width:100%;height:auto;max-height:34mm}
.c-bone{background:var(--bone);grid-column:span 2;box-shadow:inset 0 0 0 .25mm rgba(21,20,18,.1)}
.c-bone .lk{max-height:46mm;max-width:70%}
.c-black{background:var(--black);color:var(--bone)}
.c-red{background:var(--red);color:#fff}
.c-white{background:#fff;box-shadow:inset 0 0 0 .25mm rgba(21,20,18,.1)}
.c-studio{background:radial-gradient(130% 110% at 30% 15%,#f1ece3 0%,#e4ddd1 60%,#d8d0c3 100%)}
.isizes{display:flex;align-items:flex-end;gap:5mm}
.isz{display:flex;flex-direction:column;align-items:center;gap:2mm}
.isz > div{border-radius:22.5%;overflow:hidden;box-shadow:0 .2mm .5mm rgba(0,0,0,.12),0 2mm 5mm rgba(0,0,0,.1)}
.isz .ic{width:100%;height:100%}
.isz figcaption{font-size:5pt;line-height:1;color:var(--muted)}

/* studio + objects */
.studio{background:radial-gradient(120% 100% at 28% 12%,#f2ede5 0%,#e6dfd3 50%,#d8d0c3 100%)}
.it{position:absolute}
.cap{margin-top:3mm;font-stretch:118%;font-size:5.4pt;line-height:1;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.bc,.vch,.wb,.browser,.phone,.post{box-shadow:0 .2mm .5mm rgba(30,22,12,.1),0 2.5mm 6mm rgba(30,22,12,.12),0 10mm 22mm rgba(30,22,12,.1)}
.bc{width:85mm;height:55mm;border-radius:.8mm;position:relative;overflow:hidden}
.bc.front{background:var(--paper)}
.bc.center{display:grid;place-items:center}
.bc.center .lk{width:100%;height:auto}
.bc-mono{position:absolute;left:7mm;top:7mm;width:10mm;height:auto}
.bc-name{position:absolute;left:7mm;bottom:7mm;width:42mm}.bc-name .lk{width:100%;height:auto}
.bc.back{background-color:var(--black);color:var(--bone)}
.bc-txt{position:absolute;left:7mm;top:7mm;display:flex;flex-direction:column;font-size:5.6pt;line-height:1.55}
.bc-txt b{font-size:7pt;font-weight:500}
.bc-txt .gap{margin-top:2.2mm}
.bc-mk{position:absolute;right:7mm;bottom:7mm}.bc-mk .lk{width:100%;height:auto}
.vch{display:grid;grid-template-columns:1fr 30mm;width:136mm;height:55mm;background:var(--black);color:var(--bone);border-radius:2mm;overflow:hidden}
.vch-main{padding:6mm 7mm;display:flex;flex-direction:column;justify-content:space-between}
.vch-top{display:flex;justify-content:space-between;align-items:flex-start}
.vsym{height:100%;width:auto}.vp{width:7.5mm;height:7.5mm}
.vch-act{font-weight:450;font-size:17pt;letter-spacing:-.03em;line-height:1}
.vch-act small{display:block;font-stretch:118%;font-weight:450;font-size:5pt;letter-spacing:.26em;text-transform:uppercase;color:#e0485f;margin-bottom:2mm}
.vch-row{display:flex;gap:7mm;font-size:5.2pt;color:rgba(243,239,231,.6)}
.vch-row b{display:block;font-size:6.8pt;font-weight:500;color:var(--bone)}
.vch-stub{background:var(--red);padding:5mm;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start}
.code{width:20mm;height:20mm}
.vch-stub span{font-stretch:118%;font-size:5pt;line-height:1;letter-spacing:.24em;text-transform:uppercase;color:#fff}
.bands{display:flex;flex-direction:column;gap:9mm;height:55mm}
.wb{width:136mm;height:23mm;border-radius:1.6mm;display:flex;align-items:center;gap:5mm;padding:0 7mm;overflow:hidden;white-space:nowrap}
.wb-s{flex:none}.wb-s .lk,.wb-n .lk{width:100%;height:auto}
.wb-n{width:38mm;flex:none}.wb-n.wide{width:46mm}
.wb b{margin-left:auto;font-stretch:118%;font-weight:500;font-size:5.4pt;letter-spacing:.26em;text-transform:uppercase}
.browser{width:132mm;height:88mm;border-radius:2mm;overflow:hidden;background:var(--black);color:var(--bone);display:flex;flex-direction:column}
.b-bar{height:6mm;flex:none;background:#2a2724;display:flex;align-items:center;gap:1.5mm;padding:0 3mm}
.b-bar i{width:1.8mm;height:1.8mm;border-radius:50%;background:rgba(243,239,231,.22)}
.b-bar span{margin:0 auto;font-size:4.4pt;color:rgba(243,239,231,.55);background:rgba(243,239,231,.08);padding:.7mm 7mm;border-radius:1.2mm}
.s-nav{height:13mm;flex:none;display:flex;align-items:center;gap:5mm;padding:0 6mm;box-shadow:inset 0 -.2mm 0 rgba(243,239,231,.08)}
.s-logo{height:6.5mm;width:auto;max-width:48mm}
.s-nav ul{display:flex;gap:4mm;list-style:none;margin:0 0 0 auto;padding:0;font-size:5pt;color:rgba(243,239,231,.75)}
.btn{background:var(--red);color:#fff;font-size:4.8pt;font-weight:500;padding:1.6mm 3mm;border-radius:10mm;white-space:nowrap}
.s-hero{flex:1;display:grid;grid-template-columns:68mm 1fr;align-items:center;gap:6mm;padding:0 8mm}
.s-txt h4{font-weight:450;font-size:17pt;line-height:1.05;letter-spacing:-.035em;text-transform:none;font-stretch:100%;color:var(--bone)}
.s-txt p{font-size:5.8pt;line-height:1.6;color:rgba(243,239,231,.7);margin:3.5mm 0 4.5mm}
.chips{display:flex;flex-wrap:wrap;gap:1.6mm}
.chips span{display:inline-flex;align-items:center;gap:1.4mm;font-size:4.8pt;padding:1.4mm 2.6mm;border-radius:10mm;background:rgba(243,239,231,.07);color:rgba(243,239,231,.85)}
.chips i{width:1.6mm;height:1.6mm;border-radius:50%}
.s-deco{display:grid;place-items:center}
.s-deco .lk{width:100%;height:auto;max-height:44mm}
.phone{width:42.8mm;height:88mm;border-radius:6.5mm;background:linear-gradient(165deg,#2c2925,#11100e);padding:11mm 3.4mm 3mm;border:1.1mm solid #151412}
.ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2.6mm 1.9mm}
.aic{width:100%;aspect-ratio:1;border-radius:23%;overflow:hidden}
.aic .ic{width:100%;height:100%}
.aic.ph{background:rgba(243,239,231,.08)}
.post{width:50mm;height:50mm;border-radius:1.4mm;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3.5mm;text-align:center;color:var(--bone);padding:5mm}
.post .lk{height:100%;width:auto}
.post b{font-weight:450;font-size:8.6pt;line-height:1.15;letter-spacing:-.02em}
.post span{font-size:4.6pt;letter-spacing:.06em;opacity:.7}

/* compare */
.cmps{display:grid;grid-template-columns:repeat(3,1fr);gap:14mm;align-content:center}
.cmp-art{height:60mm;display:flex;align-items:center;justify-content:center;background:var(--paper)}
.cmp-art .lk{width:auto;max-width:80%}
.cmp-ic{width:13mm;height:13mm;border-radius:22.5%;overflow:hidden;margin:7mm 0 7mm;box-shadow:0 .2mm .5mm rgba(0,0,0,.12),0 2mm 5mm rgba(0,0,0,.1)}
.cmp-ic .ic{width:100%;height:100%}
"""
