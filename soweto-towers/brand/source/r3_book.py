"""Round-3 presentation: three standalone identities, A4 landscape.

Editorial layout: full-bleed fields instead of boxes, hairline rules, a
light numeral for each option, and mockups lit on a studio surface."""
import base64, random
from geom import f
import vec
from kit import Art, tile, TT, BLACK, BONE, WHITE

DATE = "November 2026"


def inl(art, way, cls="lk", pad=None, label="Soweto Towers"):
    s = art.svg(way, art.h * 0.02 if pad is None else pad, title=label)
    return s.replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ", f'<svg class="{cls}" ', 1)


def tone(art, color, cls="deco"):
    return inl(art, {"ink": color, "acc": color}, cls, 0, "")


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


# ------------------------------------------------------------------ construction drawings
def con_monogram(mono, red):
    g = mono.geo
    Rt, Rb, w, xs, top, base = g["Rt"], g["Rb"], g["w"], g["xs"], g["top"], g["base"]
    pad = 28
    vb = f"{f(-Rb - pad)} {f(top - pad)} {f(g['bar_end'] + Rb + 2 * pad)} {f(base - top + 2 * pad)}"
    con = (f'<circle cx="0" cy="{f(-Rt)}" r="{f(Rt)}"/><circle cx="0" cy="{f(Rb)}" r="{f(Rb)}"/>'
           f'<line x1="{f(-Rb - 18)}" y1="{f(top)}" x2="{f(g["bar_end"] + 18)}" y2="{f(top)}"/>'
           f'<line x1="{f(-Rb - 18)}" y1="{f(base)}" x2="{f(g["bar_end"] + 18)}" y2="{f(base)}"/>'
           f'<line x1="{f(xs)}" y1="{f(top - 16)}" x2="{f(xs)}" y2="{f(base + 16)}"/>')
    labels = (lab(g["bar_end"], top - w / 2 - 5, "bridge", "end") + lab(xs + w, base - g["short"] + 2, "drop") +
              lab(-Rb, top - w / 2 - 5, f"Rt = {Rt / Rb:.2f} Rb") + lab(xs + w, top + w / 2 + w * 0.5 + 3, "½ w cut"))
    return (f'<svg class="con" viewBox="{vb}" role="img" aria-label="Construction of the monogram">'
            f'<g fill="none" stroke="rgba(243,239,231,.2)" stroke-width=".35" stroke-dasharray="1.6 1.6">{con}</g>'
            f'{mono.body({"ink": "rgba(243,239,231,.08)", "acc": "rgba(200,16,46,.28)"})}'
            f'<g fill="none" stroke="{BONE}" stroke-width=".4">' + "".join(f'<path d="{d}"/>' for _, d, _ in mono.items) +
            f'</g><g font-size="4.6" fill="rgba(243,239,231,.8)" style="font-stretch:110%;letter-spacing:.04em">{labels}</g></svg>')


def con_tower_t(make, red):
    x0, x1, lo, cap = TT["bar"]
    k = 0.2
    parts = make(k, 0)
    sh = (lo - 20) * k
    hs = TT["stem"] / 2 * k
    cx = TT["cx"] * k
    R = x1 * k + 26
    rows = [(-cap * k + 11, x1 * k + 4, "Crossbar: the bridge"), (-lo * k + 2.2, cx + hs * 1.3, "One cut"),
            (-sh * 0.72, cx + hs * 0.86 + 3, "Waist at 72%"), (-3, cx + hs * 2.35 + 3, "Base: 2.35 × the stem")]
    ln = "".join(f'<line x1="{f(xa)}" y1="{f(y)}" x2="{f(R)}" y2="{f(y)}"/>' for y, xa, _ in rows)
    tx = "".join(lab(R + 3, y + 2, t) for y, _, t in rows)
    return (f'<svg class="con" viewBox="-10 {f(-cap * k - 16)} {f(x1 * k + 130)} {f(cap * k + 32)}" role="img" aria-label="Construction of the tower T">'
            + "".join(f'<path d="{d}" fill="rgba(243,239,231,.1)" stroke="{BONE}" stroke-width=".4"/>' for d in parts)
            + f'<g stroke="{red}" stroke-width=".4">{ln}</g><g font-size="5.4" fill="rgba(243,239,231,.85)" style="font-stretch:110%;letter-spacing:.04em">{tx}</g></svg>')


