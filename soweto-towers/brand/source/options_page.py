"""Presentation page for the six Soweto Towers logo options."""
import base64


def _inline(svg, cls="", label=None):
    """Strip the XML namespace/title for inline use and add a class."""
    s = svg.replace(' xmlns="http://www.w3.org/2000/svg"', "")
    return s.replace("<svg ", f'<svg class="{cls}" ', 1)


def render(options, pair, font_path, way_col, way_rev, tile):
    font64 = base64.b64encode(open(font_path, "rb").read()).decode()
    WHITE = {"ink": "#FFFFFF", "acc": "#FFFFFF"}

    cover_marks = "".join(
        f'<div class="cm">{_inline(o["small"].svg({"ink": "#F3EFE7", "acc": "#DA291C"}, o["small"].h * 0.02))}</div>'
        for o in options)

    boards = []
    for o in options:
        lock, small = o["lock"], o["small"]
        n = f"{o['n']:02d}"
        icon = _inline(tile(small, o["icon_way"], o["icon_bg"], fill=o["icon_fill"], by=o.get("icon_by", "w")), "ic")
        sizes = "".join(
            f'<figure class="sz"><div style="width:{z}px;height:{z}px">{icon}</div><figcaption>{z}</figcaption></figure>'
            for z in (96, 48, 32, 16))
        boards.append(f"""
<section class="board" id="option-{o['n']}">
  <div class="wrap">
    <header class="bh"><span class="num">{n}</span><div><h2>{o['title']}</h2><p class="line">{o['line']}</p></div></header>
    <div class="hero{' wide' if lock.w / lock.h > 4 else ''}">{_inline(lock.svg(way_col, lock.h * 0.02), 'lk')}</div>
    <div class="cols">
      <div class="txt">
        <p>{o['idea']}</p>
        <dl><dt>Strength</dt><dd>{o['best']}</dd><dt>Watch out</dt><dd>{o['watch']}</dd></dl>
      </div>
      <div class="tiles">
        <div class="t dark">{_inline(lock.svg(way_rev, lock.h * 0.02), 'lk')}<span>Reverse</span></div>
        <div class="t red">{_inline(lock.svg(WHITE, lock.h * 0.02), 'lk')}<span>One colour</span></div>
        <div class="t icons"><div class="sizes">{sizes}</div><span>App icon at 96, 48, 32 and 16 px</span></div>
      </div>
    </div>
  </div>
</section>""")

    compare = "".join(
        f'<a class="cmp" href="#option-{o["n"]}"><div class="cmp-art">{_inline(o["lock"].svg(way_col, o["lock"].h * 0.02), "lk")}</div>'
        f'<span><b>{o["n"]:02d}</b> {o["title"]}</span></a>' for o in options)
    icons_row = "".join(
        f'<figure class="ir"><div class="irb">{_inline(tile(o["small"], o["icon_way"], o["icon_bg"], fill=o["icon_fill"], by=o.get("icon_by", "w")), "ic")}</div>'
        f'<figcaption>{o["n"]:02d}</figcaption></figure>' for o in options)

    files = "".join(
        f'<li><b>{o["n"]:02d} {o["title"]}</b> <a href="{o["dir"]}/logo-colour.svg" download>colour</a> · '
        f'<a href="{o["dir"]}/logo-reverse.svg" download>reverse</a> · <a href="{o["dir"]}/logo-white.svg" download>white</a> · '
        f'<a href="{o["dir"]}/symbol-colour.svg" download>symbol</a> · <a href="{o["dir"]}/app-icon.svg" download>app icon</a> · '
        f'<a href="{o["dir"]}/logo-colour.png" download>PNG</a></li>' for o in options)

    html = TEMPLATE
    for k, v in {
        "%FONT%": font64, "%COVER%": cover_marks, "%BOARDS%": "".join(boards), "%COMPARE%": compare,
        "%ICONS%": icons_row, "%FILES%": files,
        "%PAIR%": _inline(pair.svg(way_col, pair.h * 0.02), "lk"),
        "%PAIR_REV%": _inline(pair.svg(way_rev, pair.h * 0.02), "lk"),
    }.items():
        html = html.replace(k, v)
    return html


TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Soweto Towers Logo Options</title>
<meta name="description" content="Six logo directions for Soweto Towers, the vertical adventure centre at the Orlando cooling towers.">
<style>
@font-face{font-family:"Archivo";src:url(data:font/woff2;base64,%FONT%) format("woff2");font-weight:100 900;font-stretch:62% 125%;font-display:swap}
:root{--red:#DA291C;--black:#151412;--bone:#F3EFE7;--paper:#FBF9F5;--muted:#6B665E;--rule:rgba(21,20,18,.12);--gutter:clamp(16px,4vw,48px);--max:1180px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--bone);color:var(--black);font-family:"Archivo",system-ui,sans-serif;font-size:1.0625rem;line-height:1.6;-webkit-font-smoothing:antialiased}
svg{display:block;max-width:100%}
a{color:inherit}
.wrap{max-width:var(--max);margin:0 auto;padding:0 var(--gutter)}
section{padding:clamp(64px,10vw,128px) 0;border-top:1px solid var(--rule)}
.label{font-stretch:118%;font-weight:500;font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin:0 0 20px}
h1,h2{font-weight:600;font-stretch:104%;letter-spacing:-.025em;line-height:1.04;margin:0}
h2{font-size:clamp(2rem,4.6vw,3.25rem)}
.lede{font-size:clamp(1.125rem,1.9vw,1.3125rem);line-height:1.55;max-width:56ch;color:#3a3733}

/* cover */
.cover{background:var(--black);color:var(--bone);min-height:92svh;display:flex;flex-direction:column;border:0;padding:0}
.cover-top{display:flex;justify-content:space-between;gap:16px;padding:22px var(--gutter);font-stretch:118%;font-size:.6875rem;letter-spacing:.22em;text-transform:uppercase;font-weight:500;opacity:.7}
.cover-main{flex:1;display:flex;flex-direction:column;justify-content:center;gap:56px;padding:40px var(--gutter);max-width:var(--max);margin:0 auto;width:100%}
.cover h1{font-size:clamp(2.5rem,7vw,5.5rem);max-width:12ch}
.cover h1 em{font-style:normal;color:var(--red)}
.cms{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:clamp(12px,3vw,40px);align-items:center}
.cm svg{width:100%;height:auto;max-height:88px}
@media (max-width:640px){.cms{grid-template-columns:repeat(3,minmax(0,1fr))}}

/* intro */
.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:40px}
.fact{background:var(--paper);border-radius:12px;padding:20px}
.fact b{display:block;font-weight:600;margin-bottom:4px}
.fact span{font-size:.9375rem;color:var(--muted)}
.sw{display:flex;gap:6px;margin-top:12px}
.sw i{width:28px;height:28px;border-radius:50%;box-shadow:inset 0 0 0 1px var(--rule)}

/* boards */
.bh{display:flex;gap:clamp(16px,3vw,32px);align-items:baseline;margin-bottom:32px}
.num{font-stretch:118%;font-weight:500;font-size:.875rem;letter-spacing:.16em;color:var(--red);min-width:2.5em}
.line{margin:8px 0 0;font-size:clamp(1.0625rem,1.8vw,1.25rem);color:var(--muted)}
.hero{background:var(--paper);border-radius:16px;display:grid;place-items:center;padding:clamp(48px,9vw,120px) clamp(24px,7vw,96px);min-height:clamp(300px,42vw,520px)}
.hero .lk{width:min(560px,100%);height:auto;max-height:340px}
.hero.wide .lk{width:min(820px,100%)}
.cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr);gap:clamp(24px,4vw,56px);margin-top:20px;align-items:start}
.txt p{margin:8px 0 22px;max-width:48ch;color:#3a3733}
.txt dl{margin:0;display:grid;gap:4px 0}
.txt dt{font-stretch:118%;font-weight:500;font-size:.6875rem;letter-spacing:.2em;text-transform:uppercase;color:var(--muted);margin-top:12px}
.txt dd{margin:0;font-size:.96875rem}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.t{border-radius:12px;min-height:200px;display:grid;place-items:center;padding:36px 24px 44px;position:relative;min-width:0}
.t .lk{width:min(240px,100%);height:auto;max-height:130px}
.t span{position:absolute;left:16px;bottom:12px;font-size:.75rem;font-weight:500;opacity:.75}
.t.dark{background:var(--black);color:var(--bone)}
.t.red{background:var(--red);color:#fff}
.t.icons{grid-column:1/-1;background:var(--paper);min-height:170px}
.sizes{display:flex;align-items:flex-end;gap:clamp(14px,3vw,32px);flex-wrap:wrap;justify-content:center}
.sz{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}
.sz div{border-radius:22.5%;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.12)}
.sz .ic{width:100%;height:100%}
.sz figcaption{font-size:.6875rem;color:var(--muted);font-variant-numeric:tabular-nums}

/* compare */
.cmps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:40px}
.cmp{background:var(--paper);border-radius:12px;padding:20px;text-decoration:none;display:flex;flex-direction:column;gap:14px;min-width:0;transition:transform .2s cubic-bezier(.2,.8,.2,1)}
.cmp:active{transform:scale(.98)}
.cmp-art{display:grid;place-items:center;aspect-ratio:4/3;padding:12px}
.cmp-art .lk{width:100%;height:100%;max-height:150px}
.cmp span{font-size:.875rem;color:var(--muted)}
.cmp b{color:var(--red);font-weight:500;margin-right:6px}
.irs{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:clamp(10px,2.5vw,28px);margin-top:28px}
.ir{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
.irb{width:100%;max-width:96px;aspect-ratio:1;border-radius:22.5%;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.12)}
.irb .ic{width:100%;height:100%}
.ir figcaption{font-size:.75rem;color:var(--muted)}

