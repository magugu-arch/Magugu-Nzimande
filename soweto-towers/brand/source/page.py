"""Brand guidelines page for the Soweto Towers identity (self-contained HTML)."""
import base64, math, random
from geom import f

SEC = {"sky": "#1D5FD0", "gold": "#F2B33D", "green": "#1F8A5B", "concrete": "#8F8A82"}


def lum(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def spring_easing(damping=0.5, response=0.75, duration=1.8, n=60):
    """CSS linear() samples of an under-damped spring. A bungee jump is the one
    place a bounce is earned: the motion carries real momentum."""
    w0 = 2 * math.pi / response
    wd = w0 * math.sqrt(1 - damping ** 2)
    pts = []
    for i in range(n + 1):
        t = duration * i / n
        x = 1 - math.exp(-damping * w0 * t) * (math.cos(wd * t) + damping * w0 / wd * math.sin(wd * t))
        pts.append(f"{x:.4f}")
    pts[-1] = "1"
    return "linear(" + ", ".join(pts) + ")"


def render(parts, forms, main, small, colours, meta, font_path, files):
    C = colours
    RED, BLACK, BONE, WHITE = C["red"], C["black"], C["bone"], C["white"]
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()
    m = main
    W, Ht, B, H = m.W, m.Ht, m.B, m.H
    hyp = m.hyp
    L = m.layers()
    towers = [d for r, d in L if r == "tw"][:-1]      # tower slices (bridge is last 'tw')
    bridge = m.bridge_d()
    jump = m.jump_d()

    # ---------------- shared defs ------------------------------------------------------
    role_style = {"tee": "fill:var(--tee)", "tw": "fill:var(--tw)", "ink": "fill:var(--ink)"}
    defs = []
    for name, p in parts.items():
        inner = "".join(f'<path style="{role_style[r]}" d="{d}"/>' for r, d in p.layers)
        defs.append(f'<g id="p-{name}">{inner}</g>')
    DEFS = f'<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>{"".join(defs)}</defs></svg>'

    def way(tee, tw, ink=None):
        return f"--tee:{tee};--tw:{tw};--ink:{ink or tw}"

    def uses(fname):
        out = []
        for it in forms[fname]["items"]:
            sx, sy = it["shift"]
            k = it["k"]
            sc = f" scale({f(k)})" if k != 1 else ""
            out.append(f'<use href="#p-{it["part"].name}" transform="translate({f(it["x"] + sx * k)} {f(it["y"] + sy * k)}){sc}"/>')
        return "".join(out)

    def form_svg(fname, style, cls="", label="Soweto Towers"):
        fm = forms[fname]
        ov = 0.02 * fm["h"]
        return (f'<svg class="{cls}" viewBox="0 {f(-ov)} {f(fm["w"])} {f(fm["h"] + 2 * ov)}" style="{style}" '
                f'role="img" aria-label="{label}">{uses(fname)}</svg>')

    def mark_svg(style, cls="", small_master=False, label="Soweto Towers mark", size=None):
        mm = small if small_master else main
        pid = "mark-small" if small_master else "mark"
        a11y = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
        dims = f' width="{size}" height="{f(size * mm.Ht / mm.W)}"' if size else ""
        return (f'<svg class="{cls}"{dims} viewBox="0 0 {f(mm.W)} {f(mm.Ht)}" style="{style}" '
                f'{a11y}><use href="#p-{pid}"/></svg>')

    # ---------------- cover: stacked lockup with the jump animated -----------------------
    sd = forms["stacked-descriptor"]
    mk_item = sd["items"][0]
    mx = mk_item["x"]
    ov = 0.02 * sd["h"]
    text_uses = "".join(
        f'<use href="#p-{it["part"].name}" transform="translate({f(it["x"] + it["shift"][0])} {f(it["y"] + it["shift"][1])})"/>'
        for it in sd["items"][1:])
    drop_from = m.dot_y + m.dot_r + 2
    cover = (
        f'<svg class="cover-logo" viewBox="0 {f(-ov)} {f(sd["w"])} {f(sd["h"] + 2 * ov)}" '
        f'style="{way(RED, BONE)}" role="img" aria-label="Soweto Towers, Vertical Adventure Centre">'
        f'<defs><clipPath id="under-bridge"><rect x="0" y="{f(m.bridge)}" width="{f(W)}" height="{f(Ht)}"/></clipPath></defs>'
        f'<g transform="translate({f(mx)} 0)">'
        + "".join(f'<path style="fill:var(--tw)" d="{d}"/>' for d in towers)
        + f'<path style="fill:var(--tw)" d="{bridge}"/>'
        f'<g clip-path="url(#under-bridge)"><path class="jump" style="fill:var(--tee);--from:{f(-drop_from)}px" d="{jump}"/></g>'
        f'</g>{text_uses}</svg>'
    )

    # ---------------- 01 idea --------------------------------------------------------------
    ghost = "#D8D1C4"

    def eq(body, pad=10):
        return f'<svg viewBox="{-pad} {-pad} {f(W + 2 * pad)} {f(Ht + 2 * pad)}" aria-hidden="true">{body}</svg>'

    t_black = "".join(f'<path fill="{BLACK}" d="{d}"/>' for d in towers)
    t_ghost = "".join(f'<path fill="{ghost}" d="{d}"/>' for d in towers)
    eq_tiles = [
        ("Two towers", "The Orlando cooling towers, drawn as true hyperboloids.", eq(t_black)),
        ("One bridge", "The suspension bridge that joins their rims.", eq(t_ghost + f'<path fill="{BLACK}" d="{bridge}"/>')),
        ("One jump", "The bungee cord and the jumper: the only colour in the mark.",
         eq(t_ghost + f'<path fill="{ghost}" d="{bridge}"/><path fill="{RED}" d="{jump}"/>')),
        ("Soweto Towers", "A place, and the moment it is known for.",
         eq(t_black + f'<path fill="{BLACK}" d="{bridge}"/><path fill="{RED}" d="{jump}"/>')),
    ]
    eq_html = ""
    for i, (t, d, svg) in enumerate(eq_tiles):
        op = "" if i == 0 else f'<span class="op" aria-hidden="true">{"=" if i == 3 else "+"}</span>'
        eq_html += f'{op}<figure class="eq"><div class="eq-art">{svg}</div><figcaption><b>{t}</b>{d}</figcaption></figure>'

    # ---------------- 02 construction ------------------------------------------------------
    pad = 30
    th_y = m.by - hyp.y0
    gl = "rgba(243,239,231,.13)"
    lines = []
    for x in (0, B, 2 * B, W - 2 * B, W - B, W):
        lines.append(f'<line x1="{f(x)}" y1="{-pad + 8}" x2="{f(x)}" y2="{f(Ht + pad - 8)}" stroke="{gl}" stroke-width=".35"/>')
    for y in (0, m.band_h, th_y, m.dot_y, Ht):
        lines.append(f'<line x1="{-pad + 8}" y1="{f(y)}" x2="{f(W + pad - 8)}" y2="{f(y)}" stroke="{gl}" stroke-width=".35"/>')
    rul_l, rul_r = [], []
    for store, cx in ((rul_l, m.L), (rul_r, m.R)):
        for i in range(13):
            th = -1.2 + 2.4 * i / 12
            for sgn in (+1, -1):
                pts = []
                for hh in (0, H):
                    z = hh - hyp.y0
                    x = hyp.a * math.cos(th) - hyp.a * math.sin(th) * z / hyp.b
                    pts.append((cx + sgn * x, m.by - hh))
                store.append(f'<line x1="{f(pts[0][0])}" y1="{f(pts[0][1])}" x2="{f(pts[1][0])}" y2="{f(pts[1][1])}"/>')
    tower_outline = "".join(f'<path d="{m._tower(cx, 0, H)}"/>' for cx in (m.L, m.R))

    def lab(x, y, t, col=BONE, anchor="middle"):
        return f'<text x="{f(x)}" y="{f(y)}" fill="{col}" text-anchor="{anchor}">{t}</text>'

    ann = [
        f'<line x1="{f(m.L - hyp.a)}" y1="{f(th_y)}" x2="{f(m.L + hyp.a)}" y2="{f(th_y)}" stroke="{RED}" stroke-width=".7"/>',
        lab(m.L - hyp.a - 3, th_y + 2, f"{round(hyp.y0 / H * 100)}%", RED, "end"),
        lab(m.L, Ht + 11, "2B"), lab(m.R, Ht + 11, "2B"), lab(W / 2, Ht + 11, f"{m.gap / B:.2f}B", RED),
        lab(W + pad - 9, m.dot_y + 2, "½H", RED, "end"),
        lab(-pad + 9, Ht / 2 + 2, "H = 3B", BONE, "start"),
    ]
    construction = (
        f'<svg class="construct" viewBox="{-pad} {-pad} {f(W + 2 * pad)} {f(Ht + 2 * pad)}" role="img" '
        f'aria-label="Construction drawing: two hyperboloid towers made of straight lines, the bridge across their rims, and the jumper at half their height">'
        f'<defs><clipPath id="cl"><path d="{m._tower(m.L, 0, H)}"/></clipPath><clipPath id="cr"><path d="{m._tower(m.R, 0, H)}"/></clipPath></defs>'
        f'{"".join(lines)}'
        f'<g fill="rgba(243,239,231,.05)">{tower_outline}</g>'
        f'<g stroke="rgba(243,239,231,.40)" stroke-width=".3" clip-path="url(#cl)">{"".join(rul_l)}</g>'
        f'<g stroke="rgba(243,239,231,.40)" stroke-width=".3" clip-path="url(#cr)">{"".join(rul_r)}</g>'
        f'<g fill="none" stroke="{BONE}" stroke-width=".7">{"".join(f"<path d={chr(34)}{d}{chr(34)}/>" for d in towers)}<path d="{bridge}"/></g>'
        f'<path d="{jump}" fill="{RED}"/>'
        f'<g font-size="5.4" font-weight="500" style="font-stretch:118%;letter-spacing:.04em">{"".join(ann)}</g></svg>'
    )

    # ---------------- 05 clear space ---------------------------------------------------------
    st = forms["stacked"]
    x_ = B
    cs_pad = x_ * 1.5
    cs = (f'<svg class="clear" viewBox="{f(-cs_pad)} {f(-cs_pad)} {f(st["w"] + 2 * cs_pad)} {f(st["h"] + 2 * cs_pad)}" '
          f'role="img" aria-label="Clear space: keep x, half the width of a tower base, free on every side">'
          f'<rect x="{f(-x_)}" y="{f(-x_)}" width="{f(st["w"] + 2 * x_)}" height="{f(st["h"] + 2 * x_)}" '
          f'fill="rgba(218,41,28,.06)" stroke="{RED}" stroke-width=".8" stroke-dasharray="3 3"/>'
          f'<rect width="{f(st["w"])}" height="{f(st["h"])}" fill="none" stroke="rgba(21,20,18,.22)" stroke-width=".5"/>')
    for (x0, y0) in ((-x_, -x_), (st["w"], -x_), (-x_, st["h"]), (st["w"], st["h"])):
        cs += f'<rect x="{f(x0)}" y="{f(y0)}" width="{f(x_)}" height="{f(x_)}" fill="{RED}" opacity=".85"/>'
    cs += f'<text x="{f(-x_ / 2)}" y="{f(-x_ / 2 + 6)}" fill="{WHITE}" font-size="17" text-anchor="middle" font-weight="600">x</text>'
    cs += f'<g style="{way(RED, BLACK)}">{uses("stacked")}</g></svg>'

    sizes = (96, 64, 48, 32, 20)
    cmp_rows = ""
    for lbl, smm in (("Master", False), ("Small-size master", True)):
        cells = "".join(f'<div class="sz">{mark_svg(way(RED, BLACK), small_master=smm, label="", size=z)}<span>{z} px</span></div>'
                        for z in sizes)
        cmp_rows += f'<div class="sz-row"><span class="sz-l">{lbl}</span>{cells}</div>'

    # ---------------- 06 colour ------------------------------------------------------------
    prim = [
        ("Drop Red", RED, "218 41 28", "0 95 100 0", "Pantone 485 C", "The jump. The only colour in the mark, so it always means the moment."),
        ("Tower Black", BLACK, "21 20 18", "60 50 50 100", "Rich black", "The towers and the name. Structure, type, night."),
        ("Bone", BONE, "243 239 231", "3 4 8 0", "Uncoated natural white", "Concrete in sunlight. Pages, space, calm."),
    ]
    sec = [
        ("Highveld Sky", SEC["sky"], "29 95 208", "SCAD freefall · BASE jump"),
        ("Mural Gold", SEC["gold"], "242 179 61", "Zipline"),
        ("Kasi Green", SEC["green"], "31 138 91", "Paintball"),
        ("Concrete", SEC["concrete"], "143 138 130", "Viewing deck · tours · info"),
    ]

    def ink_on(bg):
        return BLACK if contrast(bg, BLACK) >= contrast(bg, WHITE) else WHITE

    sw_html = ""
    for n, hx, rgb, cmyk, pms, use in prim:
        edge = ";box-shadow:inset 0 0 0 1px rgba(21,20,18,.16)" if hx == BONE else ""
        sw_html += (f'<div class="sw" style="background:{hx};color:{ink_on(hx)}{edge}"><b>{n}</b><span class="use">{use}</span>'
                    f'<dl><dt>HEX</dt><dd>{hx}</dd><dt>RGB</dt><dd>{rgb}</dd><dt>CMYK</dt><dd>{cmyk}</dd><dt>Print</dt><dd>{pms}</dd></dl></div>')
    sec_html = ""
    for n, hx, rgb, use in sec:
        sec_html += (f'<div class="sw sm" style="background:{hx};color:{ink_on(hx)}"><b>{n}</b>'
                     f'<dl><dt>HEX</dt><dd>{hx}</dd><dt>RGB</dt><dd>{rgb}</dd></dl><span class="use">{use}</span></div>')
    pairs = [("Tower Black on Bone", BLACK, BONE), ("Bone on Tower Black", BONE, BLACK), ("White on Drop Red", WHITE, RED),
             ("Drop Red on Bone", RED, BONE), ("Tower Black on Mural Gold", BLACK, SEC["gold"]),
             ("White on Highveld Sky", WHITE, SEC["sky"]), ("White on Kasi Green", WHITE, SEC["green"])]
    ct_rows = ""
    for n, fg, bg in pairs:
        r = contrast(fg, bg)
        grade = "AAA" if r >= 7 else ("AA" if r >= 4.5 else ("AA large" if r >= 3 else "Decoration only"))
        ct_rows += (f'<tr><td><span class="chip" style="background:{bg};color:{fg}">Aa</span>{n}</td>'
                    f'<td>{r:.1f} : 1</td><td>{grade}</td></tr>')

    # ---------------- 08 applications -----------------------------------------------------
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
    code = (f'<svg class="code" viewBox="-1 -1 {q + 2} {q + 2}" aria-hidden="true"><rect x="-1" y="-1" width="{q + 2}" '
            f'height="{q + 2}" fill="{BONE}"/><g fill="{BLACK}">{"".join(cells)}</g></svg>')
    band = "".join(f'<span class="bm">{mark_svg(way(BONE, BONE), small_master=True, label="")}</span>'
                   f'<span class="bw">SOWETO TOWERS</span>' for _ in range(4))
    phone = "".join(
        '<div class="app"><div class="ic"><img src="icons/app-icon.svg" alt=""></div><span>Soweto Towers</span></div>' if i == 5
        else '<div class="app"><div class="ic ph"></div><span></span></div>' for i in range(16))

    # ---------------- 09 misuse ------------------------------------------------------------
    def bad(body, vb=None):
        vb = vb or f"-16 -16 {f(W + 32)} {f(Ht + 32)}"
        return f'<svg viewBox="{vb}" aria-hidden="true">{body}</svg>'

    base = t_black + f'<path fill="{BLACK}" d="{bridge}"/>'
    donts = [
        ("Recolour the jump", "The jump is always Drop Red, or the colour of the towers in one-colour use.",
         bad(base + f'<path fill="{SEC["sky"]}" d="{jump}"/>')),
        ("Stretch or squash", "Scale proportionally. The towers are measured, not approximate.",
         bad(f'<g transform="translate({f(W / 2)} {f(Ht / 2)}) scale(.72 1.25) translate({f(-W / 2)} {f(-Ht / 2)})">{base}<path fill="{RED}" d="{jump}"/></g>',
             vb=f"-16 {f(-Ht * 0.14 - 16)} {f(W + 32)} {f(Ht * 1.28 + 32)}")),
        ("Rearrange the parts", "The jumper hangs from the middle of the bridge. Nothing moves.",
         bad(base + f'<g transform="translate({f(W * 0.5)} {f(Ht * 0.18)})"><path fill="{RED}" d="{jump}"/></g>',
             vb=f"-16 -16 {f(W * 1.55 + 32)} {f(Ht + 32)}")),
        ("Add effects", "No shadows, bevels, gradients or glows. Flat colour only.",
         bad(f'<defs><linearGradient id="gx" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#6b6b6b"/>'
             f'<stop offset="1" stop-color="#0b0b0b"/></linearGradient><filter id="sh"><feDropShadow dx="6" dy="8" stdDeviation="4" flood-opacity=".45"/></filter></defs>'
             f'<g filter="url(#sh)">' + "".join(f'<path fill="url(#gx)" d="{d}"/>' for d in towers) +
             f'<path fill="url(#gx)" d="{bridge}"/><path fill="{RED}" d="{jump}"/></g>')),
        ("Rotate or tilt", "The towers stand upright, and the cord hangs straight down.",
         bad(f'<g transform="rotate(-12 {f(W / 2)} {f(Ht / 2)})">{base}<path fill="{RED}" d="{jump}"/></g>')),
        ("Retype the name", "Use the supplied artwork. Never set the name in another font.",
         bad(f'<g transform="translate({f(W * 0.2)} 0)">{base}<path fill="{RED}" d="{jump}"/></g>'
             f'<text x="{f(W * 0.7)}" y="{f(Ht + 30)}" font-family="Georgia, serif" font-style="italic" font-size="26" '
             f'text-anchor="middle" fill="{BLACK}">Soweto Towers</text>', vb=f"-16 -16 {f(W * 1.4 + 32)} {f(Ht + 56)}")),
    ]
    dont_html = "".join(f'<figure class="dont"><div class="dont-art">{svg}<span class="x" aria-hidden="true"></span></div>'
                        f'<figcaption><b>Don’t {t[0].lower() + t[1:]}</b>{d}</figcaption></figure>' for t, d, svg in donts)

    # ---------------- 10 files -------------------------------------------------------------
    groups = {}
    for p in files:
        key = "Icons" if p.startswith("icons/") else ("Logo · SVG masters" if "/svg/" in p else "Logo · PNG, transparent")
        groups.setdefault(key, []).append(p)
    file_html = ""
    for k in ("Logo · SVG masters", "Logo · PNG, transparent", "Icons"):
        if k in groups:
            items = "".join(f'<li><a href="{p}" download>{p.split("/")[-1]}</a></li>' for p in groups[k])
            file_html += f'<div class="files-col"><h4>{k}</h4><ul>{items}</ul></div>'

    rep = {
        "%FONT%": font64, "%DEFS%": DEFS, "%COVER%": cover, "%SPRING%": spring_easing(),
        "%EQ%": eq_html, "%CONSTRUCT%": construction,
        "%THROAT%": str(round(hyp.y0 / H * 100)), "%GAP%": f"{m.gap / B:.2f}",
        "%PRIMARY%": form_svg("stacked", way(RED, BLACK), cls="hero-lockup"),
        "%STACKED_D%": form_svg("stacked-descriptor", way(RED, BLACK)),
        "%HORIZONTAL%": form_svg("horizontal", way(RED, BLACK), cls="wm"),
        "%MARK%": mark_svg(way(RED, BLACK)),
        "%WORD%": form_svg("wordmark", way(RED, BLACK), cls="wm"),
        "%V_COLOUR%": form_svg("stacked", way(RED, BLACK)),
        "%V_REVERSE%": form_svg("stacked", way(RED, BONE)),
        "%V_RED%": form_svg("stacked", way(WHITE, WHITE)),
        "%V_BLACK%": form_svg("stacked", way(BLACK, BLACK)),
        "%V_SKY%": form_svg("stacked", way(WHITE, WHITE)),
        "%V_PHOTO%": form_svg("stacked", way(RED, BONE)),
        "%CLEAR%": cs, "%SIZES%": cmp_rows,
        "%SWATCHES%": sw_html, "%SECONDARY%": sec_html, "%CONTRAST%": ct_rows,
        "%HZ_REV%": form_svg("horizontal", way(RED, BONE), cls="lg"),
        "%CODE%": code,
        "%MARK_REV_TICKET%": mark_svg(way(RED, BONE), cls="mk"),
        "%MARK_REV%": mark_svg(way(RED, BONE)),
        "%MARK_ON_RED%": mark_svg(way(BONE, BLACK)),
        "%HERO_TOWERS%": f'<svg class="t1" viewBox="0 0 {f(W)} {f(Ht)}" aria-hidden="true"><use href="#p-mark" style="--tee:transparent;--tw:rgba(10,20,45,.5)"/></svg>',
        "%BAND%": band, "%PHONE%": phone, "%DONTS%": dont_html, "%FILES%": file_html,
        "%TRACK%": f"{meta['tracking']['name'] * 100:.0f}",
        "%RED%": RED, "%BLACK%": BLACK, "%BONE%": BONE,
        "%SKY%": SEC["sky"], "%GOLD%": SEC["gold"], "%GREEN%": SEC["green"], "%CONCRETE%": SEC["concrete"],
    }
    T = TEMPLATE
    for k, v in rep.items():
        T = T.replace(k, v)
    return T


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soweto Towers Identity</title>
<meta name="description" content="Logo and identity guidelines for Soweto Towers, the vertical adventure centre at the Orlando cooling towers in Soweto.">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,%FONT%) format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:swap}
:root{
  --red:%RED%;--black:%BLACK%;--bone:%BONE%;--sky:%SKY%;--gold:%GOLD%;--green:%GREEN%;--concrete:%CONCRETE%;
  --paper:#FBF9F5;--muted:#6B665E;--rule:rgba(21,20,18,.12);
  --gutter:clamp(16px,4vw,48px);--max:1180px;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bone);color:var(--black);font-family:"Archivo",system-ui,sans-serif;font-size:1.0625rem;line-height:1.6;-webkit-font-smoothing:antialiased}
