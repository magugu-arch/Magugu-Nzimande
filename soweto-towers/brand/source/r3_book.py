"""Round-3 presentation: three standalone identities, A4 landscape pages."""
import base64, math, random
from geom import f
import vec
from kit import Art, tile, tower_t_paths, TT, RED, BLACK, BONE, WHITE
import ci_book

SKY, GOLD, GREEN = "#1D5FD0", "#F2B33D", "#1F8A5B"
DATE = "November 2026"
TONE = "#23201d"


def inl(art, way, cls="lk", pad=None, label="Soweto Towers"):
    s = art.svg(way, art.h * 0.02 if pad is None else pad, title=label)
    return s.replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ", f'<svg class="{cls}" ', 1)


def deco(art, color, cls="deco"):
    """The symbol as a large tone-on-tone graphic."""
    return inl(art, {"ink": color, "acc": color}, cls, 0, "")


def qr():
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
    return (f'<svg class="code" viewBox="-1 -1 {q + 2} {q + 2}" aria-hidden="true"><rect x="-1" y="-1" width="{q + 2}" '
            f'height="{q + 2}" fill="{BONE}"/><g fill="{BLACK}">{"".join(cells)}</g></svg>')


# ------------------------------------------------------------------ construction drawings
def lab(x, y, t, anchor="start"):
    return f'<text x="{f(x)}" y="{f(y)}" text-anchor="{anchor}">{t}</text>'


def con_monogram(mono):
    g = mono.geo
    Rt, Rb, w, xs, top, base = g["Rt"], g["Rb"], g["w"], g["xs"], g["top"], g["base"]
    pad = 26
    vb = f"{f(-Rb - pad)} {f(top - pad)} {f(g['bar_end'] + Rb + 2 * pad)} {f(base - top + 2 * pad)}"
    con = (f'<circle cx="0" cy="{f(-Rt)}" r="{f(Rt)}"/><circle cx="0" cy="{f(Rb)}" r="{f(Rb)}"/>'
           f'<line x1="{f(-Rb - 18)}" y1="{f(top)}" x2="{f(g["bar_end"] + 18)}" y2="{f(top)}"/>'
           f'<line x1="{f(-Rb - 18)}" y1="{f(base)}" x2="{f(g["bar_end"] + 18)}" y2="{f(base)}"/>'
           f'<line x1="{f(xs)}" y1="{f(top - 16)}" x2="{f(xs)}" y2="{f(base + 16)}"/>')
    labels = (lab(g["bar_end"], top - w / 2 - 5, "bridge", "end") + lab(xs + w, base - g["short"] + 2, "drop") +
              lab(-Rb, top - w / 2 - 5, f"Rt = {Rt / Rb:.2f} Rb") + lab(xs + w, top + w / 2 + w * 0.5 + 3, "½ w cut"))
    return (f'<svg class="con" viewBox="{vb}" role="img" aria-label="Construction of the monogram">'
            f'<g fill="none" stroke="rgba(243,239,231,.22)" stroke-width=".45" stroke-dasharray="2 2">{con}</g>'
            f'{mono.body({"ink": "rgba(243,239,231,.12)", "acc": "rgba(218,41,28,.35)"})}'
            f'<g fill="none" stroke="{BONE}" stroke-width=".55">' + "".join(f'<path d="{d}"/>' for _, d, _ in mono.items) +
            f'</g><g font-size="5.4" fill="{BONE}" style="font-stretch:104%">{labels}</g></svg>')