/* recommendation */
.rec{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-top:40px}
.rec .t{min-height:clamp(300px,36vw,440px)}
.rec .t .lk{width:min(380px,100%);max-height:280px}
.rec .t.light{background:var(--paper)}
.why{margin-top:28px;max-width:62ch;color:#3a3733}
.why li{margin-bottom:8px}

.files ul{list-style:none;padding:0;margin:24px 0 0}
.files li{padding:12px 0;border-top:1px solid var(--rule);font-size:.9375rem}
.files li b{font-weight:600;margin-right:10px}
.files a{color:var(--muted)}
.files a:hover{color:var(--red)}
footer{background:var(--black);color:var(--bone);padding:40px 0;font-size:.8125rem}
footer .wrap{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;opacity:.7}

@media (max-width:860px){
  .cols{grid-template-columns:1fr}
  .cmps{grid-template-columns:repeat(2,minmax(0,1fr))}
  .rec{grid-template-columns:1fr}
}
@media (max-width:560px){
  .tiles{grid-template-columns:1fr}
  .cmps{grid-template-columns:1fr}
  .irs{grid-template-columns:repeat(3,minmax(0,1fr))}
  .bh{flex-direction:column;gap:8px}
}
</style>
</head>
<body>

<section class="cover" aria-label="Cover">
  <div class="cover-top"><span>Soweto Towers</span><span>Logo options · Round 2</span></div>
  <div class="cover-main">
    <h1>Six ways to say <em>Soweto Towers.</em></h1>
    <div class="cms" aria-hidden="true">%COVER%</div>
  </div>
</section>

<section id="brief">
  <div class="wrap">
    <p class="label">How to read this</p>
    <h2>Six directions, one fair test.</h2>
    <p class="lede" style="margin-top:20px">Every option uses the same colours and the same typeface, so you are comparing ideas, not decoration. Each board shows the logo, its reverse, a one-colour version, and the app icon from 96 px down to 16 px, where most logos fail.</p>
    <div class="facts">
      <div class="fact"><b>Colour</b><span>Tower Black, Bone, and one red, kept for the moment that matters.</span><div class="sw"><i style="background:#151412"></i><i style="background:#F3EFE7"></i><i style="background:#DA291C"></i></div></div>
      <div class="fact"><b>Type</b><span>Archivo, free and open source. The name is set in widely spaced capitals at a modest weight.</span></div>
      <div class="fact"><b>Asked for</b><span>An S + T monogram (option 02) and a pure logotype (option 03) are both here.</span></div>
    </div>
  </div>
</section>

%BOARDS%

<section id="compare">
  <div class="wrap">
    <p class="label">Side by side</p>
    <h2>All six, same size.</h2>
    <div class="cmps">%COMPARE%</div>
    <div class="irs">%ICONS%</div>
  </div>
</section>

<section id="recommendation">
  <div class="wrap">
    <p class="label">Recommendation</p>
    <h2>The Jump, with the two-T name.</h2>
    <p class="lede" style="margin-top:20px">Option 01’s symbol is the one people will recognise from across the road. Option 03’s name adds a detail they discover later. Put together, the towers appear twice: once as the picture and once hidden in the letters.</p>
    <div class="rec">
      <div class="t light">%PAIR%<span>Colour</span></div>
      <div class="t dark">%PAIR_REV%<span>Reverse</span></div>
    </div>
    <ul class="why">
      <li><b>Familiar.</b> Anyone who has seen the towers knows the symbol at once.</li>
      <li><b>Purposeful.</b> The only colour marks the jump, the reason people come.</li>
      <li><b>Crafted.</b> Every curve is a true cooling-tower profile, and every size is a ratio of one unit.</li>
    </ul>
    <p class="lede">Choose one, or a pairing, and I will build it into the full system: artwork in every format, app and web icons, and guidelines.</p>
  </div>
</section>

<section class="files" id="files">
  <div class="wrap">
    <p class="label">Files</p>
    <h2>Artwork for each option.</h2>
    <ul>%FILES%</ul>
  </div>
</section>

<footer><div class="wrap"><span>Soweto Towers · Logo options · Round 2</span><span>Typeface: Archivo by Omnibus-Type, SIL Open Font License 1.1</span></div></footer>
</body>
</html>
"""
