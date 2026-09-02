# Menu extension — change report

Required by §8 step 10 of the *App Menu Extension* debrief. Eight products
added to the existing ordering experience, using the supplied photography.

---

## 1. What was added

| # | Product | Category | Price | Asset key |
| - | ------- | -------- | ----- | --------- |
| 01 | Honey Garlic Wings | Wings | R 165 | `honeyGarlicWings` |
| 02 | Soy Garlic Wings | Wings | R 165 | `soyGarlicWings` |
| 03 | Secret Sauce Boneless | Boneless | R 185 | `secretSauceBoneless` |
| 04 | Hot Spicy Wings | Wings | R 165 | `hotSpicyWings` |
| 05 | Wings Rice Meal | Meals | R 135 | `wingsRiceMeal` |
| 06 | Cheesling Burger | Burgers | R 125 | `cheeslingBurger` |
| 07 | Sweet Potato Fries | Sides | R 52 | `sweetPotatoFries` |
| 08 | Cheese Ddeok-Bokki | Sides | R 88 | `cheeseDdeokBokki` |

No new category, component, screen or route. Each product is a row in
`src/services/data/menuData.ts` with the same schema as the sixteen already
there, so the existing card, detail screen, cart, search and checkout pick them
up without knowing anything new exists.

## 2. Whether any of the eight already existed

Checked before writing anything, because the menu models flavour two different
ways and the answer decides whether these are products or options. The Chicken
category gives each flavour its own product (Golden Original Chicken, Honey
Garlic Chicken, …); Boneless and Burger use an option group.

None of the eight was orderable by any route:

- **Wings** held one product and a size picker, with **no sauce axis at all**.
  There was no way to order a glazed wing however far you drilled in — items
  01, 02 and 04 are additions, not second doors onto something existing.
- **Boneless**'s flavour group is Golden Original / Honey Garlic / Soy Garlic /
  Hot Spicy / Cheesling. **Secret Sauce is not in it.**
- **Chicken Burger**'s heat group is Classic / Hot Spicy / Honey Garlic.
  **Cheesling is not in it.**
- Ddeok-Bokki and Rose Ddeok-Bokki are already **separate products** rather
  than one product with a sauce option, so Cheese joins them the same way. It
  is filed under Sides with the other two rather than Rice Bowls, so all three
  sit together.