def con_tower_t():
    x0, x1, lo, cap = TT["bar"]
    k = 0.2
    parts = tower_t_paths()(k, 0)
    sh = (lo - 24) * k
    hs = TT["stem"] / 2 * k
    cx = TT["cx"] * k
    R = x1 * k + 26
    rows = [(-cap * k + 11, x1 * k + 4, "Crossbar: the bridge"),
            (-lo * k + 2.4, cx + hs * 1.3, "One cut"),
            (-sh * 0.72, cx + hs * 0.9 + 3, "Waist at 72%"),
            (-3, cx + hs * 2.6 + 3, "Base: 2.6 × the stem")]
    ln = "".join(f'<line x1="{f(xa)}" y1="{f(y)}" x2="{f(R)}" y2="{f(y)}"/>' for y, xa, _ in rows)
    tx = "".join(lab(R + 3, y + 2.4, t) for y, _, t in rows)
    return (f'<svg class="con" viewBox="-8 {f(-cap * k - 14)} {f(x1 * k + 128)} {f(cap * k + 28)}" role="img" aria-label="Construction of the tower T">'
            + "".join(f'<path d="{d}" fill="rgba(243,239,231,.14)" stroke="{BONE}" stroke-width=".5"/>' for d in parts)
            + f'<g stroke="{RED}" stroke-width=".55">{ln}</g><g font-size="6.4" fill="{BONE}" style="font-stretch:104%">{tx}</g></svg>')


def con_loop(lp):
    g = lp.geo
    r, D, a = g["r"], g["D"], g["a"]
    p1 = vec.pt(-D, 0, r, -90 + a)
    dx, dy = -p1[0], p1[1]
    L = 2.2
    return (f'<svg class="con" viewBox="{f(-D - r - 30)} {f(-r - 30)} {f(2 * D + 2 * r + 60)} {f(2 * r + 60)}" role="img" aria-label="Construction of the Loop">'
            f'<g fill="none" stroke="rgba(243,239,231,.22)" stroke-width=".5" stroke-dasharray="2 2">'
            f'<circle cx="{f(-D)}" cy="0" r="{f(r)}"/><circle cx="{f(D)}" cy="0" r="{f(r)}"/>'
            f'<line x1="{f(dx * L)}" y1="{f(dy * L)}" x2="{f(-dx * L)}" y2="{f(-dy * L)}"/>'
            f'<line x1="{f(-D - r - 20)}" y1="0" x2="{f(D + r + 20)}" y2="0"/></g>'
            f'{lp.body({"ink": "rgba(218,41,28,.3)", "acc": "rgba(218,41,28,.3)"})}'
            f'<g fill="none" stroke="{RED}" stroke-width=".6">' + "".join(f'<path d="{d}"/>' for _, d, _ in lp.items) + "</g>"
            f'<circle cx="{f(-D)}" cy="0" r="1.2" fill="{BONE}"/><circle cx="{f(D)}" cy="0" r="1.2" fill="{BONE}"/>'
            f'<g font-size="6" fill="{BONE}" style="font-stretch:104%">{lab(-D, r + 18, "rim", "middle")}{lab(D, r + 18, "rim", "middle")}'
            f'{lab(0, -r - 14, "bridge", "middle")}</g></svg>')


