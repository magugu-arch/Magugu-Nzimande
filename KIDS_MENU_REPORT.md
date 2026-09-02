# Kids Menu — change report

Required by §10 of the *Kids Menu Extension* brief. A new category and four
complete meals, using the supplied photography.

---

## 1. Files changed

| File | Change |
| ---- | ------ |
| `src/types/menu.ts` | `kids` added to the `CategoryId` union |
| `src/services/data/menuData.ts` | The `Kids Menu` category, two shared option groups, four products |
| `src/constants/foodAssets.ts` | Four asset keys and labels; kebab rule fixed for consecutive capitals |
| `src/constants/foodAssetRegistry.ts` | Regenerated — 28/28 products wired |
| `src/features/menu/components/ProductRow.tsx` | Product name allowed two lines |
| `src/features/menu/components/ProductCard.tsx` | Same |
| `scripts/generate-image-derivatives.mjs` | Crop overrides for the four kids masters |
| `scripts/lib/food-catalogue.mjs` | Kebab rule kept identical to the TypeScript |
| `scripts/audit-food-assets.mjs` | New detail-resolution report |
| `scripts/audit-screens.mjs` | Kids meal added to the sweep — 34 routes to 35 |
| `__tests__/foodAssets.test.ts` | New: derived filenames checked against the masters on disk |
| `__tests__/menuTaxonomy.test.ts` | `BRIEF_TAXONOMY` now the union of two briefs |
| `assets/food/{masters,thumb,card,detail,banner}/` | Four masters, sixteen derivatives |
| `README.md`, `HANDOVER.md`, `INVENTORY.md` | Counts |

**No new component, screen, route, cart or state.** The Kids Menu is a row in
`categories` and four rows in `products`; everything a customer touches is the
menu screen, product card, product row, detail screen, cart and checkout that
were already there.

## 2. How the category was added

`categories` gained one entry — `id: 'kids'`, `sortOrder: 8` — and `CategoryId`
gained the matching member so a typo cannot compile. Every existing
`sortOrder` is untouched, so no category a customer has learned the position of
has moved.

Last in the row is deliberate: a parent looking for the kids menu scans for the
word, while somebody ordering for themselves scrolls past it, which is the
wrong way round if it sits between Chicken and Wings. It is reachable by
scrolling the existing chip row — verified at 320pt as well as 390pt.

## 3. The four meals

| Product | Price | Includes | Asset key |
| ------- | ----- | -------- | --------- |
| Little Crunch Chicken Meal | R 69 | Chicken, fries, a dip, a drink | `littleCrunchChickenMeal` |
| Little Chicken Strips Meal | R 69 | Boneless strips, fries, a dip, a drink | `littleChickenStripsMeal` |
| Little Cheesling Burger Meal | R 75 | Burger, fries, a drink | `littleCheeslingBurgerMeal` |
| Little K-Rice Chicken Meal | R 79 | Chicken, rice, a Korean side, a drink | `littleKRiceChickenMeal` |

Each is a **meal, not a portion**. The brief asks for the drink and the dip to
be part of what was bought, so they are `minSelect: 1` groups priced at **zero**
rather than the priced add-ons the grown-up boxes carry — `DRINK_GROUP` charges
R22 for the drink these boxes are photographed with, which would have been
wrong here. `serves` reads "Serves 1 child", because portion size is the whole
point of the range and a parent scanning the list has no other way to tell this
from an adult meal at two-thirds the price.

## 4. Where the images live

`assets/food/masters/<slug>.jpg`, run through the existing pipeline to thumb /
card / detail / banner and wired into the generated registry. All four are
cover crops — nothing stretched.

All four needed a crop override, and for a reason worth recording. They are 4:3
frames with a printed band along the bottom carrying the meal name, the mascot
and a "Made fresh for kids" badge. The card and detail crops are 4:5, so a
cover crop takes a narrow column out of the middle and **slices the printed
name mid-word** on every one of them; anchoring vertically does nothing,
because the cut is in the other axis. The catalogue surfaces now take the food
above the band, and the banner keeps the whole box — 16:9 cuts height rather
than width, so the name survives there intact. This is the same `promo_safe`
mechanism the original promo compositions use.

