"""Brand guidelines page for the Soweto Towers identity (self-contained HTML)."""
import base64, math
from geom import f

SEC = {
    "sky": "#1D5FD0",
    "gold": "#F2B33D",
    "green": "#1F8A5B",
    "concrete": "#8F8A82",
}


def lum(hexc):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def render(parts, forms, main, small, colours, meta, font_path, files):
    C = colours
    RED, BLACK, BONE, WHITE = C["red"], C["black"], C["bone"], C["white"]
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()

    # ---------------- shared defs -------------------------------------------------
    role_style = {"tee": "fill:var(--tee)", "tw": "fill:var(--tw)", "ink": "fill:var(--ink)"}
    defs = []
    for name, p in parts.items():
        inner = "".join(f'<path style="{role_style[r]}" d="{d}"/>' for r, d in p.layers)
        defs.append(f'<g id="p-{name}">{inner}</g>')
    DEFS = f'<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>{"".join(defs)}</defs></svg>'

    def way(tee, tw, ink=None):
        return f"--tee:{tee};--tw:{tw};--ink:{ink or tw}"

    def form_svg(fname, style, cls="", label="Soweto Towers", extra=""):
        fm = forms[fname]
        ov = 0.02 * fm["h"]
        uses = []
        for it in fm["items"]:
            sx, sy = it["shift"]
            uses.append(f'<use href="#p-{it["part"].name}" transform="translate({f(it["x"] + sx)} {f(it["y"] + sy)})"/>')
        return (f'<svg class="{cls}" viewBox="0 {f(-ov)} {f(fm["w"])} {f(fm["h"] + 2 * ov)}" style="{style}" '
                f'role="img" aria-label="{label}">{"".join(uses)}{extra}</svg>')

    def mark_svg(style, cls="", pad=0, small_master=False, label="Soweto Towers mark"):
        m = small if small_master else main
        pid = "mark-small" if small_master else "mark"
        a11y = f'role="img" aria-label="{label}"' if label else 'aria-hidden="true"'
        return (f'<svg class="{cls}" viewBox="{-pad} {-pad} {f(m.W + 2 * pad)} {f(m.Ht + 2 * pad)}" style="{style}" '
                f'{a11y}><use href="#p-{pid}"/></svg>')

    P = main.paths()
    W, Ht, c, s, B = main.W, main.Ht, main.c, main.s, main.B
    hyp = main.hyp

    # ---------------- 01 idea: equation tiles ---------------------------------------
    ghost = "#D8D1C4"

    def eq(body, pad=10):
        return f'<svg viewBox="{-pad} {-pad} {f(W + 2 * pad)} {f(Ht + 2 * pad)}" aria-hidden="true">{body}</svg>'

    towers_only = f'<path fill="{BLACK}" d="{P["left"]}"/><path fill="{BLACK}" d="{P["right"]}"/>'
    towers_ghost = f'<path fill="{ghost}" d="{P["left"]}"/><path fill="{ghost}" d="{P["right"]}"/>'
    eq_tiles = [
        ("Two towers", "The Orlando cooling towers, drawn as true hyperboloids.", eq(towers_only)),
        ("The bridge", "The suspension bridge that spans their tops.", eq(towers_ghost + f'<rect fill="{RED}" width="{f(W)}" height="{f(c)}"/>')),
        ("The drop", "The 100 m bungee drop from that bridge.", eq(
            '<clipPath id="below"><rect y="{0}" width="{1}" height="{2}"/></clipPath>'.format(f(c + 0.8), f(W), f(Ht))
            + towers_ghost + f'<path fill="{RED}" clip-path="url(#below)" d="{P["tee"]}"/>')),
        ("T for Towers", "Read together, they spell the name.", eq(f'<path fill="{RED}" d="{P["tee"]}"/>' + towers_only)),
    ]
    eq_html = ""
    for i, (t, d, svg) in enumerate(eq_tiles):
        op = '<span class="op" aria-hidden="true">+</span>' if 0 < i < 3 else ('<span class="op" aria-hidden="true">=</span>' if i == 3 else "")
        eq_html += f'{op}<figure class="eq"><div class="eq-art">{svg}</div><figcaption><b>{t}</b>{d}</figcaption></figure>'

    # ---------------- 02 construction -------------------------------------------------
    pad = 26
    th_y = main.by - hyp.y0
    gl = "rgba(243,239,231,.14)"
    lines = []
    for x in (0, B, 2 * B, W / 2, W - 2 * B, W - B, W):
        lines.append(f'<line x1="{f(x)}" y1="{-pad + 6}" x2="{f(x)}" y2="{f(Ht + pad - 6)}" stroke="{gl}" stroke-width=".35"/>')
    for y in (0, c, c + s, th_y, Ht):
        lines.append(f'<line x1="{-pad + 6}" y1="{f(y)}" x2="{f(W + pad - 6)}" y2="{f(y)}" stroke="{gl}" stroke-width=".35"/>')
    rul = []
    for cx, cid in ((main.L, "cl"), (main.R, "cr")):
        for (x1, y1), (x2, y2) in main.rulings(cx, n=11, spread=1.2):
            rul.append(f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>')
    lab = lambda x, y, t, col=BONE, anchor="middle": f'<text x="{f(x)}" y="{f(y)}" fill="{col}" text-anchor="{anchor}">{t}</text>'
    ann = [
        # throat
        f'<line x1="{f(main.L - hyp.a)}" y1="{f(th_y)}" x2="{f(main.L + hyp.a)}" y2="{f(th_y)}" stroke="{RED}" stroke-width=".7"/>',
        f'<circle cx="{f(main.L - hyp.a)}" cy="{f(th_y)}" r="1.1" fill="{RED}"/><circle cx="{f(main.L + hyp.a)}" cy="{f(th_y)}" r="1.1" fill="{RED}"/>',
        lab(main.L - hyp.a - 2.5, th_y + 1.8, f"{round(main.throat * 100)}%", RED, "end"),
        lab(main.L, th_y - 2.6, "a", RED),
        # base
        lab(main.L, Ht + 9, "B", BONE), lab(main.R, Ht + 9, "B", BONE),
        lab(W / 2, Ht + 9, "2s", RED),
        # bridge
        lab(W + pad - 7, c / 2 + 2, "c", RED, "end"),
        lab(W + pad - 7, c + s / 2 + 2.2, "s", BONE, "end"),
        lab(W / 2, -9, "W = 4B + 2s", BONE),
    ]
    construction = (
        f'<svg class="construct" viewBox="{-pad} {-pad} {f(W + 2 * pad)} {f(Ht + 2 * pad)}" role="img" '
        f'aria-label="Construction drawing of the mark: two hyperboloid towers built from straight lines, with the bridge and drop forming a T">'
        f'<defs><clipPath id="cl"><path d="{P["left"]}"/></clipPath><clipPath id="cr"><path d="{P["right"]}"/></clipPath></defs>'
        f'{"".join(lines)}'
        f'<path d="{P["left"]}" fill="rgba(243,239,231,.06)"/><path d="{P["right"]}" fill="rgba(243,239,231,.06)"/>'
        f'<g stroke="rgba(243,239,231,.42)" stroke-width=".32" clip-path="url(#cl)">{"".join(rul[:len(rul)//2])}</g>'
        f'<g stroke="rgba(243,239,231,.42)" stroke-width=".32" clip-path="url(#cr)">{"".join(rul[len(rul)//2:])}</g>'
        f'<path d="{P["left"]}" fill="none" stroke="{BONE}" stroke-width=".7"/><path d="{P["right"]}" fill="none" stroke="{BONE}" stroke-width=".7"/>'
        f'<path d="{P["tee"]}" fill="rgba(218,41,28,.22)" stroke="{RED}" stroke-width=".9"/>'
        f'<g font-size="5.2" font-weight="500" style="font-stretch:125%;letter-spacing:.06em">{"".join(ann)}</g></svg>'
    )

    # ---------------- 05 clear space ---------------------------------------------------
    hz = forms["horizontal"]
    x_ = 2 * B  # module: the width of one tower base
    cs_pad = x_ * 1.35
    cs = (
        f'<svg class="clear" viewBox="{f(-cs_pad)} {f(-cs_pad)} {f(hz["w"] + 2 * cs_pad)} {f(hz["h"] + 2 * cs_pad)}" '
        f'role="img" aria-label="Clear space: keep the width of one tower base free on every side">'
        f'<rect x="{f(-x_)}" y="{f(-x_)}" width="{f(hz["w"] + 2 * x_)}" height="{f(hz["h"] + 2 * x_)}" fill="rgba(218,41,28,.07)" stroke="{RED}" stroke-width=".8" stroke-dasharray="3 3"/>'
        f'<rect width="{f(hz["w"])}" height="{f(hz["h"])}" fill="none" stroke="rgba(21,20,18,.25)" stroke-width=".5"/>'
    )
    for (x0, y0) in ((-x_, -x_), (hz["w"], -x_), (-x_, hz["h"]), (hz["w"], hz["h"])):
        cs += f'<rect x="{f(x0)}" y="{f(y0)}" width="{f(x_)}" height="{f(x_)}" fill="{RED}" opacity=".85"/>'
    cs += f'<text x="{f(-x_ / 2)}" y="{f(-x_ / 2 + 9)}" fill="{WHITE}" font-size="26" text-anchor="middle" font-weight="600">x</text>'
    uses = []
    for it in hz["items"]:
        sx, sy = it["shift"]
        uses.append(f'<use href="#p-{it["part"].name}" transform="translate({f(it["x"] + sx)} {f(it["y"] + sy)})"/>')
    cs += f'<g style="{way(RED, BLACK)}">{"".join(uses)}</g></svg>'

    # small-size comparison
    sizes = (48, 32, 24, 16)
    cmp_rows = ""
    for lbl, sm in (("Master", False), ("Small-size master", True)):
        cells = "".join(f'<div class="sz">{mark_svg(way(RED, BLACK), small_master=sm, label=lbl)}<span>{z} px</span></div>'.replace(
            'class=""', f'class="" width="{z}" height="{z}"') for z in sizes)
        cmp_rows += f'<div class="sz-row"><span class="sz-l">{lbl}</span>{cells}</div>'

    # ---------------- 06 colour -------------------------------------------------------
    prim = [
        ("Drop Red", RED, "218 41 28", "0 95 100 0", "Pantone 485 C", "The drop. Accent and action: the T, buttons, the moment."),
        ("Tower Black", BLACK, "21 20 18", "60 50 50 100", "Rich black", "The towers. Type, structure, night."),
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
        fg = ink_on(hx)
        edge = ";box-shadow:inset 0 0 0 1px rgba(21,20,18,.16)" if hx == BONE else ""
        sw_html += (f'<div class="sw" style="background:{hx};color:{fg}{edge}"><b>{n}</b><span class="use">{use}</span>'
                    f'<dl><dt>HEX</dt><dd>{hx}</dd><dt>RGB</dt><dd>{rgb}</dd><dt>CMYK</dt><dd>{cmyk}</dd><dt>Print</dt><dd>{pms}</dd></dl></div>')
    sec_html = ""
    for n, hx, rgb, use in sec:
        fg = ink_on(hx)
        sec_html += (f'<div class="sw sm" style="background:{hx};color:{fg}"><b>{n}</b>'
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

    # ---------------- 08 applications ---------------------------------------------
    hz_rev = form_svg("horizontal", way(RED, BONE), cls="lg")
    hz_col = form_svg("horizontal", way(RED, BLACK), cls="lg")

    # deterministic placeholder 'code' pattern for the voucher
    import random
    rnd = random.Random(7)
    q = 21
    cells = []
    for yy in range(q):
        for xx in range(q):
            finder = any((xx < 7 and yy < 7, xx >= q - 7 and yy < 7, xx < 7 and yy >= q - 7))
            if finder:
                fx, fy = xx % (q - 7) if xx >= q - 7 else xx, yy % (q - 7) if yy >= q - 7 else yy
                on = fx in (0, 6) or fy in (0, 6) or (2 <= fx <= 4 and 2 <= fy <= 4)
            else:
                on = rnd.random() < 0.48
            if on:
                cells.append(f'<rect x="{xx}" y="{yy}" width="1.02" height="1.02"/>')
    code = f'<svg class="code" viewBox="-1 -1 {q + 2} {q + 2}" aria-hidden="true"><rect x="-1" y="-1" width="{q + 2}" height="{q + 2}" fill="{BONE}"/><g fill="{BLACK}">{"".join(cells)}</g></svg>'

    band_marks = "".join(
        f'<span class="bm">{mark_svg(way(BONE, BONE), small_master=True, label="")}</span><span class="bw">SOWETO TOWERS</span>'
        for _ in range(4))

    phone_icons = ""
    for i in range(16):
        if i == 5:
            phone_icons += (f'<div class="app"><div class="ic"><img src="icons/app-icon.svg" alt=""></div><span>Soweto Towers</span></div>')
        else:
            phone_icons += f'<div class="app"><div class="ic ph"></div><span></span></div>'

    # ---------------- 09 don'ts ----------------------------------------------------
    def bad(body, vb=None):
        vb = vb or f"-14 -14 {f(W + 28)} {f(Ht + 28)}"
        return f'<svg viewBox="{vb}" aria-hidden="true">{body}</svg>'

    towers_black = f'<path fill="{BLACK}" d="{P["left"]}"/><path fill="{BLACK}" d="{P["right"]}"/>'
    donts = [
        ("Recolour the drop", "The T is always Drop Red, or the same colour as the towers in one-colour use.",
         bad(f'<path fill="{SEC["sky"]}" d="{P["tee"]}"/>' + towers_black)),
        ("Stretch or squash", "Scale proportionally. The tower curves are measured, not approximate.",
         bad(f'<g transform="translate({f(W / 2)} {f(Ht / 2)}) scale(1.4 0.78) translate({f(-W / 2)} {f(-Ht / 2)})"><path fill="{RED}" d="{P["tee"]}"/>{towers_black}</g>',
             vb=f"{f(-W * 0.2 - 14)} -14 {f(W * 1.4 + 28)} {f(Ht + 28)}")),
        ("Close the cuts", "The cuts are what make the T. Never outline the mark or fill the gaps.",
         bad(f'<g stroke="{BLACK}" stroke-width="{f(s * 2.2)}" stroke-linejoin="round"><path fill="{RED}" d="{P["tee"]}"/>{towers_black}</g>')),
        ("Add effects", "No shadows, bevels, gradients or glows. Flat colour only.",
         bad(f'<defs><linearGradient id="gx" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#6b0f08"/></linearGradient>'
             f'<filter id="sh"><feDropShadow dx="6" dy="8" stdDeviation="4" flood-opacity=".45"/></filter></defs>'
             f'<g filter="url(#sh)"><path fill="url(#gx)" d="{P["tee"]}"/>{towers_black}</g>')),
        ("Rotate or tilt", "The towers stand upright. Always.",
         bad(f'<g transform="rotate(-14 {f(W / 2)} {f(Ht / 2)})"><path fill="{RED}" d="{P["tee"]}"/>{towers_black}</g>')),
        ("Retype the name", "Use the supplied wordmark artwork. Never set it in another font.",
         bad(f'<g transform="translate(0 6) scale(.72)"><path fill="{RED}" d="{P["tee"]}"/>{towers_black}</g>'
             f'<text x="{f(W * 0.82)}" y="{f(Ht * 0.47)}" font-family="Georgia, serif" font-style="italic" font-size="26" fill="{BLACK}">Soweto</text>'
             f'<text x="{f(W * 0.82)}" y="{f(Ht * 0.47 + 28)}" font-family="Georgia, serif" font-style="italic" font-size="26" fill="{BLACK}">Towers</text>',
             vb=f"-14 -14 {f(W * 2.3)} {f(Ht + 28)}")),
    ]
    dont_html = "".join(f'<figure class="dont"><div class="dont-art">{svg}<span class="x" aria-hidden="true"></span></div>'
                        f'<figcaption><b>Don’t {t[0].lower() + t[1:]}</b>{d}</figcaption></figure>' for t, d, svg in donts)

    # ---------------- 10 files ------------------------------------------------------
    groups = {}
    for p in files:
        key = "Icons" if p.startswith("icons/") else ("Logo · SVG (master)" if "/svg/" in p else "Logo · PNG (transparent)")
        groups.setdefault(key, []).append(p)
    file_html = ""
    for k in ("Logo · SVG (master)", "Logo · PNG (transparent)", "Icons"):
        if k in groups:
            items = "".join(f'<li><a href="{p}" download>{p.split("/")[-1]}</a></li>' for p in groups[k])
            file_html += f'<div class="files-col"><h4>{k}</h4><ul>{items}</ul></div>'

    m = meta["main"]
    T = TEMPLATE
    rep = {
        "%FONT%": font64,
        "%DEFS%": DEFS,
        "%COVER%": form_svg("stacked-descriptor", way(RED, BONE), cls="cover-logo"),
        "%EQ%": eq_html,
        "%CONSTRUCT%": construction,
        "%THROAT%": str(round(main.throat * 100)),
        "%PRIMARY%": form_svg("horizontal", way(RED, BLACK), cls="hero-lockup"),
        "%STACKED%": form_svg("stacked", way(RED, BLACK)),
        "%STACKED_D%": form_svg("stacked-descriptor", way(RED, BLACK)),
        "%MARK%": mark_svg(way(RED, BLACK)),
        "%WORD%": form_svg("wordmark", way(RED, BLACK, BLACK)),
        "%V_COLOUR%": form_svg("horizontal", way(RED, BLACK)),
        "%V_REVERSE%": form_svg("horizontal", way(RED, BONE)),
        "%V_RED%": form_svg("horizontal", way(WHITE, WHITE)),
        "%V_BLACK%": form_svg("horizontal", way(BLACK, BLACK)),
        "%V_SKY%": form_svg("horizontal", way(WHITE, WHITE)),
        "%V_PHOTO%": form_svg("horizontal", way(RED, BONE)),
        "%CLEAR%": cs,
        "%SIZES%": cmp_rows,
        "%SWATCHES%": sw_html,
        "%SECONDARY%": sec_html,
        "%CONTRAST%": ct_rows,
        "%HZ_REV%": hz_rev,
        "%HZ_COL%": hz_col,
        "%CODE%": code,
        "%MARK_REV_TICKET%": mark_svg(way(RED, BONE), cls="mk"),
        "%MARK_REV%": mark_svg(way(RED, BONE)),
        "%W%": f(W), "%H%": f(Ht),
        "%MARK_BONE_SMALL%": mark_svg(way(RED, BONE), small_master=True),
        "%MARK_ON_RED%": mark_svg(way(BONE, BLACK)),
        "%BAND%": band_marks,
        "%PHONE%": phone_icons,
        "%DONTS%": dont_html,
        "%FILES%": file_html,
        "%RED%": RED, "%BLACK%": BLACK, "%BONE%": BONE,
        "%SKY%": SEC["sky"], "%GOLD%": SEC["gold"], "%GREEN%": SEC["green"], "%CONCRETE%": SEC["concrete"],
    }
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
  --paper:#FBF9F5;--muted:#6B665E;--rule:rgba(21,20,18,.14);
  --gutter:clamp(16px,4vw,48px);--max:1200px;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bone);color:var(--black);font-family:"Archivo",system-ui,sans-serif;font-size:17px;line-height:1.6;font-stretch:100%;-webkit-font-smoothing:antialiased}
img,svg{display:block;max-width:100%}
a{color:inherit}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter)}
.x-wide{font-stretch:125%}
section{padding:clamp(64px,10vw,128px) 0;border-top:1px solid var(--rule)}
.label{display:flex;gap:14px;align-items:baseline;font-stretch:125%;font-weight:600;font-size:12px;letter-spacing:.16em;text-transform:uppercase;margin:0 0 28px}
.label i{font-style:normal;color:var(--red)}
h2{font-stretch:125%;font-weight:600;font-size:clamp(28px,4.6vw,56px);line-height:1.02;letter-spacing:-.005em;margin:0 0 24px;text-transform:uppercase;max-width:16ch}
h3{font-stretch:125%;font-weight:600;font-size:15px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px}
p{margin:0 0 16px;max-width:62ch}
.lede{font-size:clamp(18px,2vw,22px);line-height:1.5;max-width:52ch}
.muted{color:var(--muted)}

