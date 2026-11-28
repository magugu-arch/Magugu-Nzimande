"""Print layout (A4 landscape) for the Soweto Towers logo options deck.

Rendered to PDF with headless Chromium, so every logo stays vector and the
typeface is embedded."""
import base64
from options_page import _inline

DATE = "November 2026"
RUN = "Soweto Towers · Logo options"


def render(options, pair, font_path, way_col, way_rev, tile):
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()
    WHITE = {"ink": "#FFFFFF", "acc": "#FFFFFF"}
    BONE_WAY = {"ink": "#F3EFE7", "acc": "#DA291C"}
    pages = []

    def icon_of(o):
        return _inline(tile(o["small"], o["icon_way"], o["icon_bg"], fill=o["icon_fill"], by=o.get("icon_by", "w")), "ic")

    def frame(body, n, cls="", dark=False):
        foot = (f'<footer class="pf"><span>{RUN}</span><span>{DATE}</span><span class="pn">{n:02d}</span></footer>')
        return f'<section class="page {cls}{" dark" if dark else ""}">{body}{foot}</section>'

    # 1 ----------------------------------------------------------------- cover
    syms = "".join(f'<div class="cm">{_inline(o["small"].svg(BONE_WAY, o["small"].h * 0.02))}</div>' for o in options)
    pages.append(frame(f"""
      <div class="cover-run"><span>Soweto Towers</span><span>Logo options · Round 2</span></div>
      <h1 class="cover-h">Six ways to say<br><em>Soweto Towers.</em></h1>
      <div class="cms">{syms}</div>""", 1, "cover", dark=True))

    # 2 ----------------------------------------------------------------- brief + contents
    toc = "".join(
        f'<li><b>{o["n"]:02d}</b><span><strong>{o["title"]}</strong>{o["line"]}</span><i>{o["n"] + 2:02d}</i></li>'
        for o in options)
    toc += '<li><b>—</b><span><strong>Side by side</strong>All six at the same size</span><i>09</i></li>'
    toc += '<li><b>—</b><span><strong>Recommendation</strong>The Jump, with the two-T name</span><i>10</i></li>'
    pages.append(frame(f"""
      <div class="two-col">
        <div>
          <p class="label">How to read this</p>
          <h2>Six directions,<br>one fair test.</h2>
          <p class="lede">Every option uses the same colours and the same typeface, so you are comparing ideas, not decoration. Each page shows the logo, its reverse, a one-colour version, and the app icon from 96 px down to 16 px, where most logos fail.</p>
          <div class="facts">
            <div class="fact"><b>Colour</b><span>Tower Black, Bone, and one red, kept for the moment that matters.</span>
              <div class="sw"><i style="background:#151412"></i><i style="background:#F3EFE7"></i><i style="background:#DA291C"></i></div></div>
            <div class="fact"><b>Type</b><span>Archivo, free and open source. The name is set in widely spaced capitals at a modest weight.</span></div>
            <div class="fact"><b>Asked for</b><span>An S + T monogram (option 02) and a pure logotype (option 03).</span></div>
          </div>
        </div>
        <div>
          <p class="label">Contents</p>
          <ol class="toc">{toc}</ol>
        </div>
      </div>""", 2))

    # 3-8 ---------------------------------------------------------------- one page per option
    for o in options:
        lock = o["lock"]
        wide = " wide" if lock.w / lock.h > 4 else ""
        icon = icon_of(o)
        sizes = "".join(f'<figure class="sz"><div style="width:{z}px;height:{z}px">{icon}</div><figcaption>{z}</figcaption></figure>'
                        for z in (96, 48, 32, 16))
        pages.append(frame(f"""
          <header class="ph"><span class="kicker">Option {o['n']:02d}</span></header>
          <div class="opt-grid">
            <div class="hero{wide}">{_inline(lock.svg(way_col, lock.h * 0.02), 'lk')}</div>
            <div class="side">
              <h2>{o['title']}</h2>
              <p class="line">{o['line']}</p>
              <p class="idea">{o['idea']}</p>
              <dl><dt>Strength</dt><dd>{o['best']}</dd><dt>Watch out</dt><dd>{o['watch']}</dd></dl>
              <div class="tiles">
                <div class="t dark">{_inline(lock.svg(way_rev, lock.h * 0.02), 'lk')}<span>Reverse</span></div>
                <div class="t red">{_inline(lock.svg(WHITE, lock.h * 0.02), 'lk')}<span>One colour</span></div>
              </div>
              <div class="icons"><div class="sizes">{sizes}</div><span>App icon · 96, 48, 32, 16 px</span></div>
            </div>
          </div>""", o["n"] + 2))

    # 9 ----------------------------------------------------------------- side by side
    cards = "".join(
        f'<div class="cmp"><div class="cmp-art">{_inline(o["lock"].svg(way_col, o["lock"].h * 0.02), "lk")}</div>'
        f'<span><b>{o["n"]:02d}</b>{o["title"]}</span></div>' for o in options)
    icons = "".join(f'<figure class="ir"><div class="irb">{icon_of(o)}</div><figcaption>{o["n"]:02d}</figcaption></figure>' for o in options)
    pages.append(frame(f"""
      <header class="ph"><span class="kicker">Side by side</span></header>
      <h2 class="h-inline">All six, same size.</h2>
      <div class="cmps">{cards}</div>
      <div class="irs">{icons}</div>""", 9))

    # 10 ---------------------------------------------------------------- recommendation
    pages.append(frame(f"""
      <header class="ph"><span class="kicker">Recommendation</span></header>
      <div class="rec">
        <div class="rec-text">
          <h2>The Jump, with<br>the two-T name.</h2>
          <p class="idea">Option 01’s symbol is the one people will recognise from across the road. Option 03’s name adds a detail they discover later. Put together, the towers appear twice: once as the picture and once hidden in the letters.</p>
          <ul class="why">
            <li><b>Familiar.</b> Anyone who has seen the towers knows the symbol at once.</li>
            <li><b>Purposeful.</b> The only colour marks the jump, the reason people come.</li>
            <li><b>Crafted.</b> Every curve is a true cooling-tower profile, and every size is a ratio of one unit.</li>
          </ul>
          <p class="next"><b>Next step.</b> Choose one option, or a pairing, and it will be built into the full system: artwork in every format, app and web icons, and guidelines.</p>
        </div>
        <div class="rec-tiles">
          <div class="t light">{_inline(pair.svg(way_col, pair.h * 0.02), 'lk')}<span>Colour</span></div>
          <div class="t dark">{_inline(pair.svg(way_rev, pair.h * 0.02), 'lk')}<span>Reverse</span></div>
        </div>
      </div>""", 10))

    return TEMPLATE.replace("%FONT%", font64).replace("%PAGES%", "".join(pages))


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Soweto Towers Logo Options</title>
<style>
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,%FONT%) format("woff2");font-weight:100 900;font-stretch:62% 125%}
@page{size:297mm 210mm;margin:0}
:root{--red:#DA291C;--black:#151412;--bone:#F3EFE7;--paper:#FBF9F5;--muted:#6B665E;--rule:rgba(21,20,18,.12)}
*{box-sizing:border-box}
html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:"Archivo",sans-serif;color:var(--black);-webkit-font-smoothing:antialiased}
svg{display:block;max-width:100%}
.page{width:297mm;height:210mm;position:relative;overflow:hidden;background:var(--bone);padding:13mm 15mm 0;break-after:page;page-break-after:always;display:flex;flex-direction:column}
.page:last-child{break-after:auto;page-break-after:auto}
.page.dark{background:var(--black);color:var(--bone)}
.pf{position:absolute;left:15mm;right:15mm;bottom:8mm;display:flex;gap:8mm;font-stretch:118%;font-weight:500;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}
.pf .pn{margin-left:auto;color:var(--red)}
.dark .pf{color:rgba(243,239,231,.55)}
.label,.kicker{font-stretch:118%;font-weight:500;font-size:7pt;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);margin:0}
.kicker{color:var(--red)}
.ph{height:7mm}
h1,h2{font-weight:600;font-stretch:104%;letter-spacing:-.025em;line-height:1.04;margin:0}
h2{font-size:26pt}
.lede{font-size:11pt;line-height:1.5;color:#3a3733;max-width:120mm;margin:6mm 0 0}

/* cover */
.cover{padding-top:11mm}
.cover-run{display:flex;justify-content:space-between;font-stretch:118%;font-weight:500;font-size:7pt;letter-spacing:.22em;text-transform:uppercase;opacity:.7}
.cover-h{font-size:46pt;margin-top:30mm}
.cover-h em{font-style:normal;color:var(--red)}
.cms{position:absolute;left:15mm;right:15mm;bottom:26mm;display:grid;grid-template-columns:repeat(6,1fr);gap:12mm;align-items:center}
.cm svg{width:100%;height:auto;max-height:20mm}

/* brief */
.two-col{display:grid;grid-template-columns:1.15fr 1fr;gap:16mm;margin-top:4mm}
.two-col h2{margin-top:5mm}
.facts{display:grid;gap:3mm;margin-top:8mm}
.fact{background:var(--paper);border-radius:3mm;padding:4mm 5mm;font-size:8.5pt;line-height:1.45}
.fact b{display:block;font-weight:600;font-size:9pt;margin-bottom:1mm}
.fact span{color:var(--muted)}
.sw{display:flex;gap:2mm;margin-top:2.5mm}
.sw i{width:6mm;height:6mm;border-radius:50%;box-shadow:inset 0 0 0 .3mm var(--rule)}
.toc{list-style:none;margin:5mm 0 0;padding:0}
.toc li{display:grid;grid-template-columns:10mm 1fr 8mm;gap:3mm;align-items:baseline;padding:3.2mm 0;border-top:.25mm solid var(--rule);font-size:8.5pt;color:var(--muted)}
.toc li b{color:var(--red);font-weight:500;font-variant-numeric:tabular-nums}
.toc li strong{display:block;color:var(--black);font-weight:600;font-size:10.5pt;margin-bottom:.5mm}
.toc li i{font-style:normal;text-align:right;font-variant-numeric:tabular-nums}

/* option */
.opt-grid{flex:1;display:grid;grid-template-columns:1.62fr 1fr;gap:8mm;padding-bottom:18mm;min-height:0}
.hero{background:var(--paper);border-radius:4mm;display:grid;place-items:center;padding:14mm}
.hero .lk{width:118mm;max-width:100%;height:auto;max-height:84mm}
.hero.wide .lk{width:150mm}
.side{display:flex;flex-direction:column;min-width:0}
.side h2{font-size:24pt}
.line{font-size:11pt;color:var(--muted);margin:2mm 0 0}
.idea{font-size:9pt;line-height:1.5;color:#3a3733;margin:5mm 0 0}
dl{margin:3mm 0 0;font-size:8.5pt;line-height:1.45}
dt{font-stretch:118%;font-weight:500;font-size:6.5pt;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:3mm}
dd{margin:.8mm 0 0}
.tiles{display:grid;grid-template-columns:1fr 1fr;gap:3mm;margin-top:auto}
.t{border-radius:3mm;height:30mm;display:grid;place-items:center;padding:4mm 4mm 6mm;position:relative;min-width:0}
.t .lk{width:100%;height:auto;max-height:17mm}
.t span{position:absolute;left:3mm;bottom:2mm;font-size:6pt;font-weight:500;opacity:.7}
.t.dark{background:var(--black);color:var(--bone)}
.t.red{background:var(--red);color:#fff}
.t.light{background:var(--paper)}
.icons{margin-top:3mm;background:var(--paper);border-radius:3mm;padding:4mm 4mm 2.5mm;position:relative}
.icons>span{display:block;font-size:6pt;font-weight:500;color:var(--muted);margin-top:2mm}
.sizes{display:flex;align-items:flex-end;justify-content:center;gap:6mm}
.sz{margin:0;display:flex;flex-direction:column;align-items:center;gap:1mm}
.sz div{border-radius:22.5%;overflow:hidden}
.sz .ic{width:100%;height:100%}
.sz figcaption{font-size:5.5pt;color:var(--muted)}

/* compare */
.h-inline{margin:1mm 0 6mm}
.cmps{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
.cmp{background:var(--paper);border-radius:3mm;padding:3mm 4mm 3mm;display:flex;flex-direction:column;gap:2mm}
.cmp-art{height:36mm;display:grid;place-items:center;padding:2mm}
.cmp-art .lk{width:auto;max-width:62mm;height:auto;max-height:30mm}
.cmp span{font-size:8pt;color:var(--muted)}
.cmp span b{color:var(--red);font-weight:500;margin-right:2mm}
.irs{display:grid;grid-template-columns:repeat(6,1fr);gap:6mm;margin-top:6mm;padding:0 14mm}
.ir{margin:0;display:flex;flex-direction:column;align-items:center;gap:1.5mm}
.irb{width:16mm;height:16mm;border-radius:22.5%;overflow:hidden}
.irb .ic{width:100%;height:100%}
.ir figcaption{font-size:6.5pt;color:var(--muted)}

/* recommendation */
.rec{flex:1;display:grid;grid-template-columns:1fr 1.25fr;gap:10mm;padding-bottom:18mm;min-height:0}
.rec-text h2{font-size:26pt;margin-top:2mm}
.why{margin:5mm 0 0;padding-left:4.5mm;font-size:9pt;line-height:1.5;color:#3a3733}
.why li{margin-bottom:1.8mm}
.next{font-size:9pt;line-height:1.5;margin:6mm 0 0;padding-top:4mm;border-top:.25mm solid var(--rule)}
.rec-tiles{display:grid;grid-template-rows:1fr 1fr;gap:4mm}
.rec-tiles .t{height:auto}
.rec-tiles .t .lk{width:auto;max-width:80mm;max-height:52mm}
</style>
</head>
<body>
%PAGES%
</body>
</html>
"""