def con_loop(lp, red):
    g = lp.geo
    r, D, a = g["r"], g["D"], g["a"]
    p1 = vec.pt(-D, 0, r, -90 + a)
    dx, dy = -p1[0], p1[1]
    L = 2.2
    return (f'<svg class="con" viewBox="{f(-D - r - 32)} {f(-r - 34)} {f(2 * D + 2 * r + 64)} {f(2 * r + 68)}" role="img" aria-label="Construction of the Loop">'
            f'<g fill="none" stroke="rgba(243,239,231,.2)" stroke-width=".35" stroke-dasharray="1.6 1.6">'
            f'<circle cx="{f(-D)}" cy="0" r="{f(r)}"/><circle cx="{f(D)}" cy="0" r="{f(r)}"/>'
            f'<line x1="{f(dx * L)}" y1="{f(dy * L)}" x2="{f(-dx * L)}" y2="{f(-dy * L)}"/>'
            f'<line x1="{f(-D - r - 22)}" y1="0" x2="{f(D + r + 22)}" y2="0"/></g>'
            f'{lp.body({"ink": "rgba(200,16,46,.26)", "acc": "rgba(200,16,46,.26)"})}'
            f'<g fill="none" stroke="#e0485f" stroke-width=".45">' + "".join(f'<path d="{d}"/>' for _, d, _ in lp.items) + "</g>"
            f'<circle cx="{f(-D)}" cy="0" r=".9" fill="{BONE}"/><circle cx="{f(D)}" cy="0" r=".9" fill="{BONE}"/>'
            f'<g font-size="5" fill="rgba(243,239,231,.85)" style="font-stretch:110%;letter-spacing:.04em">{lab(-D, r + 18, "rim", "middle")}{lab(D, r + 18, "rim", "middle")}'
            f'{lab(0, -r - 15, "bridge", "middle")}</g></svg>')