/* cover */
.cover{background:var(--black);color:var(--bone);min-height:100svh;display:flex;flex-direction:column;border:0;padding:0}
.cover-top,.cover-foot{display:flex;justify-content:space-between;gap:16px;padding:22px var(--gutter);font-stretch:125%;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:500;opacity:.8}
.cover-main{flex:1;display:grid;place-items:center;padding:40px var(--gutter)}
.cover-logo{width:min(560px,82vw);height:auto}
.cover-foot span:last-child{text-align:right}

/* idea */
.idea-grid{display:grid;grid-template-columns:1fr;gap:48px}
.eqs{display:flex;align-items:stretch;gap:10px;flex-wrap:wrap}
.eq{margin:0;flex:1 1 180px;background:var(--paper);border-radius:6px;padding:22px 18px 18px;display:flex;flex-direction:column;gap:14px}
.eq-art svg{height:150px;width:auto;margin:0 auto}
.eq figcaption{font-size:14px;line-height:1.45;color:var(--muted)}
.eq figcaption b{display:block;color:var(--black);font-stretch:125%;font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}
.op{align-self:center;font-stretch:125%;font-weight:600;font-size:28px;color:var(--red);padding:0 2px}
.pull{font-stretch:125%;font-weight:600;font-size:clamp(22px,3vw,34px);line-height:1.15;text-transform:uppercase;max-width:30ch;margin:56px 0 0}
.pull em{font-style:normal;color:var(--red)}