So §8.2 ("reuse the existing architecture, do not create a parallel menu
system") and §9 ("all eight products visible in the correct category") do not
conflict here, and nothing needed to be resolved in favour of one or the other.

## 3. Artwork

The eight supplied photographs are the canonical artwork; nothing is
substituted and no placeholder renders. Each was converted to a JPEG master at
`assets/food/masters/<slug>.jpg` and run through the existing pipeline, which
derives four crops per product — thumb 1:1 400px, card 4:5 800px, detail 4:5
1200px, banner 16:9 1600px — and regenerates the static `require()` registry.
All crops are cover crops: **nothing is stretched**, per §4.

One crop override was needed. **Cheesling Burger** has a branded bb.q cup at
the right edge, and a centred cover crop to 1:1 or 4:5 cut through the wordmark
— a sliced logo reads as a bug rather than as art direction, which is the same
reason the existing promo overrides exist. Biasing the horizontal focus left
centres the burger and ends the frame before the cup. The other seven needed
nothing; unlike the original sixteen they are clean product photography rather
than promo compositions, so there is no headline to crop around. **Sweet Potato
Fries** keeps its packaging branding whole in every variant — checked, not
assumed.

## 4. What was consolidated on the way

Two things this change would otherwise have made worse.

**The catalogue existed four times.** `FOOD_ASSET_KEYS` in TypeScript, a
`[key, filename]` list in `generate-asset-registry.mjs`, a
`[key, filename, label]` list in `audit-food-assets.mjs`, and a
`FOOD_ASSET_FILENAMES` record mapping each key to its own name in kebab-case.
Three of them carried comments asking the next person to keep them in step with
the others, and nothing checked that anyone had. Adding eight products meant
adding thirty-two rows across four lists in two languages.

The failure mode is the reason it was worth fixing rather than repeating: a key
missing from the registry script is not a build error. It is a supplied
photograph that silently never reaches the app, and an audit built on its own
copy of the list reports that product as fully supplied, because it never knew
to look for it.

`FOOD_ASSET_FILENAMES` is now derived (the filename was never a second fact —
it is the key in kebab-case, which all sixteen already were), and both scripts
read the catalogue from the TypeScript through `scripts/lib/food-catalogue.mjs`.
Proven equivalent before extending: the regenerated registry was byte-identical
at sixteen products before the eight were added.

**The wings size axis.** Golden Original Wings carried its 6/10/16 group
inline, which was right while it was the only product in the category. Four
products sharing a copied size axis is four chances for 10 wings to cost
different amounts depending on the sauce. It is now `WINGS_SIZE_GROUP(base)`,
called with `'wings'` for the original — which reproduces its existing option
ids exactly, so nothing moved to make room.

## 5. Tests

`npm run verify` — **66 suites, 1 006 tests**, typecheck, lint and format clean.

Four existing tests failed on the new products and none of them had found a
defect. Each asserted the size of the menu rather than a property of it:

- `menuTaxonomy` asserted `products).toHaveLength(16)`. Rewritten to assert what
  it says it checks — that no product is dropped or duplicated when things move
  between categories — by requiring unique ids and that the categories partition
  the catalogue.
- `foodAssets` asserted `FOOD_ASSET_KEYS).toHaveLength(16)`. Rewritten to
  require uniqueness, plus a new check that the catalogue and the menu describe
  the same set: no asset key that nothing on the menu uses.
- `menuSearch` — "chicken burger" now returns Cheesling Burger too, whose own
  description opens *"Crispy chicken burger"*. That is the right answer; the
  test asserted a single name while the menu happened to hold one burger.
- `menuSearch` — the fallback test used "honey garlic wings" precisely because
  nothing matched all three words. Honey Garlic Wings now does, so the test had
  quietly stopped exercising the fallback. Moved to "cheesling rice bowl",
  which has the same shape against the menu as it now stands.

The docs-accuracy guard caught the stale "16 catalogue products" claims in
README and HANDOVER by itself.

## 6. Verified in a browser

Not only in tests. Against a release build, at 390pt:

- All eight detail screens render, each loading a **derivative** rather than a
  master, each with `naturalWidth > 0` (a tag pointing at a missing file is
  still a tag) and `object-fit: cover` (nothing distorted).
- Search finds each of the eight by name.
- Wings lists all three new wings; Boneless, Meals, Burgers and Sides list
  theirs.
- browse → open → add → change quantity → cart → order summary, on Cheesling
  Burger: the total moved R162 → R287 on the quantity change, and the summary
  names it.
- Golden Original Wings keeps its size picker after the shared-group change.
- `audit:screens` across 34 routes at 390pt and 320pt: no overflow, no blank
  screens, no console errors, no accessibility gaps, every target ≥ 44×44.
- `audit:coldstart`, `audit:points`, `audit:handover` all green.

## 7. Still required before production

Per §10 of the brief, and tracked by `npm run audit:launch`, which counts the
menu rather than restating it and so picked the eight up automatically:

> Menu and prices: **24 products** carry seeded prices. These are placeholders
> until signed off by the franchise — every one of them is a number a customer
> is asked to pay.

The eight prices above were set against neighbouring items (sauced wings R10
over plain, matching the glazed birds' premium over Golden Original; Sweet
Potato Fries between French Fries and Cheesling Fries) using the app's existing
placeholder convention, per §6. **None is a real South African price.**

Also outstanding, unchanged by this work and named in §10: SKU/product ids,
availability by store, allergen and nutrition confirmation, tax treatment,
modifier and add-on rules, stock logic and operational fulfilment. The allergen
and nutrition figures on the eight are seeded in the same style as the existing
sixteen and are **not** from a lab or a supplier sheet.