# ------------------------------------------------------------------ render
def render(opts, P, font_path, WAYS, PAL, tower_t):
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()
    RED, PAPER = PAL["red"], PAL["paper"]
    COL, REV, MW, MB = WAYS["colour"], WAYS["reverse"], WAYS["white"], WAYS["black"]
    BONE_ONLY = {"ink": BONE, "acc": BONE}
    o1, o2, o3 = opts
    pages = []

    def page(body, n, cls="", dark=False):
        foot = (f'<footer class="pf"><span>Soweto Towers · Identity options</span><span class="pn">{n:02d}</span></footer>' if n else "")
        pages.append(f'<div class="pw"><section class="page {cls}{" dark" if dark else ""}">{body}{foot}</section></div>')

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
    marks = "".join(f'<div class="cv-m">{inl(o["sym"], sym_rev[o["n"]], "lk")}</div>' for o in opts)
    page(f"""<div class="cv-top"><span>Soweto Towers</span><span>Identity options</span></div>
      <div class="cv-mid"><div class="cv-ms">{marks}</div></div>
      <div class="cv-bot"><h1>Three ways to<br>say <em>Soweto Towers.</em></h1><span>Round 3 · {DATE}</span></div>""", 0, "cover", dark=True)

    # ============================================================== intro
    cols = "".join(f'<div class="in-c"><div class="in-art">{inl(o["sym"], COL, "lk")}</div><span class="num">0{o["n"]}</span>'
                   f'<h3>{o["title"]}</h3><p>{o["line"]}</p></div>' for o in opts)
    page(f"""<div class="intro"><p class="kicker">How to read this</p>
      <h2 class="display">Three complete identities,<br>judged side by side.</h2>
      <p class="lede">The Loop now stands on its own. Each option is shown whole: the mark and how it is drawn, its colours and app icon, and the same printed and digital pieces. One palette and one typeface run through all three, so you are comparing ideas, not decoration.</p></div>
      <div class="in-cols">{cols}</div>""", 2, "pad")

    # ============================================================== option pages
    for o in opts:
        n0 = 3 + (o["n"] - 1) * 5
        num = f"0{o['n']}"
        sym, prim, alt, altd, name = o["sym"], o["primary"], o["alt"], o["alt_desc"], o["name"]

        # (a) hero: the mark on a full-bleed paper field
        page(f"""<div class="split"><div class="field paper"><div class="hero-art">{inl(prim, COL)}</div></div>
          <div class="col"><p class="kicker">Option</p><div class="numeral">{num}</div>
          <h2 class="title">{o['title']}</h2><p class="line">{o['line']}</p><hr>
          <p class="body">{o['idea']}</p>
          <div class="sw2"><div><h4>Strength</h4><p>{o['strength']}</p></div><div><h4>Watch out</h4><p>{o['watch']}</p></div></div></div></div>""", n0)

        # (b) construction + lockups
        con = (con_monogram(sym, RED) if o["n"] == 1 else con_tower_t(tower_t, RED) if o["n"] == 2 else con_loop(sym, RED))
        nm = o["names"]
        third = ((o["upright"], "Upright", "Square spaces and the app icon. Turned on end, the Loop is the S of Soweto.")
                 if o["n"] == 3 else (sym, "Monogram" if o["n"] == 1 else "Tower-T pair", "App icon, favicon, stamps and embroidery."))
        rows = [(alt, nm["alt"], "For wide spaces: website header, email, vehicles." if o["n"] != 2 else "For square and portrait formats: posters, social, merchandise."),
                (altd, nm["alt_desc"], "Where people meet the brand for the first time: signs, print, press."),
                third]
        rows_html = "".join(f'<div class="lr"><div class="lr-art">{inl(a, COL)}</div><div class="lr-t"><h4>{t}</h4><p>{d}</p></div></div>' for a, t, d in rows)
        page(f"""<div class="split s-dark"><div class="field dark"><div class="con-wrap">{con}</div><p class="field-cap">Construction</p></div>
          <div class="col top"><p class="kicker">{num} · {o['title']}</p><h2 class="title sm">The system</h2><div class="lrs">{rows_html}</div></div></div>""", n0 + 1)

        # (c) colour fields
        sizes = "".join(f'<figure class="isz"><div style="width:{z}px;height:{z}px">{icon_svg(o)}</div><figcaption>{z}</figcaption></figure>' for z in (96, 60, 32, 16))
        page(f"""<div class="cgrid">
          <div class="cf c-bone">{inl(prim, COL)}<span>Full colour on Bone</span></div>
          <div class="cf c-black">{inl(prim, REV)}<span>Reverse on Tower Black</span></div>
          <div class="cf c-red">{inl(prim, MW)}<span>White on Crimson</span></div>
          <div class="cf c-white">{inl(prim, MB)}<span>One colour</span></div>
          <div class="cf c-studio"><div class="isizes">{sizes}</div><span>App icon · 96 to 16 px</span></div>
        </div><p class="kicker over">{num} · {o['title']} · Colour</p>""", n0 + 2, "full")

        # (d) print on the studio surface
        if o["n"] == 1:
            front = f'<div class="bc front">{inl(sym, COL, "bc-mono")}<div class="bc-name">{inl(name, COL)}</div></div>'
            deco = f'<div class="bc-deco" style="right:-16mm;top:-8mm;width:56mm">{tone(sym, "#1f1d1a")}</div>'
            mark = f'<div class="bc-mk" style="width:8mm">{inl(sym, REV, "lk")}</div>'
        elif o["n"] == 2:
            front = f'<div class="bc front center"><div style="width:60mm">{inl(prim, COL)}</div></div>'
            deco = f'<div class="bc-deco" style="right:-4mm;top:-10mm;width:46mm">{tone(sym, "#1f1d1a")}</div>'
            mark = f'<div class="bc-mk" style="width:13mm">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</div>'
        else:
            front = f'<div class="bc front center"><div style="width:36mm">{inl(prim, COL)}</div></div>'
            deco = f'<div class="bc-pat" style="background-image:url({PAT_DARK})"></div>'
            mark = f'<div class="bc-mk" style="width:15mm">{inl(sym, REV, "lk")}</div>'
        back = (f'<div class="bc back">{deco}<div class="bc-txt"><b>Name Surname</b><span>Role</span>'
                f'<span class="gap">+27 71 674 4343</span><span>info@sowetotowers.co.za</span><span>sowetotowers.co.za</span>'
                f'<span class="gap">Cnr Sheffield Rd &amp; Chris Hani Rd<br>Orlando East, Soweto</span></div>{mark}</div>')
        vh = {1: "15mm", 2: "10mm", 3: "11mm"}[o["n"]]
        voucher = (f'<div class="vch"><div class="vch-main"><div class="vch-top"><div style="height:{vh}">{inl(sym, sym_rev[o["n"]], "lk vsym")}</div>'
                   f'{inl(P["Bungee"], {"ink": BONE, "acc": RED}, "vp", 0, "Bungee")}</div>'
                   f'<div class="vch-act"><small>Activity voucher</small>Bungee jump</div>'
                   f'<div class="vch-row"><span>Height<b>100 m</b></span><span>From<b>The bridge</b></span><span>Valid<b>365 days</b></span></div></div>'
                   f'<div class="vch-stub">{qr(BLACK)}<span>Admit one</span></div></div>')
        if o["n"] == 1:
            band = f'<div class="wb" style="background:{RED};color:{BONE}"><span class="wb-s" style="width:6mm">{inl(sym, {"ink": BONE, "acc": BLACK}, "lk")}</span><span class="wb-n">{inl(name, BONE_ONLY, "lk")}</span><b>Bungee</b></div>'
        elif o["n"] == 2:
            band = f'<div class="wb" style="background:{BLACK};color:{BONE}"><span class="wb-n wide">{inl(name, BONE_ONLY, "lk")}</span><span class="wb-s" style="width:9mm">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</span><b>Bungee</b></div>'
        else:
            band = f'<div class="wb" style="background-color:{RED};background-image:url({PAT_RED});background-size:24mm;color:{BONE}"><span class="wb-n">{inl(name, BONE_ONLY, "lk")}</span><b>Bungee</b></div>'
        page(f"""<div class="studio"><div class="st-print">
            <div class="p-cards"><div class="bc-a">{back}</div><div class="bc-b">{front}</div></div>
            <div class="p-vch">{voucher}</div>
            <div class="p-band">{band}</div>
          </div></div>
          <p class="kicker over">{num} · {o['title']} · Print</p>
          <p class="caps"><span>Business cards, 85 × 55 mm</span><span>Activity voucher</span><span>Wristband</span></p>""", n0 + 3, "full")

        # (e) digital on the studio surface
        chips = "".join(f'<span><i style="background:{c}"></i>{t}</span>' for t, c in (("Bungee", "#e0485f"), ("SCAD freefall", "#7ea3d1"), ("Zipline", PAL["gold"]), ("Paintball", "#79a88d")))
        wdeco = {1: f'<div class="w-deco" style="right:-12mm;bottom:-24mm;width:84mm">{tone(sym, "#1f1d1a")}</div>',
                 2: f'<div class="w-deco" style="right:10mm;bottom:10mm;width:64mm">{tone(sym, "#1f1d1a")}</div>',
                 3: f'<div class="w-deco" style="right:-16mm;bottom:4mm;width:100mm">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</div>'}[o["n"]]
        browser = (f'<div class="browser"><div class="b-bar"><i></i><i></i><i></i><span>sowetotowers.co.za</span></div>'
                   f'<div class="site"><div class="s-nav">{inl(nav[o["n"]], REV, "s-logo")}<ul><li>Adventures</li><li>Plan your visit</li><li>Groups</li></ul><span class="btn">Buy a voucher</span></div>'
                   f'<div class="s-hero">{wdeco}<h4>Jump from Soweto’s skyline.</h4><p>Bungee, SCAD freefall, zipline and paintball at the Orlando cooling towers.</p><div class="chips">{chips}</div></div></div></div>')
        apps = "".join(f'<div class="app"><div class="aic">{icon_svg(o)}</div><span>Soweto Towers</span></div>' if i == 5
                       else '<div class="app"><div class="aic ph"></div><span></span></div>' for i in range(16))
        phone = f'<div class="phone"><div class="ph-grid">{apps}</div></div>'
        if o["n"] == 1:
            post = f'<div class="post" style="background:{RED}"><div class="post-in"><div style="height:16mm">{inl(sym, {"ink": BONE, "acc": BLACK}, "lk")}</div><b>Open Friday to Sunday, 10:00 until sunset.</b><span>sowetotowers.co.za</span></div></div>'
        elif o["n"] == 2:
            post = f'<div class="post" style="background:{BLACK}"><div class="post-in"><div style="height:11mm">{inl(sym, {"ink": RED, "acc": RED}, "lk")}</div><b>Open Friday to Sunday, 10:00 until sunset.</b><span>sowetotowers.co.za</span></div></div>'
        else:
            post = f'<div class="post" style="background:{BLACK}"><div class="post-in"><div style="height:13mm">{inl(sym, REV, "lk")}</div><b>Open Friday to Sunday, 10:00 until sunset.</b><span>sowetotowers.co.za</span></div></div>'
        page(f"""<div class="studio"><div class="st-dig"><div class="d-web">{browser}</div><div class="d-phone">{phone}</div><div class="d-post">{post}</div></div></div>
          <p class="kicker over">{num} · {o['title']} · Digital</p>
          <p class="caps"><span>Website</span><span>App icon</span><span>Social post</span></p>""", n0 + 4, "full")

    # ============================================================== side by side
    cmp_ = "".join(f'<div class="cmp"><div class="cmp-art">{inl(o["primary"], COL)}</div><div class="cmp-ic">{icon_svg(o)}</div>'
                   f'<span class="num">0{o["n"]}</span><h3>{o["title"]}</h3><p>{o["strength"]}</p></div>' for o in opts)
    page(f"""<p class="kicker abs">Side by side</p><div class="cmps">{cmp_}</div>""", 18, "full")

    # ============================================================== recommendation
    page(f"""<div class="split rev"><div class="col"><p class="kicker">Recommendation</p>
      <h2 class="display sm">Option 01,<br>the S + T monogram.</h2>
      <p class="body">It is the most ownable of the three: initials nobody else has, with the bridge and the drop drawn into the letters. It holds from a browser tab to the gate, and gives the brand a symbol that travels on wristbands, caps and the app.</p>
      <hr><div class="sw2"><div><h4>Choose 02</h4><p>for the quietest, most timeless identity, where the name itself carries the idea.</p></div>
      <div><h4>Choose 03</h4><p>for the boldest: one crimson line, a pattern, and the most energy on social and merchandise.</p></div></div>
      <p class="body next">Pick one, and it becomes the full system: artwork in every format, icons, pictograms, signage and guidelines.</p></div>
      <div class="field paper"><div class="hero-art">{inl(o1["primary"], COL)}</div></div></div>""", 19)

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
:root{--red:%RED%;--black:#151412;--bone:#F3EFE7;--paper:%PAPER%;--ink2:#4a4640;--muted:#8a847b;--hair:rgba(21,20,18,.14);--s:1}
*{box-sizing:border-box}
html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Archivo",sans-serif;color:var(--black);background:#cfc8bc;-webkit-font-smoothing:antialiased;font-kerning:normal}
svg{display:block;max-width:100%}
@media screen{
  body{padding:28px 0}
  .pw{width:calc(297mm * var(--s));height:calc(210mm * var(--s));margin:0 auto 24px;box-shadow:0 1px 2px rgba(0,0,0,.08),0 18px 40px rgba(0,0,0,.16);overflow:hidden}
  .page{transform:scale(var(--s));transform-origin:0 0}
}
@media print{.pw{width:297mm;height:210mm}}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;background:var(--bone);break-after:page;page-break-after:always}
.pw:last-child .page{break-after:auto;page-break-after:auto}
.page.pad{padding:22mm 22mm 0}
.dark{background:var(--black);color:var(--bone)}
.pf{position:absolute;right:14mm;bottom:9mm;display:flex;gap:6mm;align-items:baseline;font-stretch:118%;font-weight:450;font-size:5.6pt;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}
.pf .pn{color:var(--black);letter-spacing:.1em}
.full .pf{right:14mm;bottom:7mm}
.kicker{margin:0;font-stretch:118%;font-weight:450;font-size:6pt;letter-spacing:.26em;text-transform:uppercase;color:var(--muted)}
.kicker.over{position:absolute;left:14mm;top:10mm}
.cgrid + .kicker.over{display:none}
.kicker.abs{position:absolute;left:22mm;top:20mm}
h1,h2,h3,h4{margin:0;font-weight:500;letter-spacing:-.02em}
.display{font-size:30pt;line-height:1.06;letter-spacing:-.035em;font-weight:450;margin-top:5mm}
.display.sm{font-size:27pt}
.lede{font-size:10.5pt;line-height:1.6;color:var(--ink2);max-width:130mm;margin:7mm 0 0;font-weight:380}
.body{font-size:8.8pt;line-height:1.65;color:var(--ink2);margin:0;font-weight:380}
hr{border:0;border-top:.2mm solid var(--hair);margin:7mm 0}
h4{font-stretch:118%;font-weight:500;font-size:5.8pt;letter-spacing:.24em;text-transform:uppercase;color:var(--black)}

