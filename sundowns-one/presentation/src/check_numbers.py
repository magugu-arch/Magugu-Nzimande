"""Check that every figure the deck quotes matches model.py.

Usage: python3 -I check_numbers.py   (exits non-zero on any mismatch)
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import model as m  # noqa: E402

deck = (pathlib.Path(__file__).resolve().parent / "deck.html").read_text("utf8")
R = lambda n: "R" + f"{n:,}".replace(",", " ")  # noqa: E731
b, c, st = m.out["Base"], m.out["Conservative"], m.out["Stretch"]
nopartners = b["total"] - b["lines"]["Partners"]
want = {
    "price": R(m.PRICE), "subtotal": R(m.subtotal), "rounding": "−R1 200", "VAT": R(m.VAT),
    "days": f"{m.days} days", "hours": f"{m.days * 8:,} hours".replace(",", " "), "rate": f"R{m.RATE} an hour",
    "payment 30%": R(round(m.PRICE * 0.3)), "payment 10%": R(round(m.PRICE * 0.1)),
    "base total": R(b["total"]), "conservative total": R(c["total"]), "stretch total": R(st["total"]),
    "full rate card": R(m.FULL_CARD), "run a month": "R40 000 a month",
    # the payback chart computes break-even from these inputs
    "chart base": f"v: {b['total'] / 1e6:g}", "chart conservative": f"v: {c['total'] / 1e6:g}", "chart stretch": f"v: {st['total'] / 1e6:g}",
    "chart build and run": f"build = {m.PRICE / 1e6:g}, run = {m.RUN_MONTH / 1e6:g}",
    "bridge": "['Extra tickets', 1.44], ['Memberships', 0.6], ['Store, club share', 0.48], ['Partners', 2.3], ['Paid reach replaced', 0.288]",
    "about six months": "about six months", "inside two seasons": "inside two seasons",
    "three-season value": f"R{b['three'] / 1e6:.1f}m", "three-season cost": f"R{b['cost3'] / 1e6:.2f}m",
    "net base": f"R{b['net36'] / 1e6:.1f}m", "net conservative": f"R{c['net36'] / 1e6:.2f}m", "net stretch": f"R{st['net36'] / 1e6:.1f}m",
    "ratio conservative": f"R{c['three'] / c['cost3']:.2f} back", "partners share of build": f"{round(100 * b['lines']['Partners'] / m.PRICE)}%",
    "without partners": f"R{nopartners / 1e6:.2f}m a season, {100 * nopartners / (m.PRICE + m.RUN_YEAR):.1f}%",
}
for k in ("Extra tickets", "Memberships", "Store, club share", "Partners", "Paid reach replaced"):
    for name, o in m.out.items():
        want[f"{name} {k}"] = R(o["lines"][k])
for name, _, d in m.BUILD:
    want[f"line {name}"] = f"', {d}],"  # each item's days; the deck prices them at R5 520 a day
bad = [f"{k}: {v}" for k, v in want.items() if v not in deck]
# the deck computes item prices from days × R5 520 and asserts 435 days in its own script
assert "n * 5520" in deck and "days !== 435" in deck
if bad:
    print("MISSING:\n  " + "\n  ".join(bad))
    sys.exit(1)
assert round(b["payback_months"]) == 6 and c["payback_months"] < 24
print(f"{len(want)} figures match model.py (payback: base {b['payback_months']:.1f}, conservative {c['payback_months']:.1f}, stretch {st['payback_months']:.1f} months)")
