"""PDF QA: proves the exported deck is flat vector artwork.

    python check_pdf.py round-3/soweto-towers-identity-options.pdf

Fails (exit 1) if any page holds a raster image, a soft mask, a transparency group, a blend
mode or a fill or stroke opacity below 1. Drop shadows, CSS gradients and translucent colours
export from Chromium as exactly these, and some PDF viewers (iOS among them) draw them as grey
boxes stacked over the artwork.
"""
import sys
from pypdf import PdfReader


def scan(res, seen, out, where):
    if res is None:
        return
    res = res.get_object()
    for name, gs in (res.get("/ExtGState") or {}).items():
        gs = gs.get_object()
        for k in ("/ca", "/CA"):
            if k in gs and float(gs[k]) < 1:
                out.append(f"{where}: graphics state {name} has opacity {k}={float(gs[k]):.2f}")
        if gs.get("/SMask", "/None") != "/None":
            out.append(f"{where}: graphics state {name} has a soft mask")
        if gs.get("/BM", "/Normal") not in ("/Normal", "/Compatible"):
            out.append(f"{where}: graphics state {name} uses blend mode {gs['/BM']}")
    for name, xo in (res.get("/XObject") or {}).items():
        o = xo.get_object()
        if id(o) in seen:
            continue
        seen.add(id(o))
        if o.get("/Subtype") == "/Image":
            out.append(f"{where}: raster image {name} ({o.get('/Width')} x {o.get('/Height')})")
        if "/SMask" in o:
            out.append(f"{where}: {name} has a soft mask")
        g = o.get("/Group")
        if g is not None and g.get_object().get("/S") == "/Transparency":
            out.append(f"{where}: {name} is a transparency group")
        scan(o.get("/Resources"), seen, out, where)
    for _, pat in (res.get("/Pattern") or {}).items():
        scan(pat.get_object().get("/Resources"), seen, out, where)


problems = []
reader = PdfReader(sys.argv[1])
for i, pg in enumerate(reader.pages, 1):
    found = []
    scan(pg.get("/Resources"), set(), found, f"page {i}")
    g = pg.get("/Group")
    if g is not None and g.get_object().get("/S") == "/Transparency":
        found.append(f"page {i}: page is a transparency group")
    problems += found
for p in problems:
    print("  - " + p)
print(f"{len(reader.pages)} pages, " + (f"{len(problems)} problem(s)" if problems else "flat vector: no images, no transparency"))
sys.exit(1 if problems else 0)