/* cover */
.cover{padding:14mm 18mm}
.cv-top{display:flex;justify-content:space-between;font-stretch:118%;font-weight:450;font-size:6pt;letter-spacing:.26em;text-transform:uppercase;color:rgba(243,239,231,.6)}
.cv-mid{position:absolute;left:0;right:0;top:50mm;display:grid;place-items:center}
.cv-ms{display:flex;gap:30mm;align-items:center}
.cv-m .lk{height:20mm;width:auto}
.cv-bot{position:absolute;left:18mm;right:18mm;bottom:16mm;display:flex;justify-content:space-between;align-items:flex-end}
.cv-bot h1{font-size:34pt;line-height:1.05;letter-spacing:-.035em;font-weight:400}
.cv-bot h1 em{font-style:normal;color:var(--red)}
.cv-bot span{font-stretch:118%;font-size:6pt;letter-spacing:.26em;text-transform:uppercase;color:rgba(243,239,231,.6)}

/* intro */
.intro{max-width:200mm}
.in-cols{position:absolute;left:22mm;right:22mm;bottom:24mm;display:grid;grid-template-columns:repeat(3,1fr);gap:0}
.in-c{padding:0 8mm;border-left:.2mm solid var(--hair)}
.in-c:first-child{padding-left:0;border-left:0}
.in-art{height:30mm;display:flex;align-items:center;margin-bottom:8mm}
.in-art .lk{height:100%;width:auto;max-width:100%}
.num{display:block;font-weight:250;font-size:18pt;letter-spacing:-.02em;color:var(--red);margin-bottom:2mm}
.in-c h3{font-size:12pt}
.in-c p{margin:1.5mm 0 0;font-size:8.6pt;color:var(--ink2)}