# ------------------------------------------------------------------ render
def render(opts, P, font_path, WAYS):
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()
    COL, REV, MW, MB = WAYS["colour"], WAYS["reverse"], WAYS["white"], WAYS["black"]
    o1, o2, o3 = opts
    pages = []

    def page(label, body, n, cls="", dark=False, style=""):
        head = f'<p class="lab"><i>{label[0]}</i>{label[1]}</p>' if label else ""
        foot = f'<footer class="pf"><span>Soweto Towers · Identity options · Round 3</span><span>{DATE}</span><span class="pn">{n:02d}</span></footer>'
        pages.append(f'<div class="pw"><section class="page {cls}{" dark" if dark else ""}" style="{style}">{head}{body}{foot}</section></div>')

    # pattern for option 3 (Loop and upright S alternating)
    def loop_pattern(ink, bg, cell=160.0, scale=0.86):
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

    PAT_RED = loop_pattern("#c92417", RED)
    PAT_DARK = loop_pattern("#1f1c1a", BLACK)

    def inl_tile(o):
        s = tile(o["icon_sym"], o["icon_way"], o["icon_bg"], fill=o["icon_fill"], by=o["icon_by"])
        return s.replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ", '<svg class="ic" ', 1)

    nav = {1: o1["primary"], 2: o2["primary"], 3: o3["alt"]}

    # ================================================================ 01 cover
    syms = "".join(f'<div class="c3">{inl(o["sym"], REV if o["n"] != 2 else {"ink": BONE, "acc": BONE}, "lk")}<span>{o["n"]:02d} · {o["title"]}</span></div>' for o in opts)
    pages.append(f"""<div class="pw"><section class="page cover dark">
      <div class="cover-top"><span>Soweto Towers</span><span>Identity options · Round 3</span></div>
      <h1 class="r3-title">Three identities<br>for <em>Soweto Towers.</em></h1>
      <div class="c3s">{syms}</div>
      <div class="cover-foot"><span>Vertical Adventure Centre · Orlando East, Soweto</span><span>{DATE}</span></div>
    </section></div>""")

    # ================================================================ 02 intro
    cols = "".join(f'<div class="ic3"><div class="ic3-art">{inl(o["sym"], COL, "lk")}</div><b>{o["n"]:02d}</b><h3>{o["title"]}</h3><p>{o["line"]}</p><i>Pages {3 + (o["n"] - 1) * 5:02d}–{7 + (o["n"] - 1) * 5:02d}</i></div>' for o in opts)
    page(("—", "How to read this"), f"""<div class="split"><h2 class="h">Three complete identities, one fair test.</h2>
      <p class="lede">The Loop now stands on its own. Each option is shown as a complete identity: the logo and how it is drawn, its colour versions and app icon, and the same set of applications, so you can judge them side by side. All three share one palette and one typeface.</p></div>
      <div class="ic3s">{cols}</div>""", 2)

    # ================================================================ option pages
    for o in opts:
        n0 = 3 + (o["n"] - 1) * 5
        num = f"{o['n']:02d}"
        sym, prim, alt, altd, name = o["sym"], o["primary"], o["alt"], o["alt_desc"], o["name"]

        # (a) hero
        page((num, o["title"]), f"""<div class="hero3"><div class="hero3-art">{inl(prim, COL)}</div>
          <div class="hero3-txt"><p class="kick">Option {num}</p><h2 class="h big2">{o['title']}</h2><p class="line3">{o['line']}</p>
          <p class="body">{o['idea']}</p>
          <dl class="sd"><dt>Strength</dt><dd>{o['strength']}</dd><dt>Watch out</dt><dd>{o['watch']}</dd></dl></div></div>""", n0)

        # (b) construction + lockups
        con = con_monogram(sym) if o["n"] == 1 else (con_tower_t() if o["n"] == 2 else con_loop(sym))
        nm = o["names"]
        extra = (f'<div class="lc">{inl(o["upright"], COL)}<span class="cap"><b>Upright</b> Square spaces and the app icon: the S of Soweto.</span></div>'
                 if o["n"] == 3 else
                 f'<div class="lc">{inl(sym, COL)}<span class="cap"><b>{"Monogram" if o["n"] == 1 else "Tower-T pair"}</b> App icon, favicon, stamps, embroidery.</span></div>')
        page((num, o["title"] + " · System"), f"""<div class="sys"><div class="con-panel">{con}</div>
          <div class="sys-grid">
            <div class="lc wide">{inl(alt, COL)}<span class="cap"><b>{nm['alt']}</b></span></div>
            <div class="lc">{inl(altd, COL)}<span class="cap"><b>{nm['alt_desc']}</b></span></div>
            {extra}
          </div></div>""", n0 + 1)

        # (c) colour versions + icon
        sizes = "".join(f'<figure class="msz"><div style="width:{z}px;height:{z}px;border-radius:22.5%;overflow:hidden">{inl_tile(o)}</div><figcaption>{z} px</figcaption></figure>'
                        for z in (96, 64, 32, 16))
        page((num, o["title"] + " · Colour"), f"""<div class="vers3">
          <div class="vt" style="background:{BONE};box-shadow:inset 0 0 0 .3mm rgba(21,20,18,.12)">{inl(prim, COL)}<span>Full colour</span></div>
          <div class="vt" style="background:{BLACK};color:{BONE}">{inl(prim, REV)}<span>Reverse</span></div>
          <div class="vt" style="background:{RED};color:#fff">{inl(prim, MW)}<span>White on Drop Red</span></div>
          <div class="vt" style="background:#fff;box-shadow:inset 0 0 0 .3mm rgba(21,20,18,.12)">{inl(prim, MB)}<span>One colour, black</span></div>
          <div class="vt icons3"><div class="sizes3">{sizes}</div><span>App icon</span></div>
        </div>""", n0 + 2)

        # (d) print: business cards + voucher
        if o["n"] == 1:
            front = f'<div class="bc front">{inl(sym, COL, "bc-mono")}<div class="bc-name">{inl(name, COL)}</div></div>'
            back_deco = f'<div class="bc-deco" style="right:-14mm;top:-6mm;width:52mm">{deco(sym, TONE)}</div>'
            back_mark = f'<div class="bc-m">{inl(sym, REV, "lk")}</div>'
        elif o["n"] == 2:
            front = f'<div class="bc front center"><div class="bc-logo">{inl(prim, COL)}</div></div>'
            back_deco = f'<div class="bc-deco" style="right:-6mm;top:-4mm;width:44mm">{deco(sym, TONE)}</div>'
            back_mark = f'<div class="bc-m tt">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</div>'
        else:
            front = f'<div class="bc front center"><div class="bc-stack">{inl(prim, COL)}</div></div>'
            back_deco = f'<div class="bc-pat" style="background-image:url({PAT_DARK})"></div>'
            back_mark = f'<div class="bc-m loopm">{inl(sym, REV, "lk")}</div>'
        back = (f'<div class="bc back">{back_deco}<div class="bc-txt"><b>Name Surname</b><span>Role</span><span class="gap">+27 71 674 4343</span>'
                f'<span>info@sowetotowers.co.za</span><span>sowetotowers.co.za</span><span class="gap">Cnr Sheffield Rd &amp; Chris Hani Rd<br>Orlando East, Soweto</span></div>{back_mark}</div>')
        vsym = {1: sym, 2: sym, 3: sym}[o["n"]]
        voucher = (f'<div class="vch v3"><div class="vch-main"><div class="vch-top"><div class="vsym s{o["n"]}">{inl(vsym, REV if o["n"] != 2 else {"ink": BONE, "acc": BONE}, "lk")}</div>'
                   f'{inl(P["Bungee"], REV, "vp", 0, "Bungee")}</div>'
                   f'<div class="vch-act"><small>Activity voucher</small>Bungee jump</div>'
                   f'<div class="vch-row"><span>Height<b>100 m</b></span><span>From<b>The bridge</b></span><span>Valid<b>365 days</b></span></div></div>'
                   f'<div class="vch-stub">{qr()}<span>Admit one</span></div></div>')
        page((num, o["title"] + " · Print"), f"""<div class="print3"><div class="cards3">{front}<span class="cap">Business card, front · 85 × 55 mm, actual size</span>{back}<span class="cap">Back</span></div>
          <div>{voucher}<span class="cap">Activity voucher, emailed and printed</span></div></div>""", n0 + 3)

        # (e) digital + on site
        chips = "".join(f'<span><i style="background:{c}"></i>{t}</span>' for t, c in (("Bungee", RED), ("SCAD freefall", "#6FA3FF"), ("Zipline", GOLD), ("Paintball", "#3DBB7F")))
        web_deco = {1: f'<div class="web-deco" style="right:-10mm;bottom:-22mm;width:80mm">{deco(sym, TONE)}</div>',
                    2: f'<div class="web-deco" style="right:8mm;bottom:8mm;width:64mm">{deco(sym, TONE)}</div>',
                    3: f'<div class="web-deco" style="right:-14mm;bottom:2mm;width:96mm">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</div>'}[o["n"]]
        web = (f'<div class="web3"><div class="web-nav">{inl(nav[o["n"]], REV, "wl")}<ul><li>Adventures</li><li>Plan your visit</li><li>Groups</li></ul><span class="btn">Buy a voucher</span></div>'
               f'<div class="web-hero">{web_deco}<h4>Jump from Soweto’s skyline.</h4><p>Bungee, SCAD freefall, zipline and paintball at the Orlando cooling towers.</p><div class="chips">{chips}</div></div></div>')
        if o["n"] == 1:
            post = f'<div class="post3" style="background:{RED}"><div class="post-in">{inl(sym, {"ink": BONE, "acc": BLACK}, "pm")}<b>Open Friday to Sunday from 10:00 until sunset.</b><span>sowetotowers.co.za</span></div></div>'
            band = f'<div class="wb3" style="background:{RED};color:{BONE}"><span class="wb-m">{inl(sym, {"ink": BONE, "acc": BLACK}, "lk")}</span><span class="wb-n">{inl(name, {"ink": BONE, "acc": BONE}, "lk")}</span><b>Bungee</b></div>'
        elif o["n"] == 2:
            post = f'<div class="post3" style="background:{BLACK}"><div class="post-in">{inl(sym, {"ink": RED, "acc": RED}, "pm wide")}<b>Open Friday to Sunday from 10:00 until sunset.</b><span>sowetotowers.co.za</span></div></div>'
            band = f'<div class="wb3" style="background:{BLACK};color:{BONE}"><span class="wb-n wide">{inl(name, {"ink": BONE, "acc": BONE}, "lk")}</span><span class="wb-m tt">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</span><b>Bungee</b></div>'
        else:
            post = f'<div class="post3" style="background:{BLACK}"><div class="post-in">{inl(sym, REV, "pm wide")}<b>Open Friday to Sunday from 10:00 until sunset.</b><span>sowetotowers.co.za</span></div></div>'
            band = f'<div class="wb3" style="background-color:{RED};background-image:url({PAT_RED});background-size:26mm;color:{BONE}"><span class="wb-n">{inl(name, {"ink": BONE, "acc": BONE}, "lk")}</span><b>Bungee</b></div>'
        page((num, o["title"] + " · In use"), f"""<div class="use3"><div>{web}<span class="cap">Website header</span></div>
          <div class="use3-side"><div>{post}<span class="cap">Social post</span></div><div>{band}<span class="cap">Wristband</span></div></div></div>""", n0 + 4)

    # ================================================================ side by side
    cmp_ = "".join(f'<div class="cmp3"><div class="cmp3-art">{inl(o["primary"], COL)}</div><div class="cmp3-row"><div class="cmp3-ic">{inl_tile(o)}</div>'
                   f'<div><b>{o["n"]:02d} · {o["title"]}</b><span>{o["line"]}</span></div></div></div>' for o in opts)
    page(("—", "Side by side"), f'<h2 class="h" style="margin-top:12mm">All three, same size.</h2><div class="cmp3s">{cmp_}</div>', 18)

    # ================================================================ recommendation
    page(("—", "Recommendation"), f"""<div class="rec3"><div><h2 class="h">Option 01, the S + T monogram.</h2>
      <p class="lede">It is the most ownable of the three: initials nobody else has, with the bridge and the drop built into the letters. It works at every size from a browser tab to the gate, and it gives the brand a symbol that travels on wristbands, caps and the app.</p>
      <ul class="why3"><li><b>Choose 02</b> if you want the quietest, most timeless identity, where the name itself carries the idea.</li>
      <li><b>Choose 03</b> if you want the boldest: one red line, a strong pattern and the most energy on social and merchandise.</li></ul>
      <p class="next"><b>Next step.</b> Pick one, and it will be rolled out into the full system: artwork in every format, icons, pictograms, signage and guidelines.</p></div>
      <div class="rec3-art">{inl(o1["primary"], COL)}</div></div>""", 19)

    extra_css = EXTRA_CSS
    html = ci_book.TEMPLATE.replace("</style>", extra_css + "</style>")
    html = html.replace("<title>Soweto Towers Identity</title>", "<title>Soweto Towers Identity Options</title>")
    html = html.replace('<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">\n', "")
    html = html.replace('<link rel="icon" href="icons/favicon.ico" sizes="any">\n', "")
    html = html.replace("Corporate identity guidelines for Soweto Towers", "Three identity options for Soweto Towers")
    return html.replace("%FONT%", font64).replace("%PAGES%", "\n".join(pages))