/* construction */
.construct-wrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:clamp(28px,5vw,72px);align-items:start}
.construct-panel{background:var(--black);border-radius:6px;padding:clamp(12px,3vw,32px)}
.construct{width:100%;height:auto}
.construct text{font-family:"Archivo",sans-serif}
.rules{list-style:none;margin:0;padding:0;counter-reset:r}
.rules li{counter-increment:r;padding:18px 0;border-top:1px solid var(--rule);display:grid;grid-template-columns:40px 1fr;gap:6px}
.rules li::before{content:counter(r,decimal-leading-zero);font-stretch:125%;font-weight:600;color:var(--red);font-size:13px;padding-top:3px}
.rules p{margin:0;font-size:15.5px}

/* suite */
.hero-card{background:var(--paper);border-radius:6px;padding:clamp(36px,8vw,110px) clamp(20px,6vw,90px);display:grid;place-items:center;margin-bottom:14px}
.hero-lockup{width:min(720px,100%);height:auto}
.suite{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.card{background:var(--paper);border-radius:6px;padding:22px;display:flex;flex-direction:column;gap:18px}
.card .art{flex:1;display:grid;place-items:center;min-height:190px;padding:12px}
.card .art svg{max-height:150px;width:auto;max-width:100%}
.card .art .wm{width:100%;height:auto}
.card p{font-size:14.5px;margin:0;color:var(--muted)}
.tag{display:inline-block;font-size:10.5px;font-stretch:125%;font-weight:600;letter-spacing:.14em;text-transform:uppercase;background:var(--red);color:#fff;padding:3px 7px;border-radius:3px;margin-left:8px;vertical-align:2px}
.cap-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.cap-row h3{margin:0}
.hint{font-size:13px;color:var(--muted);margin-top:8px}

/* versions */
.versions{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.ver{border-radius:6px;min-height:220px;display:grid;place-items:center;padding:40px 32px;position:relative}
.ver svg{width:min(340px,100%);height:auto}
.ver span{position:absolute;left:16px;bottom:12px;font-size:11px;font-stretch:125%;letter-spacing:.14em;text-transform:uppercase;font-weight:600;opacity:.75}
.photo{background:radial-gradient(120% 90% at 70% 10%,#3f82e8 0%,#1D5FD0 38%,#0f2e6b 78%,#0a1a3a 100%)}
.photo::after{content:"";position:absolute;inset:auto 0 0 0;height:46%;background:linear-gradient(to top,rgba(10,16,30,.85),rgba(10,16,30,0));border-radius:0 0 6px 6px}
.photo svg,.photo span{z-index:1}

/* clear space */
.clear-wrap{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:clamp(28px,5vw,64px);align-items:center}
.clear{width:100%;height:auto;background:var(--paper);border-radius:6px;padding:10px}
.minsize{width:100%;border-collapse:collapse;font-size:15px;margin-top:10px}
.minsize td{padding:11px 0;border-top:1px solid var(--rule)}
.minsize td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-stretch:112%;font-weight:500}
.sizes{margin-top:44px;background:var(--paper);border-radius:6px;padding:22px}
.sz-row{display:flex;align-items:flex-end;gap:28px;padding:14px 0;flex-wrap:wrap}
.sz-row+.sz-row{border-top:1px solid var(--rule)}
.sz-l{flex:0 0 160px;font-size:13px;font-stretch:125%;font-weight:600;letter-spacing:.08em;text-transform:uppercase;align-self:center}
.sz{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:12px;color:var(--muted)}

/* colour */
.swatches{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.sw{border-radius:6px;padding:22px;min-height:300px;display:flex;flex-direction:column;gap:10px}
.sw.sm{min-height:200px}
.sw b{font-stretch:125%;font-weight:600;font-size:18px;letter-spacing:.04em;text-transform:uppercase}
.sw .use{font-size:14px;line-height:1.45;opacity:.85;max-width:30ch}
.sw dl{display:grid;grid-template-columns:52px 1fr;gap:2px 8px;margin:auto 0 0;font-size:13px;font-variant-numeric:tabular-nums}
.sw dt{opacity:.6;font-stretch:112%}
.sw dd{margin:0;font-weight:500}
.prim{box-shadow:inset 0 0 0 1px var(--rule)}
.ratio{display:flex;height:18px;border-radius:4px;overflow:hidden;margin:28px 0 8px}
.ratio div{height:100%}
.sub{margin-top:56px}
.chip{display:inline-grid;place-items:center;width:34px;height:26px;border-radius:4px;font-weight:600;font-size:13px;margin-right:12px;vertical-align:middle;box-shadow:inset 0 0 0 1px var(--rule)}
.ct{width:100%;border-collapse:collapse;font-size:15px}
.ct td{padding:10px 0;border-top:1px solid var(--rule)}
.ct td:nth-child(2){font-variant-numeric:tabular-nums;font-weight:500}
.ct td:last-child{text-align:right;color:var(--muted)}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:clamp(28px,5vw,64px)}

/* type */
.spec{background:var(--paper);border-radius:6px;padding:clamp(22px,4vw,44px);margin-bottom:14px;overflow:hidden}
.spec .big{font-stretch:125%;font-weight:600;font-size:clamp(34px,7vw,88px);line-height:.98;text-transform:uppercase;letter-spacing:.02em;margin:10px 0 18px;overflow-wrap:anywhere}
.spec .abc{font-stretch:125%;font-weight:600;font-size:clamp(16px,2.2vw,24px);letter-spacing:.06em;overflow-wrap:anywhere}
.spec .txt{font-size:clamp(18px,2.2vw,24px);line-height:1.45;max-width:40ch}
.spec .meta{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.hier{display:grid;gap:14px;margin-top:22px}
.hier div{display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:baseline;border-top:1px solid var(--rule);padding-top:12px}
.hier small{font-size:12px;color:var(--muted)}

/* applications */
.apps{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px}
.apps>figure{margin:0;border-radius:6px;overflow:hidden;position:relative;display:flex;flex-direction:column}
.apps figcaption{font-size:12px;font-stretch:125%;letter-spacing:.14em;text-transform:uppercase;font-weight:600;padding:12px 2px 0}
.a-web{grid-column:span 6}
.a-phone,.a-ticket{grid-column:span 3}
.a-band,.a-sign,.a-social{grid-column:span 2}
.web{background:var(--sky);border-radius:6px;overflow:hidden;aspect-ratio:16/8;min-height:300px;position:relative;color:#fff}
.web .sky{position:absolute;inset:0;background:radial-gradient(110% 120% at 80% 0%,#4b8ef0 0%,#1D5FD0 45%,#123f94 100%)}
.web .t1,.web .t2{position:absolute;bottom:-4%;width:20%}
.web .t1{right:22%}.web .t2{right:2%;width:17%;bottom:-8%}
.web nav{position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px clamp(16px,3vw,32px);background:rgba(21,20,18,.92)}
.web nav .lg{height:34px;width:auto}
.web nav ul{display:flex;gap:22px;list-style:none;margin:0;padding:0;font-size:13px;font-weight:500;letter-spacing:.02em}
.web nav .btn{background:var(--red);color:#fff;font-stretch:125%;font-weight:600;font-size:12px;letter-spacing:.12em;text-transform:uppercase;padding:10px 16px;border-radius:3px;white-space:nowrap}
.web .hero{position:relative;padding:clamp(24px,5vw,64px) clamp(16px,3vw,32px);max-width:620px}
.web .hero h4{font-stretch:125%;font-weight:600;font-size:clamp(26px,4.4vw,54px);line-height:1;text-transform:uppercase;margin:0 0 14px}
.web .hero p{font-size:clamp(14px,1.5vw,17px);opacity:.92;margin:0 0 20px}
.web .hero .chips{display:flex;gap:8px;flex-wrap:wrap}
.web .hero .chips span{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-stretch:125%;font-weight:600;letter-spacing:.12em;text-transform:uppercase;padding:8px 11px;border-radius:3px;color:#fff;background:rgba(21,20,18,.82)}
.web .hero .chips i{width:8px;height:8px;border-radius:50%}
.phone-bg{background:#d9d3c7;border-radius:6px;display:grid;place-items:center;padding:36px 16px;flex:1}
.phone{width:min(260px,100%);aspect-ratio:9/18.5;background:linear-gradient(160deg,#2a2622,#0f0e0c);border-radius:34px;padding:52px 18px 18px;box-shadow:0 0 0 7px #151412,0 22px 50px rgba(0,0,0,.25)}
.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px 10px}
.app{display:flex;flex-direction:column;align-items:center;gap:5px}
.app .ic{width:100%;aspect-ratio:1;border-radius:22%;overflow:hidden}
.app .ic img{width:100%;height:100%}
.app .ph{background:rgba(243,239,231,.12)}
.app span{font-size:8px;color:#eee;white-space:nowrap;min-height:11px}
.ticket-bg{background:#d9d3c7;border-radius:6px;display:grid;place-items:center;padding:36px 16px;flex:1}
.ticket{display:grid;grid-template-columns:1fr auto;width:min(460px,100%);background:var(--black);color:var(--bone);border-radius:10px;overflow:hidden;box-shadow:0 18px 40px rgba(0,0,0,.2)}
.ticket .main{padding:22px 22px 20px;display:flex;flex-direction:column;gap:16px;min-width:0}
.ticket .main svg.mk{height:46px;width:auto}
.ticket .act{font-stretch:125%;font-weight:600;font-size:clamp(20px,2.6vw,28px);line-height:1;text-transform:uppercase}
.ticket .act small{display:block;font-size:11px;letter-spacing:.14em;color:var(--red);margin-bottom:6px}
.ticket .row{display:flex;gap:22px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;opacity:.85;flex-wrap:wrap}
.ticket .row b{display:block;font-size:13px;letter-spacing:.02em;opacity:1;font-weight:600}
.ticket .stub{background:var(--red);padding:18px 16px;display:flex;flex-direction:column;justify-content:space-between;gap:12px;border-left:2px dashed rgba(21,20,18,.5);width:130px}
.ticket .code{width:96px;height:96px}
.ticket .stub span{font-size:10px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;font-stretch:125%;color:#fff}
.band-bg{background:var(--paper);border-radius:6px;display:grid;place-items:center;padding:40px 0;flex:1;overflow:hidden}
.band{width:130%;transform:rotate(-8deg);background:var(--red);color:var(--bone);display:flex;align-items:center;gap:16px;padding:14px 18px;white-space:nowrap;border-radius:4px;box-shadow:0 10px 24px rgba(0,0,0,.12)}
.band .bm svg{height:30px;width:auto}
.band .bw{font-stretch:125%;font-weight:600;font-size:15px;letter-spacing:.16em}
.sign-bg{background:#cfc8bb;border-radius:6px;display:grid;place-items:center;padding:28px 16px 0;flex:1}
.totem{width:150px;background:var(--black);color:var(--bone);padding:22px 16px 26px;display:flex;flex-direction:column;gap:14px;border-radius:2px 2px 0 0}
.totem svg{height:64px;width:auto;margin:0 auto 6px}
.totem div{display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(243,239,231,.18);padding-top:9px;font-size:11.5px;font-weight:500}
.totem i{font-style:normal;width:8px;height:8px;border-radius:50%;display:inline-block;margin-right:7px}
.social-bg{background:var(--paper);border-radius:6px;display:flex;align-items:center;justify-content:center;gap:16px;padding:36px 12px;flex:1;flex-wrap:wrap}
.av{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;overflow:hidden}
.av svg{height:52%;width:auto}

/* don'ts */
.donts{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.dont{margin:0}
.dont-art{background:var(--paper);border-radius:6px;padding:26px;position:relative;display:grid;place-items:center;height:200px}
.dont-art svg{max-height:140px;width:auto;max-width:100%}
.x{position:absolute;top:12px;right:12px;width:22px;height:22px;border-radius:50%;background:var(--red)}
.x::before,.x::after{content:"";position:absolute;left:5px;right:5px;top:10px;height:2px;background:#fff;transform:rotate(45deg)}
.x::after{transform:rotate(-45deg)}
.dont figcaption{font-size:14px;color:var(--muted);padding-top:12px;line-height:1.45}
.dont figcaption b{display:block;color:var(--black);font-stretch:125%;font-weight:600;font-size:13px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}

/* files */
.files{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:28px}
.files h4{font-stretch:125%;font-weight:600;font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin:0 0 10px}
.files ul{list-style:none;margin:0;padding:0;font-size:13.5px}
.files li{padding:6px 0;border-top:1px solid var(--rule)}
.files a{text-decoration:none}
.files a:hover{color:var(--red)}
footer{background:var(--black);color:var(--bone);padding:48px 0;font-size:13px}
footer .wrap{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;opacity:.75}

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
  .eq-art svg{height:110px}
  .web .t1{display:none}
  .apps{grid-template-columns:1fr}
  .a-web,.a-phone,.a-ticket,.a-band,.a-sign,.a-social{grid-column:auto}
  .ticket{grid-template-columns:1fr}
  .ticket .stub{width:auto;flex-direction:row;align-items:center;border-left:0;border-top:2px dashed rgba(21,20,18,.5)}
  .sz-l{flex-basis:100%}
  .cover-foot{flex-direction:column}
  .cover-foot span:last-child{text-align:left}
  .hier div{grid-template-columns:1fr}
}
</style>
</head>
<body>
%DEFS%

<section class="cover" aria-label="Cover">
  <div class="cover-top"><span>Soweto Towers</span><span>Identity · Logo proposal</span></div>
  <div class="cover-main">%COVER%</div>
  <div class="cover-foot"><span>Orlando East, Soweto</span><span>November 2026 · Version 1.0</span></div>
</section>

<section id="idea">
  <div class="wrap">
    <p class="label"><i>01</i> The idea</p>
    <h2>Look between the towers.</h2>
    <p class="lede">The Orlando cooling towers are Soweto’s best-known skyline. The mark draws them as they are, two true hyperboloids, and lets the space between them do the talking. The suspension bridge across their tops is the crossbar. The 100&nbsp;m drop from it is the stem. Together they spell T, for Towers.</p>
    <div class="eqs" style="margin-top:44px">%EQ%</div>
    <p class="pull">A landmark, a letter <em>and a leap</em>, in one shape.</p>
  </div>
</section>

<section id="construction">
  <div class="wrap construct-wrap">
    <div class="construct-panel">%CONSTRUCT%</div>
    <div>
      <p class="label"><i>02</i> Construction</p>
      <h2>Drawn like the real thing.</h2>
      <ol class="rules">
        <li><div><h3>True hyperboloid</h3><p>Each tower follows the curve of a real cooling tower: a wide base (B), a throat (a) at %THROAT%% of its height, and a slight flare at the rim. A hyperboloid is made entirely of straight lines, shown in the drawing.</p></div></li>
        <li><div><h3>One cut</h3><p>A single cut width (s) separates every part: the bridge from the towers, and the towers from the drop. It is what turns two shapes into a letter.</p></div></li>
        <li><div><h3>The drop stops short</h3><p>The stem tapers to a point just above the ground, like the cord at full stretch.</p></div></li>
        <li><div><h3>Built square</h3><p>The bridge spans exactly the two tower bases (W = 4B + 2s). The mark sits on a flat baseline and a flat top, so it aligns cleanly with type, grids and edges.</p></div></li>
      </ol>
    </div>
  </div>
</section>

<section id="suite">
  <div class="wrap">
    <p class="label"><i>03</i> The logo suite</p>
    <h2>One mark, four lockups.</h2>
    <div class="hero-card">%PRIMARY%</div>
    <div class="cap-row"><h3>Primary · Horizontal <span class="tag">Default</span></h3></div>
    <p class="hint">The two lines of the wordmark share one width, and their O, W and E sit in the same columns. The type spans the tower height so the bridge stands over the name.</p>
    <div class="suite" style="margin-top:36px">
      <div class="card"><div class="art">%STACKED%</div><div><h3>Stacked</h3><p>Square and portrait formats: social, posters, merchandise.</p></div></div>
      <div class="card"><div class="art">%STACKED_D%</div><div><h3>Stacked + descriptor</h3><p>Where people meet the brand for the first time: signage, print, press.</p></div></div>
      <div class="card"><div class="art">%MARK%</div><div><h3>Mark</h3><p>App icon, favicon, wristbands, stamps, and anywhere the name is already present.</p></div></div>
      <div class="card"><div class="art">%WORD%</div><div><h3>Wordmark</h3><p>Narrow horizontal spaces, and as a sign-off where the mark already appears nearby.</p></div></div>
    </div>
  </div>
</section>

<section id="versions">
  <div class="wrap">
    <p class="label"><i>04</i> Colour versions</p>
    <h2>Red is for the drop.</h2>
    <p class="lede">In full colour the T is always Drop Red. Where only one colour is possible, the whole logo goes to that colour and the cuts still draw the T.</p>
    <div class="versions" style="margin-top:40px">
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
        <p>Keep a clear space of <b>x</b> on every side, where x is the width of one tower base (about half the mark’s width). Nothing else enters that space: no type, edges or other logos.</p>
        <table class="minsize" aria-label="Minimum sizes">
          <tr><td>Horizontal lockup</td><td>120 px · 30 mm wide</td></tr>
          <tr><td>Stacked lockup</td><td>90 px · 24 mm wide</td></tr>
          <tr><td>Mark, master</td><td>40 px · 10 mm tall</td></tr>
          <tr><td>Mark, small-size master</td><td>16–40 px · 4–10 mm</td></tr>
        </table>
      </div>
    </div>
    <div class="sizes">
      <h3>Small-size master</h3>
      <p class="muted" style="font-size:14.5px">Below 40 px the master’s fine cuts close up. The small-size master opens the cuts and thickens the bridge so the T survives in a browser tab.</p>
      %SIZES%
    </div>
  </div>
</section>

<section id="colour">
  <div class="wrap">
    <p class="label"><i>06</i> Colour</p>
    <h2>Concrete, steel and one red.</h2>
    <p class="lede">The core palette is three colours. Bone gives the space, Tower Black gives the structure, and Drop Red is used sparingly, for the moment that matters.</p>
    <div class="ratio" aria-label="Colour proportions: Bone 55 percent, Tower Black 30 percent, Drop Red 10 percent, secondary colours 5 percent">
      <div style="flex:55;background:var(--bone);box-shadow:inset 0 0 0 1px var(--rule)"></div><div style="flex:30;background:var(--black)"></div><div style="flex:10;background:var(--red)"></div><div style="flex:1.25;background:var(--sky)"></div><div style="flex:1.25;background:var(--gold)"></div><div style="flex:1.25;background:var(--green)"></div><div style="flex:1.25;background:var(--concrete)"></div>
    </div>
    <p class="muted" style="font-size:13px">Approximate share of a typical layout.</p>
    <div class="swatches prim" style="box-shadow:none;margin-top:28px">%SWATCHES%</div>
    <div class="sub">
      <h3>Secondary · Mural palette</h3>
      <p class="muted" style="font-size:15px">Taken from the murals painted on the towers. Each colour codes one family of activities across the website, booking engine, wristbands and wayfinding, so people can find their adventure by colour.</p>
      <div class="swatches" style="margin-top:18px">%SECONDARY%</div>
    </div>
    <div class="sub two">
      <div>
        <h3>Accessible pairings</h3>
        <p class="muted" style="font-size:15px">WCAG 2.1 contrast. Body text needs AA (4.5 : 1); large headings and buttons need 3 : 1.</p>
      </div>
      <table class="ct">%CONTRAST%</table>
    </div>
    <p class="muted" style="font-size:13px;margin-top:22px">CMYK values are starting points. Approve colour on a printed proof.</p>
  </div>
</section>

<section id="type">
  <div class="wrap">
    <p class="label"><i>07</i> Typography</p>
    <h2>One family, two widths.</h2>
    <p class="lede">Archivo is a free, open-source typeface (SIL Open Font License) on Google Fonts. A single variable file holds both the expanded display cut used in the wordmark and the regular text cut, so the website loads one font.</p>
    <div class="spec" style="margin-top:36px">
      <div class="meta"><span>Display · Archivo Expanded SemiBold</span><span>width 125 · weight 600 · uppercase · tracking +4%</span></div>
      <div class="big">Vertical<br>adventure</div>
      <div class="abc">ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789</div>
    </div>
    <div class="spec">
      <div class="meta"><span>Text · Archivo Regular &amp; Medium</span><span>width 100 · weight 400 / 500 · sentence case</span></div>
      <p class="txt" style="margin:14px 0 0">Open Thursday from 12:00, and Friday to Sunday from 10:00, until sunset. Corner of Sheffield Road and Chris Hani Road, Orlando East.</p>
      <div class="hier">
        <div><small>H1 · 56/56</small><span class="x-wide" style="font-weight:600;font-size:clamp(24px,4vw,40px);line-height:1;text-transform:uppercase">Bungee jump</span></div>
        <div><small>H2 · 28/32</small><span class="x-wide" style="font-weight:600;font-size:22px;text-transform:uppercase">Before you jump</span></div>
        <div><small>Body · 17/27</small><span>Jump from the suspension bridge between the towers with a cord around your feet.</span></div>
        <div><small>Label · 12/16</small><span class="x-wide" style="font-weight:600;font-size:12px;letter-spacing:.16em;text-transform:uppercase">Weight 35–110 kg</span></div>
      </div>
    </div>
  </div>
</section>

<section id="use">
  <div class="wrap">
    <p class="label"><i>08</i> In use</p>
    <h2>Built to work.</h2>
    <p class="lede">The identity has to hold up in a browser tab, on a wristband, on a voucher in someone’s inbox and on a sign at the gate. These sketches show how.</p>
    <div class="apps" style="margin-top:40px">
      <figure class="a-web">
        <div class="web" role="img" aria-label="Website header with the horizontal logo">
          <div class="sky"></div>
          <svg class="t1" viewBox="0 0 %W% %H%" aria-hidden="true"><use href="#p-mark" style="--tee:transparent;--tw:rgba(10,20,45,.55)"/></svg>
          <nav>%HZ_REV%<ul><li>Adventures</li><li>Plan your visit</li><li>Groups &amp; schools</li><li>About</li></ul><span class="btn">Buy a voucher</span></nav>
          <div class="hero"><h4>Jump from Soweto’s skyline.</h4><p>Bungee, SCAD freefall, zipline and paintball at the Orlando cooling towers.</p>
            <div class="chips"><span><i style="background:var(--red)"></i>Bungee</span><span><i style="background:#6FA3FF"></i>SCAD freefall</span><span><i style="background:var(--gold)"></i>Zipline</span><span><i style="background:#3DBB7F"></i>Paintball</span></div></div>
        </div>
        <figcaption>Website header</figcaption>
      </figure>
      <figure class="a-phone"><div class="phone-bg"><div class="phone"><div class="grid">%PHONE%</div></div></div><figcaption>App icon</figcaption></figure>
      <figure class="a-ticket"><div class="ticket-bg">
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
    <div class="files" style="margin-top:28px">%FILES%</div>
  </div>
</section>

<footer><div class="wrap"><span>Soweto Towers · Identity proposal · Version 1.0</span><span>Typeface: Archivo by Omnibus-Type, SIL Open Font License 1.1</span></div></footer>
</body>
</html>
"""