img,svg{display:block;max-width:100%}
a{color:inherit}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter)}
section{padding:clamp(72px,11vw,144px) 0;border-top:1px solid var(--rule)}
.label{display:flex;gap:12px;align-items:baseline;font-stretch:118%;font-weight:500;font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;margin:0 0 24px;color:var(--muted)}
.label i{font-style:normal;color:var(--red)}
h2{font-weight:600;font-stretch:104%;font-size:clamp(2rem,5vw,3.5rem);line-height:1.04;letter-spacing:-.025em;margin:0 0 22px;max-width:18ch}
h3{font-weight:600;font-size:1rem;letter-spacing:-.005em;margin:0 0 6px}
p{margin:0 0 16px;max-width:62ch}
.lede{font-size:clamp(1.125rem,1.9vw,1.3125rem);line-height:1.55;max-width:54ch;color:#3a3733}
.muted{color:var(--muted)}

/* cover */
.cover{background:var(--black);color:var(--bone);min-height:100svh;display:flex;flex-direction:column;border:0;padding:0}
.cover-top,.cover-foot{display:flex;justify-content:space-between;gap:16px;padding:22px var(--gutter);font-stretch:118%;font-size:.6875rem;letter-spacing:.22em;text-transform:uppercase;font-weight:500;opacity:.7}
.cover-main{flex:1;display:grid;place-items:center;padding:40px var(--gutter)}
.cover-logo{width:min(440px,78vw);height:auto;overflow:visible}
.cover-foot span:last-child{text-align:right}
.jump{animation:drop 1.8s %SPRING% .5s both}
@keyframes drop{from{transform:translateY(var(--from))}to{transform:none}}
@media (prefers-reduced-motion:reduce){.jump{animation:none}}

/* idea */
.eqs{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap;margin-top:48px}
.eq{margin:0;flex:1 1 190px;background:var(--paper);border-radius:10px;padding:26px 20px 20px;display:flex;flex-direction:column;gap:18px}
.eq-art svg{width:100%;height:auto;max-height:120px}
.eq figcaption{font-size:.875rem;line-height:1.45;color:var(--muted)}
.eq figcaption b{display:block;color:var(--black);font-weight:600;font-size:.9375rem;margin-bottom:3px}
.op{align-self:center;font-weight:300;font-size:1.75rem;color:var(--red);padding:0 2px}
.pull{font-weight:600;font-stretch:104%;font-size:clamp(1.5rem,3vw,2.25rem);line-height:1.15;letter-spacing:-.02em;max-width:26ch;margin:64px 0 0}
.pull em{font-style:normal;color:var(--red)}

/* construction */
.construct-wrap{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:clamp(28px,5vw,72px);align-items:start}
.construct-panel{background:var(--black);border-radius:10px;padding:clamp(12px,3vw,32px)}
.construct{width:100%;height:auto}
.construct text{font-family:"Archivo",sans-serif}
.rules{list-style:none;margin:0;padding:0;counter-reset:r}
.rules li{counter-increment:r;padding:18px 0;border-top:1px solid var(--rule);display:grid;grid-template-columns:40px 1fr;gap:6px}
.rules li::before{content:counter(r,decimal-leading-zero);font-weight:500;color:var(--red);font-size:.8125rem;padding-top:3px;font-variant-numeric:tabular-nums}
.rules p{margin:0;font-size:.96875rem;color:#3a3733}

/* suite */
.hero-card{background:var(--paper);border-radius:10px;padding:clamp(48px,9vw,120px) clamp(20px,6vw,90px);display:grid;place-items:center;margin-bottom:16px}
.hero-lockup{width:min(520px,100%);height:auto}
.suite{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:40px}
.card{background:var(--paper);border-radius:10px;padding:22px;display:flex;flex-direction:column;gap:18px}
.card .art{flex:1;display:grid;place-items:center;min-height:180px;padding:14px}
.card .art svg{max-height:130px;width:auto;max-width:100%}
.card .art .wm{width:100%;height:auto}
.card p{font-size:.90625rem;margin:0;color:var(--muted)}
.tag{display:inline-block;font-size:.65rem;font-stretch:118%;font-weight:600;letter-spacing:.16em;text-transform:uppercase;background:var(--red);color:#fff;padding:3px 7px;border-radius:4px;margin-left:8px;vertical-align:2px}
.hint{font-size:.875rem;color:var(--muted);margin-top:6px}

/* versions */
.versions{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin-top:40px}
.ver{border-radius:10px;min-height:260px;display:grid;place-items:center;padding:44px 32px 52px;position:relative}
.ver svg{width:min(250px,100%);height:auto;position:relative;z-index:1}
.ver span{position:absolute;left:18px;bottom:14px;font-size:.75rem;font-weight:500;opacity:.75;z-index:1}
.photo{background:radial-gradient(120% 90% at 70% 10%,#3f82e8 0%,#1D5FD0 38%,#0f2e6b 78%,#0a1a3a 100%)}
.photo::after{content:"";position:absolute;inset:auto 0 0 0;height:50%;background:linear-gradient(to top,rgba(10,16,30,.85),rgba(10,16,30,0));border-radius:0 0 10px 10px}

/* clear space */
.clear-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(28px,5vw,64px);align-items:center}
.clear{width:100%;height:auto;background:var(--paper);border-radius:10px;padding:10px}
.minsize{width:100%;border-collapse:collapse;font-size:.9375rem;margin-top:10px}
.minsize td{padding:11px 0;border-top:1px solid var(--rule)}
.minsize td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
.sizes{margin-top:48px;background:var(--paper);border-radius:10px;padding:24px}
.sz-row{display:flex;align-items:flex-end;gap:32px;padding:16px 0;flex-wrap:wrap}
.sz-row+.sz-row{border-top:1px solid var(--rule)}
.sz-l{flex:0 0 170px;font-size:.875rem;font-weight:600;align-self:center}
.sz{display:flex;flex-direction:column;align-items:center;gap:8px;font-size:.75rem;color:var(--muted)}

/* colour */
.swatches{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.sw{border-radius:10px;padding:22px;min-height:290px;display:flex;flex-direction:column;gap:8px}
.sw.sm{min-height:200px}
.sw b{font-weight:600;font-size:1.125rem;letter-spacing:-.01em}
.sw .use{font-size:.875rem;line-height:1.45;opacity:.85;max-width:30ch}
.sw dl{display:grid;grid-template-columns:52px 1fr;gap:2px 8px;margin:auto 0 0;font-size:.8125rem;font-variant-numeric:tabular-nums}
.sw dt{opacity:.6}
.sw dd{margin:0;font-weight:500}
.ratio{display:flex;height:16px;border-radius:8px;overflow:hidden;margin:32px 0 8px}
.ratio div{height:100%}
.sub{margin-top:64px}
.chip{display:inline-grid;place-items:center;width:34px;height:26px;border-radius:6px;font-weight:600;font-size:.8125rem;margin-right:12px;vertical-align:middle;box-shadow:inset 0 0 0 1px var(--rule)}
.ct{width:100%;border-collapse:collapse;font-size:.9375rem}
.ct td{padding:10px 0;border-top:1px solid var(--rule)}
.ct td:nth-child(2){font-variant-numeric:tabular-nums;font-weight:500}
.ct td:last-child{text-align:right;color:var(--muted)}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(28px,5vw,64px)}

/* type */
.spec{background:var(--paper);border-radius:10px;padding:clamp(22px,4vw,44px);margin-bottom:12px;overflow:hidden}
.spec .name{font-stretch:118%;font-weight:500;font-size:clamp(1.5rem,4.4vw,3.25rem);letter-spacing:.2em;margin:18px 0 22px;overflow-wrap:anywhere}
.spec .big{font-weight:600;font-stretch:104%;font-size:clamp(2.5rem,7vw,5.5rem);line-height:1;letter-spacing:-.03em;margin:14px 0 18px}
.spec .abc{font-weight:500;font-size:clamp(1rem,2vw,1.375rem);letter-spacing:.01em;overflow-wrap:anywhere;color:#3a3733}
.spec .txt{font-size:clamp(1.125rem,2vw,1.375rem);line-height:1.5;max-width:42ch}
.spec .meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:.8125rem;color:var(--muted)}
.hier{display:grid;gap:14px;margin-top:24px}
.hier div{display:grid;grid-template-columns:130px 1fr;gap:12px;align-items:baseline;border-top:1px solid var(--rule);padding-top:12px}
.hier small{font-size:.75rem;color:var(--muted)}

/* applications */
.apps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-top:40px}
.apps>figure{margin:0;display:flex;flex-direction:column;min-width:0}
.apps figcaption{font-size:.8125rem;font-weight:500;color:var(--muted);padding:12px 2px 0}
.a-web{grid-column:span 6}
.a-phone,.a-ticket{grid-column:span 3}
.a-band,.a-sign,.a-social{grid-column:span 2}
.web{border-radius:10px;overflow:hidden;aspect-ratio:16/8;min-height:300px;position:relative;color:#fff}
.web .sky{position:absolute;inset:0;background:radial-gradient(110% 120% at 80% 0%,#4b8ef0 0%,#1D5FD0 45%,#123f94 100%)}
.web .t1{position:absolute;right:4%;bottom:0;width:34%}
.web nav{position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px clamp(16px,3vw,32px);background:rgba(21,20,18,.55);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);border-bottom:1px solid rgba(255,255,255,.08)}
.web nav .lg{height:30px;width:auto}
.web nav ul{display:flex;gap:24px;list-style:none;margin:0;padding:0;font-size:.8125rem;font-weight:500}
.web nav .btn{background:var(--red);color:#fff;font-weight:600;font-size:.8125rem;padding:10px 16px;border-radius:999px;white-space:nowrap}
.web .hero{position:relative;padding:clamp(28px,5vw,72px) clamp(16px,3vw,32px);max-width:min(600px,100%)}
.web .hero h4{font-weight:600;font-stretch:104%;font-size:clamp(1.75rem,4.4vw,3.25rem);line-height:1.02;letter-spacing:-.03em;margin:0 0 14px}
.web .hero p{font-size:clamp(.875rem,1.5vw,1.0625rem);opacity:.9;margin:0 0 22px}
.web .chips{display:flex;gap:8px;flex-wrap:wrap}
.web .chips span{display:inline-flex;align-items:center;gap:8px;font-size:.75rem;font-weight:500;padding:8px 12px;border-radius:999px;background:rgba(21,20,18,.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
.web .chips i{width:8px;height:8px;border-radius:50%}
.panel{background:#d9d3c7;border-radius:10px;display:grid;place-items:center;padding:36px 16px;flex:1}
.phone{width:min(250px,100%);aspect-ratio:9/18.5;background:linear-gradient(160deg,#2a2622,#0f0e0c);border-radius:36px;padding:54px 18px 18px;box-shadow:0 0 0 7px #151412,0 22px 50px rgba(0,0,0,.25)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 10px}
.app{display:flex;flex-direction:column;align-items:center;gap:5px}
.app .ic{width:100%;aspect-ratio:1;border-radius:23%;overflow:hidden}
.app .ic img{width:100%;height:100%}
.app .ph{background:rgba(243,239,231,.1)}
.app span{font-size:8px;color:#eee;white-space:nowrap;min-height:11px}
.ticket{display:grid;grid-template-columns:1fr auto;width:min(440px,100%);background:var(--black);color:var(--bone);border-radius:14px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.2)}
.ticket .main{padding:22px;display:flex;flex-direction:column;gap:16px;min-width:0}
.ticket .main svg.mk{height:36px;width:auto}
.ticket .act{font-weight:600;font-size:clamp(1.25rem,2.6vw,1.625rem);line-height:1.05;letter-spacing:-.02em}
.ticket .act small{display:block;font-size:.6875rem;font-stretch:118%;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:var(--red);margin-bottom:6px}
.ticket .row{display:flex;gap:22px;font-size:.6875rem;opacity:.75;flex-wrap:wrap}
.ticket .row b{display:block;font-size:.8125rem;opacity:1;font-weight:600;color:var(--bone)}
.ticket .stub{background:var(--red);padding:18px 16px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;border-left:2px dashed rgba(21,20,18,.45);width:128px}
.ticket .code{width:94px;height:94px;border-radius:4px}
.ticket .stub span{font-size:.6875rem;font-stretch:118%;letter-spacing:.2em;text-transform:uppercase;font-weight:600;color:#fff}
.band-bg{background:var(--paper);border-radius:10px;display:grid;place-items:center;padding:48px 0;flex:1;overflow:hidden}
.band{width:130%;transform:rotate(-8deg);background:var(--red);color:var(--bone);display:flex;align-items:center;gap:16px;padding:14px 18px;white-space:nowrap;border-radius:6px;box-shadow:0 10px 24px rgba(0,0,0,.12)}
.band .bm svg{height:18px;width:auto}
.band .bw{font-stretch:118%;font-weight:500;font-size:.8125rem;letter-spacing:.22em}
.sign-bg{background:#cfc8bb;border-radius:10px;display:grid;place-items:end center;padding:28px 16px 0;flex:1}
.totem{width:156px;background:var(--black);color:var(--bone);padding:24px 16px 26px;display:flex;flex-direction:column;gap:14px;border-radius:3px 3px 0 0}
.totem svg{width:96px;height:auto;margin:0 auto 8px}
.totem div{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(243,239,231,.16);padding-top:9px;font-size:.75rem;font-weight:500}
.totem i{font-style:normal;width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:8px}
.social-bg{background:var(--paper);border-radius:10px;display:flex;align-items:center;justify-content:center;gap:16px;padding:36px 12px;flex:1;flex-wrap:wrap}
.av{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;overflow:hidden}
.av svg{width:64%;height:auto}

/* misuse */
.donts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.dont{margin:0}
.dont-art{background:var(--paper);border-radius:10px;padding:26px;position:relative;display:grid;place-items:center;height:200px}
.dont-art svg{max-height:140px;width:auto;max-width:100%}
.x{position:absolute;top:12px;right:12px;width:22px;height:22px;border-radius:50%;background:var(--red)}
.x::before,.x::after{content:"";position:absolute;left:5px;right:5px;top:10px;height:2px;background:#fff;transform:rotate(45deg)}
.x::after{transform:rotate(-45deg)}
.dont figcaption{font-size:.875rem;color:var(--muted);padding-top:12px;line-height:1.45}
.dont figcaption b{display:block;color:var(--black);font-weight:600;font-size:.9375rem;margin-bottom:2px}

/* files */
.files{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px;margin-top:28px}
.files h4{font-weight:600;font-size:.875rem;margin:0 0 10px}
.files ul{list-style:none;margin:0;padding:0;font-size:.84375rem}
.files li{padding:6px 0;border-top:1px solid var(--rule)}
.files a{text-decoration:none}
.files a:hover{color:var(--red)}
footer{background:var(--black);color:var(--bone);padding:48px 0;font-size:.8125rem}
footer .wrap{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;opacity:.7}

@media (max-width:900px){
  .construct-wrap,.clear-wrap{grid-template-columns:1fr}
  .apps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .a-web,.a-phone,.a-ticket{grid-column:span 2}
  .a-band,.a-sign,.a-social{grid-column:span 1}
  .web nav ul{display:none}
  .web{aspect-ratio:auto}
}
@media (max-width:560px){
  .eqs{display:grid;grid-template-columns:1fr 1fr}
  .op{display:none}
  .web .t1{display:none}
  .apps{grid-template-columns:1fr}
  .a-web,.a-phone,.a-ticket,.a-band,.a-sign,.a-social{grid-column:auto}
  .ticket{grid-template-columns:1fr}
  .ticket .stub{width:auto;flex-direction:row;align-items:center;border-left:0;border-top:2px dashed rgba(21,20,18,.45)}
  .sz-l{flex-basis:100%}
  .cover-foot{flex-direction:column}
  .cover-foot span:last-child{text-align:left}
  .hier div{grid-template-columns:1fr}
}
@media (prefers-reduced-transparency:reduce){
  .web nav,.web .chips span{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(21,20,18,.92)}
}
</style>
</head>
<body>
%DEFS%

<section class="cover" aria-label="Cover">
  <div class="cover-top"><span>Soweto Towers</span><span>Identity guidelines</span></div>
  <div class="cover-main">%COVER%</div>
  <div class="cover-foot"><span>Orlando East, Soweto</span><span>November 2026 · Version 2.0</span></div>
</section>

<section id="idea">
  <div class="wrap">
    <p class="label"><i>01</i> The idea</p>
    <h2>Two towers. One bridge. One jump.</h2>
    <p class="lede">The Orlando cooling towers are Soweto’s best-known skyline. The mark draws them exactly as they stand, joined by the bridge across their rims. Hanging from it is the only colour in the logo: the cord and the jumper, the moment the place is known for.</p>
    <div class="eqs">%EQ%</div>
    <p class="pull">Everything is still, <em>except the one thing that moves.</em></p>
  </div>
</section>

<section id="construction">
  <div class="wrap construct-wrap">
    <div class="construct-panel">%CONSTRUCT%</div>
    <div>
      <p class="label"><i>02</i> Construction</p>
      <h2>Drawn like the real thing.</h2>
      <ol class="rules">
        <li><div><h3>True hyperboloids</h3><p>Each tower follows the curve of a real cooling tower: a wide base, a throat at %THROAT%% of its height, and a slight flare at the rim. A hyperboloid is made entirely of straight lines, shown in the drawing.</p></div></li>
        <li><div><h3>One unit</h3><p>Every measure is a ratio of B, half a tower base. The towers are 3B tall, stand %GAP%B apart, and the bridge, the rim and the cord are fixed fractions of B. Scale it to any size and nothing drifts.</p></div></li>
        <li><div><h3>The rim</h3><p>A fine cut below each rim is the detail that makes these cooling towers and not columns. The bridge springs from the rims, level with the top of the mark.</p></div></li>
        <li><div><h3>The jump</h3><p>The cord drops from the exact centre of the bridge, and the jumper hangs at half the towers’ height. It is the only colour in the mark.</p></div></li>
      </ol>
    </div>
  </div>
</section>

<section id="suite">
  <div class="wrap">
    <p class="label"><i>03</i> The logo</p>
    <h2>Quiet, so the towers speak.</h2>
    <p class="lede">The name is set in widely spaced capitals at a modest weight, so the mark carries the weight and the name carries the calm.</p>
    <div class="hero-card" style="margin-top:40px">%PRIMARY%</div>
    <h3>Primary · Stacked <span class="tag">Default</span></h3>
    <p class="hint">Use it wherever the space allows.</p>
    <div class="suite">
      <div class="card"><div class="art">%STACKED_D%</div><div><h3>Stacked with descriptor</h3><p>Where people meet the brand for the first time: signage, print, press.</p></div></div>
      <div class="card"><div class="art">%HORIZONTAL%</div><div><h3>Horizontal</h3><p>Wide, short spaces: website header, email signature, vehicle livery.</p></div></div>
      <div class="card"><div class="art">%MARK%</div><div><h3>Mark</h3><p>App icon, favicon, wristbands, stamps, and anywhere the name is already present.</p></div></div>
      <div class="card"><div class="art">%WORD%</div><div><h3>Name</h3><p>Narrow spaces, and as a sign-off where the mark already appears nearby.</p></div></div>
    </div>
  </div>
</section>

<section id="versions">
  <div class="wrap">
    <p class="label"><i>04</i> Colour versions</p>
    <h2>Red is for the jump.</h2>
    <p class="lede">In full colour only the jump is red. Where one colour is all you have, the whole logo takes that colour.</p>
    <div class="versions">
      <div class="ver" style="background:var(--bone);box-shadow:inset 0 0 0 1px var(--rule)">%V_COLOUR%<span>Full colour · on Bone or white</span></div>
      <div class="ver" style="background:var(--black);color:var(--bone)">%V_REVERSE%<span>Reverse · on Tower Black</span></div>
      <div class="ver" style="background:var(--red);color:#fff">%V_RED%<span>White · on Drop Red</span></div>
      <div class="ver" style="background:#fff;box-shadow:inset 0 0 0 1px var(--rule)">%V_BLACK%<span>Black · one-colour print, stamps, engraving</span></div>
      <div class="ver" style="background:var(--sky);color:#fff">%V_SKY%<span>White · on secondary colours</span></div>
      <div class="ver photo" style="color:var(--bone)">%V_PHOTO%<span>Reverse · on the darker part of a photo</span></div>
    </div>
  </div>
</section>

<section id="space">
  <div class="wrap">
    <p class="label"><i>05</i> Clear space &amp; size</p>
    <div class="clear-wrap">
      <div>%CLEAR%</div>
      <div>
        <h2>Give it room.</h2>
        <p>Keep a clear space of <b>x</b> on every side, where x is B, half the width of a tower base. Nothing else enters that space: no type, edges or other logos.</p>
        <table class="minsize" aria-label="Minimum sizes">
          <tr><td>Stacked</td><td>96 px · 25 mm wide</td></tr>
          <tr><td>Horizontal</td><td>160 px · 40 mm wide</td></tr>
          <tr><td>Mark, master</td><td>48 px · 12 mm wide</td></tr>
          <tr><td>Mark, small-size master</td><td>16–48 px · 4–12 mm</td></tr>
        </table>
      </div>
    </div>
    <div class="sizes">
      <h3>Small-size master</h3>
      <p class="muted" style="font-size:.90625rem">Below 48 px the cord and the rim cut become too fine to print or render. The small-size master drops them, thickens the bridge and enlarges the jumper, so the idea survives in a browser tab.</p>
      %SIZES%
    </div>
  </div>
</section>

<section id="colour">
  <div class="wrap">
    <p class="label"><i>06</i> Colour</p>
    <h2>Concrete, steel and one red.</h2>
    <p class="lede">Three core colours. Bone gives the space, Tower Black gives the structure, and Drop Red is kept for the moment that matters.</p>
    <div class="ratio" aria-label="Colour proportions: Bone 55 percent, Tower Black 30 percent, Drop Red 10 percent, secondary colours 5 percent">
      <div style="flex:55;background:var(--bone);box-shadow:inset 0 0 0 1px var(--rule)"></div><div style="flex:30;background:var(--black)"></div><div style="flex:10;background:var(--red)"></div><div style="flex:1.25;background:var(--sky)"></div><div style="flex:1.25;background:var(--gold)"></div><div style="flex:1.25;background:var(--green)"></div><div style="flex:1.25;background:var(--concrete)"></div>
    </div>
    <p class="muted" style="font-size:.8125rem">Approximate share of a typical layout.</p>
    <div class="swatches" style="margin-top:28px">%SWATCHES%</div>
    <div class="sub">
      <h3>Secondary · Mural palette</h3>
      <p class="muted" style="font-size:.9375rem">Taken from the murals painted on the towers. Each colour codes one family of activities across the website, booking, wristbands and wayfinding, so people can find their adventure by colour.</p>
      <div class="swatches" style="margin-top:18px">%SECONDARY%</div>
    </div>
    <div class="sub two">
      <div>
        <h3>Accessible pairings</h3>
        <p class="muted" style="font-size:.9375rem">WCAG 2.1 contrast. Body text needs AA (4.5 : 1); large headings and buttons need 3 : 1.</p>
      </div>
      <table class="ct">%CONTRAST%</table>
    </div>
    <p class="muted" style="font-size:.8125rem;margin-top:22px">CMYK values are starting points. Approve colour on a printed proof.</p>
  </div>
</section>

<section id="type">
  <div class="wrap">
    <p class="label"><i>07</i> Typography</p>
    <h2>One family, used with restraint.</h2>
    <p class="lede">Archivo is free and open source (SIL Open Font License) on Google Fonts. One variable file covers the name, the headlines and the text, so the website loads a single font.</p>
    <div class="spec" style="margin-top:36px">
      <div class="meta"><span>The name · Archivo Medium, extended</span><span>width 118 · weight 500 · capitals · tracking %TRACK%%</span></div>
      <div class="name">SOWETO TOWERS</div>
      <div class="meta"><span>Reserved for the logo, signage and short labels. Never for sentences.</span></div>
    </div>
    <div class="spec">
      <div class="meta"><span>Headlines · Archivo SemiBold</span><span>width 104 · weight 600 · sentence case · tracking −3% at large sizes</span></div>
      <div class="big">Jump from the bridge.</div>
      <div class="abc">Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz 0123456789</div>
    </div>
    <div class="spec">
      <div class="meta"><span>Text · Archivo Regular &amp; Medium</span><span>width 100 · weight 400 / 500 · tracking 0</span></div>
      <p class="txt" style="margin:14px 0 0">Open Thursday from 12:00, and Friday to Sunday from 10:00, until sunset. Corner of Sheffield Road and Chris Hani Road, Orlando East.</p>
      <div class="hier">
        <div><small>Display · 56 / 58</small><span style="font-weight:600;font-stretch:104%;font-size:clamp(1.75rem,4vw,2.75rem);line-height:1.04;letter-spacing:-.03em">Bungee jump</span></div>
        <div><small>Heading · 24 / 30</small><span style="font-weight:600;font-size:1.375rem;letter-spacing:-.015em">Before you jump</span></div>
        <div><small>Body · 17 / 27</small><span>Jump from the suspension bridge with a cord around your feet.</span></div>
        <div><small>Label · 12 / 16</small><span style="font-stretch:118%;font-weight:500;font-size:.75rem;letter-spacing:.2em;text-transform:uppercase">Weight 35–110 kg</span></div>
      </div>
    </div>
  </div>
</section>

<section id="use">
  <div class="wrap">
    <p class="label"><i>08</i> In use</p>
    <h2>Built to work.</h2>
    <p class="lede">The identity has to hold up in a browser tab, on a wristband, on a voucher in someone’s inbox and on a sign at the gate.</p>
    <div class="apps">
      <figure class="a-web">
        <div class="web" role="img" aria-label="Website header with the horizontal logo">
          <div class="sky"></div>%HERO_TOWERS%
          <nav>%HZ_REV%<ul><li>Adventures</li><li>Plan your visit</li><li>Groups &amp; schools</li><li>About</li></ul><span class="btn">Buy a voucher</span></nav>
          <div class="hero"><h4>Jump from Soweto’s skyline.</h4><p>Bungee, SCAD freefall, zipline and paintball at the Orlando cooling towers.</p>
            <div class="chips"><span><i style="background:var(--red)"></i>Bungee</span><span><i style="background:#6FA3FF"></i>SCAD freefall</span><span><i style="background:var(--gold)"></i>Zipline</span><span><i style="background:#3DBB7F"></i>Paintball</span></div></div>
        </div>
        <figcaption>Website header</figcaption>
      </figure>
      <figure class="a-phone"><div class="panel"><div class="phone"><div class="grid">%PHONE%</div></div></div><figcaption>App icon</figcaption></figure>
      <figure class="a-ticket"><div class="panel">
        <div class="ticket" role="img" aria-label="Activity voucher">
          <div class="main">%MARK_REV_TICKET%
            <div class="act"><small>Activity voucher</small>Bungee jump</div>
            <div class="row"><span>Height<b>100 m</b></span><span>From<b>The bridge</b></span><span>Valid<b>365 days</b></span></div>
          </div>
          <div class="stub">%CODE%<span>Admit one</span></div>
        </div></div><figcaption>Voucher</figcaption></figure>
      <figure class="a-band"><div class="band-bg"><div class="band">%BAND%</div></div><figcaption>Wristband</figcaption></figure>
      <figure class="a-sign"><div class="sign-bg"><div class="totem">%MARK_REV%
        <div><span><i style="background:var(--red)"></i>Bungee</span><span>↑</span></div>
        <div><span><i style="background:var(--sky)"></i>SCAD</span><span>↑</span></div>
        <div><span><i style="background:var(--green)"></i>Paintball</span><span>→</span></div>
        <div><span><i style="background:var(--gold)"></i>Zipline</span><span>←</span></div>
      </div></div><figcaption>Wayfinding</figcaption></figure>
      <figure class="a-social"><div class="social-bg">
        <div class="av" style="background:var(--black)">%MARK_REV%</div>
        <div class="av" style="background:var(--red)">%MARK_ON_RED%</div>
      </div><figcaption>Social avatars</figcaption></figure>
    </div>
  </div>
</section>

<section id="donts">
  <div class="wrap">
    <p class="label"><i>09</i> Misuse</p>
    <h2>Please don’t.</h2>
    <div class="donts">%DONTS%</div>
  </div>
</section>

<section id="files">
  <div class="wrap">
    <p class="label"><i>10</i> Files</p>
    <h2>Artwork.</h2>
    <p>Use the SVG masters wherever possible. PNGs have transparent backgrounds. Colourways: <b>colour</b> for light backgrounds, <b>reverse</b> for dark, <b>black</b> and <b>white</b> for one-colour use.</p>
    <div class="files">%FILES%</div>
  </div>
</section>

<footer><div class="wrap"><span>Soweto Towers · Identity guidelines · Version 2.0</span><span>Typeface: Archivo by Omnibus-Type, SIL Open Font License 1.1</span></div></footer>
</body>
</html>
"""