EXTRA_CSS = r"""
/* round 3 */
.r3-title{position:absolute;left:16mm;top:46mm;font-weight:600;font-stretch:104%;font-size:44pt;line-height:1.02;letter-spacing:-.03em;margin:0}
.r3-title em{font-style:normal;color:var(--red)}
.c3s{position:absolute;left:16mm;right:16mm;bottom:28mm;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12mm;align-items:end}
.c3{display:flex;flex-direction:column;gap:5mm}
.c3 .lk{width:auto;max-width:100%;height:24mm}
.c3 span{font-stretch:118%;font-weight:500;font-size:6.6pt;letter-spacing:.2em;text-transform:uppercase;opacity:.7}
.ic3s{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:12mm}
.ic3{background:var(--paper);border-radius:3mm;padding:7mm;display:flex;flex-direction:column;gap:2mm}
.ic3-art{height:52mm;display:grid;place-items:center;margin-bottom:3mm}
.ic3-art .lk{max-height:40mm;width:auto;max-width:100%}
.ic3 b{color:var(--red);font-weight:500;font-size:7pt}
.ic3 h3{font-size:12pt}
.ic3 p{margin:0;font-size:8.6pt;color:#3a3733}
.ic3 i{font-style:normal;font-size:6.6pt;color:var(--muted);margin-top:2mm}
.hero3{display:grid;grid-template-columns:1.55fr 1fr;gap:10mm;margin-top:10mm;height:160mm}
.hero3-art{background:var(--paper);border-radius:3mm;display:grid;place-items:center;padding:16mm}
.hero3-art .lk{width:auto;max-width:100%;height:auto;max-height:90mm}
.hero3-txt{display:flex;flex-direction:column;justify-content:center}
.kick{font-stretch:118%;font-weight:500;font-size:7pt;letter-spacing:.22em;text-transform:uppercase;color:var(--red);margin:0 0 3mm}
.big2{font-size:30pt}
.line3{font-size:12pt;color:var(--muted);margin:2mm 0 0}
.sd{margin:5mm 0 0;font-size:8.6pt;line-height:1.5}
.sd dt{font-stretch:118%;font-weight:500;font-size:6.4pt;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:3.5mm}
.sd dd{margin:1mm 0 0}
.sys{display:grid;grid-template-columns:1fr 1.15fr;gap:8mm;margin-top:10mm;height:160mm}
.sys-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4mm}
.sys-grid .lc{height:auto}
.sys-grid .lc.wide{grid-column:1/-1}
.sys-grid .lc .lk{max-height:46mm}
.vers3{display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:4mm;margin-top:10mm;height:160mm}
.vers3 .vt{height:auto}
.vers3 .vt .lk{width:auto;max-width:78%;height:auto;max-height:42mm}
.vers3 .vt:nth-child(1){grid-column:span 2}
.vers3 .vt:nth-child(1) .lk{max-height:52mm}
.icons3{background:var(--paper);grid-column:span 1}
.sizes3{display:flex;align-items:flex-end;gap:5mm}
.sizes3 .ic{width:100%;height:100%}
.print3{display:grid;grid-template-columns:85mm 1fr;gap:14mm;margin-top:12mm;align-items:start}
.cards3{display:flex;flex-direction:column}
.cards3 .bc + .cap{margin-bottom:6mm}
.bc{overflow:hidden}
.bc.center{display:grid;place-items:center}
.bc-logo{width:62mm}.bc-logo .lk{width:100%;height:auto}
.bc-stack{width:40mm}.bc-stack .lk{width:100%;height:auto}
.bc-deco{position:absolute}.bc-deco .deco{width:100%;height:auto}
.bc-pat{position:absolute;inset:0;background-size:30mm}
.bc-m.tt{width:14mm}.bc-m.loopm{width:16mm}
.bc-txt{z-index:1}
.v3{height:118mm}
.vsym{height:16mm}.vsym .lk{height:100%;width:auto}
.vsym.s2{height:11mm}
.use3{display:grid;grid-template-columns:1.6fr 1fr;gap:8mm;margin-top:12mm;align-items:start}
.web3{border-radius:3mm;overflow:hidden;height:126mm;background:var(--black);color:var(--bone);display:flex;flex-direction:column;box-shadow:0 3mm 8mm rgba(0,0,0,.15)}
.web3 .web-hero{position:relative;overflow:hidden}
.web3 .web-hero > *:not(.web-deco){position:relative;z-index:1}
.web-deco{position:absolute}.web-deco .lk,.web-deco .deco{width:100%;height:auto}
.web3 .wl{height:9mm;width:auto;max-width:60mm}
.use3-side{display:flex;flex-direction:column;gap:6mm}
.post3{aspect-ratio:1;border-radius:3mm;display:grid;place-items:center;box-shadow:0 3mm 8mm rgba(0,0,0,.15);width:78mm}
.post3 .pm{width:18mm;height:auto}
.post3 .pm.wide{width:30mm}
.wb3{height:22mm;border-radius:2mm;display:flex;align-items:center;gap:5mm;padding:0 6mm;overflow:hidden;white-space:nowrap;width:100%}
.wb3 .wb-m{width:7mm;flex:none}.wb3 .wb-m.tt{width:10mm}
.wb3 .wb-m .lk,.wb3 .wb-n .lk{width:100%;height:auto}
.wb3 .wb-n{width:40mm;flex:none}.wb3 .wb-n.wide{width:48mm}
.wb3 b{margin-left:auto;font-stretch:118%;font-weight:600;font-size:6.6pt;letter-spacing:.2em;text-transform:uppercase}
.cmp3s{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:8mm}
.cmp3{background:var(--paper);border-radius:3mm;padding:7mm;display:flex;flex-direction:column;gap:6mm}
.cmp3-art{height:72mm;display:grid;place-items:center}
.cmp3-art .lk{width:auto;max-width:100%;height:auto;max-height:54mm}
.cmp3-row{display:grid;grid-template-columns:16mm 1fr;gap:4mm;align-items:center}
.cmp3-ic{width:16mm;height:16mm;border-radius:22.5%;overflow:hidden}.cmp3-ic .ic{width:100%;height:100%}
.cmp3-row b{display:block;font-size:9.5pt}
.cmp3-row span{font-size:8pt;color:var(--muted)}
.rec3{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:14mm;align-items:center}
.rec3-art{background:var(--paper);border-radius:3mm;height:120mm;display:grid;place-items:center;padding:14mm}
.rec3-art .lk{width:100%;height:auto}
.why3{margin:6mm 0 0;padding-left:4.5mm;font-size:9.2pt;line-height:1.55;color:#3a3733}
.why3 li{margin-bottom:2mm}
"""
