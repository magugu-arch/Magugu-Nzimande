"""The numbers behind the Sundowns One deck: build cost, running cost, value
model, payback and sponsorship. Run it to print every figure the deck quotes;
it fails if anything stops adding up.

Usage: python3 -I model.py
"""
RATE = 690            # rand an hour, senior blended (as in the Kaizer Chiefs proposal)
DAY = RATE * 8        # R5 520 a person-day
PRICE = 2_400_000     # fixed price, excluding VAT

BUILD = [  # (deliverable, detail, person-days)
    ("Discovery and provider confirmation", "Ends in a go / re-scope decision at week 3", 15),
    ("Brand system from the club's CI", "Approved crest, palette, type, app icon, store art", 12),
    ("Identity, profiles and consent", "Sign-in, POPIA consent per channel, account deletion", 24),
    ("Content, CMS and Match Centre", "News and video, licensed fixtures, results, live events", 36),
    ("Tickets and verified attendance", "Official-seller handoff, ticket link, entry events", 32),
    ("Matchday planner and stadium guide", "Crew, travel, budget, gates, seats, services", 28),
    ("Membership link and digital card", "Verified against the club's membership system", 20),
    ("Yellow Nation Passport", "Points, stamps, rewards ledger, disputes", 36),
    ("Fan Zone and fan moments", "Predictor, quiz, stadium QR challenge, moderation", 30),
    ("Notifications and lifecycle journeys", "Push, email, WhatsApp templates; caps, quiet hours", 26),
    ("Official store handoff", "Catalogue, checkout handoff and order status", 14),
    ("Partner World and sponsor reporting", "Placements, offers, redemptions, partner reports", 34),
    ("Club Studio console", "Content, campaigns, moderation, roles, audit log", 36),
    ("Campaign pages and attribution", "Tracked links, QR codes, holdout groups", 22),
    ("Quality, accessibility, security, load", "Devices, screen readers, penetration and peak tests", 32),
    ("Release, launch kit and hypercare", "iOS, Android and web; stadium QR kit; 30 days of fixes", 38),
]
days = sum(d for *_, d in BUILD)
subtotal = days * DAY
rounding = PRICE - subtotal
assert len(BUILD) == 16 and days == 435 and subtotal == 2_401_200 and rounding == -1_200
VAT = round(PRICE * 0.15)
RUN_MONTH = 40_000
RUN_YEAR = RUN_MONTH * 12
PAYMENTS = [("On signature", "Discovery starts", 0.30), ("Closed pilot on a test build", "Week 22", 0.30),
            ("Public launch: both stores and the web", "Week 28", 0.30), ("After 30 days of hypercare", "Week 32", 0.10)]
assert sum(round(PRICE * s) for *_, s in PAYMENTS) == PRICE

HOME_MATCHES, TICKET, MEMBERSHIP, BASKET, CLUB_SHARE, MESSAGES, PER_REACH = 15, 80, 300, 800, 0.25, 24, 0.20
RATE_CARD = [  # property, indicative season fee
    ("Presenting Partner of Sundowns One", 1_200_000),
    ("Yellow Nation Passport Partner", 600_000),
    ("Matchday Experience Partner", 500_000),
    ("12th Player Partner (Fan Zone)", 400_000),
    ("Family Matchday Partner", 300_000),
    ("Global Masandawana Partner", 300_000),
]
FULL_CARD = sum(f for _, f in RATE_CARD)
SCEN = {
    "Conservative": dict(extra=500, members=800, known=30_000, buy=0.03, partners=["Matchday Experience Partner", "12th Player Partner (Fan Zone)"]),
    "Base": dict(extra=1_200, members=2_000, known=60_000, buy=0.04, partners=["Presenting Partner of Sundowns One", "Yellow Nation Passport Partner", "Matchday Experience Partner"]),
    "Stretch": dict(extra=2_500, members=4_000, known=100_000, buy=0.05, partners=[p for p, _ in RATE_CARD]),
}
fee = dict(RATE_CARD)
out = {}
for k, s in SCEN.items():
    v = {
        "Extra tickets": s["extra"] * HOME_MATCHES * TICKET,
        "Memberships": s["members"] * MEMBERSHIP,
        "Store, club share": round(s["known"] * s["buy"] * BASKET * CLUB_SHARE),
        "Partners": sum(fee[p] for p in s["partners"]),
        "Paid reach replaced": round(s["known"] * MESSAGES * PER_REACH),
    }
    total = sum(v.values())
    net_month = total / 12 - RUN_MONTH
    out[k] = dict(lines=v, total=total, payback_months=PRICE / net_month,
                  three=3 * total, cost3=PRICE + 3 * RUN_YEAR, net36=-PRICE + 36 * net_month)
b = out["Base"]
assert out["Conservative"]["total"] == 2_064_000 and b["total"] == 5_108_000 and out["Stretch"]["total"] == 8_980_000
assert out["Base"]["lines"]["Partners"] + 600_000 >= PRICE + RUN_YEAR  # three partners + 500 extra a match cover year one

if __name__ == "__main__":
    print(f"build: {days} days, {days*8} hours at R{RATE}, subtotal R{subtotal:,}, rounding R{rounding:,}, price R{PRICE:,}, VAT R{VAT:,}, incl R{PRICE+VAT:,}")
    for name, det, d in BUILD:
        print(f"  {d:3d}  R{d*DAY:>9,}  {name}")
    print(f"run: R{RUN_MONTH:,}/month, R{RUN_YEAR:,}/yr; 3-yr cost R{PRICE+3*RUN_YEAR:,}")
    print("payments:", [(n, round(PRICE*s)) for n, _, s in PAYMENTS])
    print(f"rate card full: R{FULL_CARD:,}")
    for k, o in out.items():
        print(k, {a: f"R{x:,}" for a, x in o["lines"].items()}, f"total R{o['total']:,}", f"payback {o['payback_months']:.1f} mo",
              f"3yr R{o['three']:,} vs R{o['cost3']:,} = {o['three']/o['cost3']:.2f}x, net36 R{o['net36']:,.0f}",
              f"yr1 ratio {o['total']/(PRICE+RUN_YEAR):.2f}")
    print(f"base partners cover {b['lines']['Partners']/PRICE:.1%} of build")