/* split pages */
.split{position:absolute;inset:0;display:grid;grid-template-columns:172mm 1fr}
.split.rev{grid-template-columns:1fr 150mm}
.field{position:relative;display:grid;place-items:center}
.field.paper{background:var(--paper)}
.field.dark{background:var(--black)}
.hero-art{width:118mm}
.hero-art .lk{width:100%;height:auto;max-height:92mm}
.col{padding:22mm 16mm 22mm 14mm;display:flex;flex-direction:column;justify-content:center}
.col.top{justify-content:flex-start}
.split.rev .col{padding-left:22mm;padding-right:16mm}
.numeral{font-weight:200;font-size:64pt;line-height:.9;letter-spacing:-.04em;color:var(--red);margin:2mm 0 6mm}
.title{font-size:22pt;letter-spacing:-.03em;font-weight:500}
.title.sm{font-size:16pt;margin:3mm 0 4mm}
.line{font-size:10pt;color:var(--muted);margin:2mm 0 0}
.sw2{display:grid;grid-template-columns:1fr 1fr;gap:6mm}
.sw2 p{margin:2mm 0 0;font-size:7.8pt;line-height:1.6;color:var(--ink2)}
.col .body + .sw2{margin-top:8mm}
.col .display + .body{margin-top:7mm}
.next{margin-top:8mm}
.con-wrap{width:128mm}
.con{width:100%;height:auto}
.con text{font-family:"Archivo",sans-serif}
.field-cap{position:absolute;left:14mm;bottom:9mm;margin:0;font-stretch:118%;font-size:5.6pt;letter-spacing:.26em;text-transform:uppercase;color:rgba(243,239,231,.45)}
.lrs{border-top:.2mm solid var(--hair)}
.lr{display:grid;grid-template-columns:1fr;gap:3mm;padding:6mm 0;border-bottom:.2mm solid var(--hair)}
.lr-art{height:24mm;display:flex;align-items:center}
.lr-art .lk{height:100%;width:auto;max-width:100%}
.lr-t p{margin:1.4mm 0 0;font-size:7.6pt;line-height:1.55;color:var(--ink2)}