## 5. Cart and ordering

Unchanged, and that is the point. Driven end to end in a browser:

- Menu → Kids Menu chip → all four listed, and nothing else is
- Each meal opens the existing detail screen with its own photograph
  (`naturalWidth > 0`, `object-fit: cover`, filename matched to the product)
- **No option on a kids meal adds to the price** — asserted, not assumed
- Add to cart, then the cart line carries the chosen drink *and* dip, so the
  kitchen gets a meal order with the drink named on it
- A second meal adds **exactly R69.00**, not R69 plus a drink
- The order summary names it
- Back from a meal returns to the Kids Menu with its filter still applied
- Golden Original Chicken is untouched

`audit:screens` across **35 routes** at 390pt and 320pt is clean, as are
`audit:coldstart` and `audit:points`. `npm run verify` — **66 suites, 1 007
tests**.

## 6. Two things found on the way

**The kebab rule broke on the first key with two capitals in a row.**
`FOOD_ASSET_FILENAMES` derives a master's filename by kebab-casing its key, and
`littleKRiceChickenMeal` derived `little-krice-chicken-meal` against a master
named `little-k-rice-chicken-meal`. That failure is silent in the worst
direction — no build error, just a product rendering the placeholder tile — and
there are two copies of the rule, one in TypeScript and one in the build script
that cannot import it. The rule now handles acronym runs, and a new test checks
every derived filename against the files actually on disk, which catches
whichever copy is wrong because the scripts are what put the files there.

**No detail hero has ever reached its documented resolution.** The pipeline's
header says `detail 4:5 1200px (Retina @2x-3x)`. Measuring all 28 products:
**none** reaches it, and not one of the original sixteen ever did. Every master
is landscape or near-square, so a 4:5 crop is bounded by its height. The
pipeline is right to cap rather than upscale — nothing is wrong with the code —
but the number in the comment was a target nobody measured against, and heroes
have been shipping between 530px and 1122px wide into a 390pt box. The kids
meals sit at the bottom of that range (530–574px) because their crops discard
the most.

`npm run assets:audit` now reports the shortfall per product. It reports rather
than fails, because every product is affected and a failing gate would only
teach people to pass `--warn`. **The fix is taller masters** — a request to
whoever supplies the photography, not a change anybody can make in this
repository.

## 7. A change to a shared component, and why

Product names were clamped to one line in both the menu row and the product
card. That cost nothing while the longest name was "Golden Original Chicken",
and **all four** kids meals truncated — one to *"Little Cheesling Burge…"*,
which is not the name of anything, against an acceptance criterion that asks
for the exact meal name to be displayed clearly. Both now allow two lines, and
the heat flame beside the title anchors to the first line rather than floating
in the middle of a two-line block. No existing name wraps as a result: the ones
that fitted on one line still do.

## 8. Still required before production

- **Prices.** R69 / R69 / R75 / R79 are seeded placeholders in the app's
  existing convention, set against the adult meals they sit below. `audit:launch`
  counts the menu rather than restating it, so it already reports **28 products
  carry seeded prices**. None is a real South African price.
- **What the meal includes.** Four soft drinks and three dips are offered at no
  charge. Milkis is deliberately excluded — it is the one premium drink in the
  adult group, and whether a kids meal includes it free is a margin decision.
  The included set needs sign-off along with the prices.
- **Allergens and nutrition** are seeded in the same style as the rest of the
  catalogue and are not from a supplier sheet.
- **A typo in the supplied artwork.** The Little Chicken Strips Meal photograph
  has **"LITTLE CHICKEN STRIPSS MEAL"** printed on the box — a doubled S. The
  product name in the app is correct; the packaging in the photograph is not,
  and it is legible at card and banner size. Nothing in this repository can fix
  it, so it needs a corrected image.