/* colour fields */
.cgrid{position:absolute;inset:0;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:.6mm;background:#d9d2c6}
.cf{position:relative;display:grid;place-items:center}
.cf .lk{width:auto;max-width:72%;height:auto;max-height:40mm}
.cf span{position:absolute;left:8mm;top:8mm;font-stretch:118%;font-size:5.6pt;letter-spacing:.24em;text-transform:uppercase;opacity:.7}
.c-bone{background:var(--bone);grid-column:span 2}
.c-bone .lk{max-height:52mm;max-width:62%}
.c-black{background:var(--black);color:var(--bone)}
.c-red{background:var(--red);color:#fff}
.c-white{background:#fff}
.c-studio{background:radial-gradient(130% 110% at 30% 15%,#f1ece3 0%,#e4ddd1 60%,#d8d0c3 100%)}
.isizes{display:flex;align-items:flex-end;gap:5mm}
.isz{margin:0;display:flex;flex-direction:column;align-items:center;gap:1.6mm}
.isz div{border-radius:22.5%;overflow:hidden;box-shadow:0 .2mm .5mm rgba(0,0,0,.12),0 2mm 5mm rgba(0,0,0,.1)}
.isz .ic{width:100%;height:100%}
.isz figcaption{font-size:5pt;color:var(--muted)}
.c-studio span{color:var(--black)}

/* studio */
.studio{position:absolute;inset:0;background:radial-gradient(120% 100% at 28% 12%,#f2ede5 0%,#e6dfd3 50%,#d6cec1 100%)}
.bc,.vch,.wb,.browser,.phone,.post{box-shadow:0 .2mm .5mm rgba(30,22,12,.1),0 3mm 7mm rgba(30,22,12,.12),0 12mm 26mm rgba(30,22,12,.12)}
.caps{position:absolute;left:14mm;right:40mm;bottom:7mm;margin:0;display:flex;gap:10mm;font-size:5.6pt;letter-spacing:.24em;text-transform:uppercase;font-stretch:118%;color:var(--muted)}
.st-print{position:absolute;inset:0}
.p-cards{position:absolute;left:22mm;top:30mm;width:120mm;height:110mm}
.bc{width:85mm;height:55mm;border-radius:.8mm;position:absolute;overflow:hidden}
.bc-a{position:absolute;left:0;top:0;transform:rotate(-7deg)}
.bc-b{position:absolute;left:30mm;top:52mm;transform:rotate(4deg)}
.bc.front{background:var(--paper)}
.bc.center{display:grid;place-items:center}
.bc-mono{position:absolute;left:7mm;top:7mm;width:11mm;height:auto}
.bc-name{position:absolute;left:7mm;bottom:7mm;width:44mm}.bc-name .lk{width:100%;height:auto}
.bc.center .lk{width:100%;height:auto}
.bc.back{background:var(--black);color:var(--bone)}
.bc-deco{position:absolute}.bc-deco .deco{width:100%;height:auto}
.bc-pat{position:absolute;inset:0;background-size:28mm}
.bc-txt{position:absolute;left:7mm;top:7mm;display:flex;flex-direction:column;font-size:5.6pt;line-height:1.55;z-index:1}
.bc-txt b{font-size:7pt;font-weight:500}
.bc-txt .gap{margin-top:2.2mm}
.bc-mk{position:absolute;right:7mm;bottom:7mm}.bc-mk .lk{width:100%;height:auto}
.p-vch{position:absolute;right:20mm;top:26mm;transform:rotate(2.5deg)}
.vch{display:grid;grid-template-columns:1fr 32mm;width:128mm;height:76mm;background:var(--black);color:var(--bone);border-radius:2.5mm;overflow:hidden}
.vch-main{padding:7mm;display:flex;flex-direction:column;justify-content:space-between}
.vch-top{display:flex;justify-content:space-between;align-items:flex-start}
.vsym{height:100%;width:auto}.vp{width:9mm;height:9mm}
.vch-act{font-weight:450;font-size:20pt;letter-spacing:-.03em;line-height:1}
.vch-act small{display:block;font-stretch:118%;font-weight:450;font-size:5.4pt;letter-spacing:.26em;text-transform:uppercase;color:#e0485f;margin-bottom:2.4mm}
.vch-row{display:flex;gap:7mm;font-size:5.6pt;color:rgba(243,239,231,.6)}
.vch-row b{display:block;font-size:7.4pt;font-weight:500;color:var(--bone)}
.vch-stub{background:var(--red);padding:6mm 5mm;display:flex;flex-direction:column;justify-content:space-between;border-left:.5mm dashed rgba(21,20,18,.4)}
.code{width:22mm;height:22mm}
.vch-stub span{font-stretch:118%;font-size:5.4pt;letter-spacing:.24em;text-transform:uppercase;color:#fff}
.p-band{position:absolute;right:20mm;top:124mm;width:150mm;transform:rotate(-2deg)}
.wb{height:19mm;border-radius:1.6mm;display:flex;align-items:center;gap:5mm;padding:0 7mm;overflow:hidden;white-space:nowrap}
.wb-s{flex:none}.wb-s .lk,.wb-n .lk{width:100%;height:auto}
.wb-n{width:38mm;flex:none}.wb-n.wide{width:46mm}
.wb b{margin-left:auto;font-stretch:118%;font-weight:500;font-size:5.6pt;letter-spacing:.26em;text-transform:uppercase}

/* digital */
.st-dig{position:absolute;inset:0}
.d-web{position:absolute;left:16mm;top:26mm;width:166mm}
.browser{border-radius:2.4mm;overflow:hidden;background:var(--black)}
.b-bar{height:7mm;background:#2a2724;display:flex;align-items:center;gap:1.6mm;padding:0 3.4mm}
.b-bar i{width:2mm;height:2mm;border-radius:50%;background:rgba(243,239,231,.22)}
.b-bar span{margin:0 auto;font-size:4.8pt;color:rgba(243,239,231,.55);background:rgba(243,239,231,.08);padding:.8mm 8mm;border-radius:1.4mm}
.site{color:var(--bone)}
.s-nav{display:flex;align-items:center;gap:6mm;padding:4.5mm 7mm;border-bottom:.2mm solid rgba(243,239,231,.08)}
.s-logo{height:8mm;width:auto;max-width:58mm}
.s-nav ul{display:flex;gap:5mm;list-style:none;margin:0 0 0 auto;padding:0;font-size:5.8pt;color:rgba(243,239,231,.75)}
.btn{background:var(--red);color:#fff;font-size:5.6pt;font-weight:500;padding:1.8mm 3.4mm;border-radius:10mm}
.s-hero{position:relative;overflow:hidden;height:106mm;padding:16mm 9mm}
.s-hero > *:not(.w-deco){position:relative;z-index:1}
.w-deco{position:absolute}.w-deco .lk,.w-deco .deco{width:100%;height:auto}
.s-hero h4{font-weight:450;font-size:22pt;line-height:1.04;letter-spacing:-.035em;text-transform:none;font-stretch:100%;color:var(--bone);max-width:90mm}
.s-hero p{font-size:6.8pt;line-height:1.6;color:rgba(243,239,231,.7);max-width:70mm;margin:4mm 0 6mm}
.chips{display:flex;flex-wrap:wrap;gap:1.8mm;max-width:100mm}
.chips span{display:inline-flex;align-items:center;gap:1.6mm;font-size:5.4pt;padding:1.6mm 3mm;border-radius:10mm;background:rgba(243,239,231,.07);color:rgba(243,239,231,.85)}
.chips i{width:1.8mm;height:1.8mm;border-radius:50%}
.d-phone{position:absolute;left:193mm;top:22mm}
.phone{width:46mm;height:96mm;border-radius:7mm;background:linear-gradient(165deg,#2c2925,#11100e);padding:12mm 3.6mm 3mm;outline:1.2mm solid #151412}
.ph-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:2.8mm 2mm}
.app{display:flex;flex-direction:column;align-items:center;gap:.8mm;min-width:0}
.aic{width:100%;aspect-ratio:1;border-radius:23%;overflow:hidden}
.aic .ic{width:100%;height:100%}
.aic.ph{background:rgba(243,239,231,.08)}
.app span{font-size:3.2pt;color:#eee;white-space:nowrap;min-height:4mm}
.d-post{position:absolute;left:229mm;top:112mm;transform:rotate(3deg)}
.post{width:54mm;height:54mm;border-radius:1.6mm;display:grid;place-items:center}
.post-in{display:flex;flex-direction:column;align-items:center;gap:4mm;text-align:center;color:var(--bone);padding:6mm}
.post-in .lk{height:100%;width:auto}
.post-in b{font-weight:450;font-size:10pt;line-height:1.15;letter-spacing:-.02em}
.post-in span{font-size:5pt;letter-spacing:.06em;opacity:.7}

/* compare */
.cmps{position:absolute;left:22mm;right:22mm;top:38mm;bottom:26mm;display:grid;grid-template-columns:repeat(3,1fr)}
.cmp{padding:0 9mm;border-left:.2mm solid var(--hair);display:flex;flex-direction:column}
.cmp:first-child{padding-left:0;border-left:0}
.cmp-art{height:66mm;display:flex;align-items:center}
.cmp-art .lk{width:auto;max-width:100%;height:auto;max-height:44mm}
.cmp-ic{width:14mm;height:14mm;border-radius:22.5%;overflow:hidden;margin:4mm 0 8mm;box-shadow:0 .2mm .5mm rgba(0,0,0,.12),0 2mm 5mm rgba(0,0,0,.1)}
.cmp-ic .ic{width:100%;height:100%}
.cmp h3{font-size:12pt}
.cmp p{margin:2mm 0 0;font-size:7.8pt;line-height:1.6;color:var(--ink2)}
"""
