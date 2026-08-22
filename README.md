# bb.q Chicken South Africa — Mobile Ordering App

Production-oriented React Native customer ordering app for bb.q Chicken South
Africa, built to the supplied product brief.

**Stack:** Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) ·
Expo Router · TanStack Query · Zustand

---

## Quick start

```bash
npm install
cp .env.example .env.local     # optional; sensible defaults ship in code
npm start                      # then press i / a, or scan with Expo Go
```

The app runs end-to-end with **no backend**. `EXPO_PUBLIC_USE_MOCK_API` defaults
to `1`, so a bundled mock service layer serves the menu, stores, orders, rewards
and payments. Set it to `0` to point at a real API.

Demo credentials in mock mode: any valid email with a password of 8+ characters.
The OTP is always `1234` (the verification screen says so on-screen).

### Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo dev server |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (Expo config + Prettier) |
| `npm test` | Jest test suite |
| `npm run verify` | typecheck → lint → test, in order |
| `npm run assets:derive` | Derive image crops from masters, then regenerate the asset registry |
| `npm run assets:audit` | Report which food assets are still outstanding |

---

## Food imagery — the important part

The brief requires that **every** food image in the production UI be a supplied
high-resolution bb.q asset, with no generic stock photography and no placeholder
food blocks. The codebase enforces this rather than trusting discipline.

### How it works

1. **Masters** live in `assets/food/masters/<kebab-name>.jpg`. They are never
   loaded by the app — only used to generate derivatives.
2. **`npm run assets:derive`** produces four responsive crops per master:

   | Variant | Ratio | Width | Used on |
   |---|---|---|---|
   | `thumb` | 1:1 | 400px | menu rows, cart lines, order lines |
   | `card` | 4:5 | 800px | catalogue cards, best sellers, category tiles |
   | `detail` | 4:5 | 1200px | product detail hero |
   | `banner` | 16:9 | 1600px | home promotions, offer banners |

   Every crop is a centre-weighted **cover** crop at an exact ratio, so nothing
   is ever stretched or squeezed. Portrait masters are cropped with an upward
   gravity so the hero piece is never sliced off.

3. **`src/constants/foodAssets.ts`** is the single catalogue. Screens never
   `require()` an image — they pass a `FoodAssetKey` to `<FoodImage>`, which
   picks the right derivative for the surface.

### Adding a supplied asset

Artwork arrives in batches, so adding a batch is one command:

```bash
# 1. Drop the masters in, named by their catalogue stem
cp secret-sauce.jpg cheesling.jpg assets/food/masters/

# 2. Derive the crops and regenerate the static require() registry
npm run assets:derive
```

No hand-editing and no screen changes. Metro needs literal `require()` paths, so
`src/constants/foodAssetRegistry.ts` is **generated** by that command from
whichever masters are on disk — never edit it by hand.

Run `npm run assets:audit` to see what is still outstanding. It exits non-zero
while any of the 16 catalogue products lack their own artwork, so it can gate a
release build.

### Current asset status

**All 16 of 16** catalogue products carry their own supplied bb.q photograph.
Nothing borrows, nothing renders a placeholder, and `npm run assets:audit`
exits clean:

```
All 16 catalogue products have supplied artwork. Cleared for production.
```

### Promo compositions and per-master crop overrides

Some masters arrive as finished campaign artwork with headline typography baked
in (Half & Half is one). Brief §9 allows that on banners but not on catalogue
cards, where a naive crop slices the headline mid-word.

`OVERRIDES` in `scripts/generate-image-derivatives.mjs` handles this per master:

| Key | Effect |
|---|---|
| `promo_safe` | A fractional `(left, top, right, bottom)` region containing food and no campaign text. `thumb`/`card`/`detail` crop inside it; `banner` still uses the full composition. |
| `gravity` | Vertical bias — a single number, or a dict keyed by variant. Every promo master pins its banner to `0.0` so the top-left headline survives the 16:9 cut. |
| `focus_x` | Horizontal bias, same shape. A wide promo composition cropped to a 4:5 card loses most of its width, so this decides which part of the plate survives — Chicken & Rice Meal biases right to keep the rice and slaw in frame. |
| `banner_rect` | A region used for the **banner** instead of the full frame. A 16:9 cut of a 1.25 source can only ever show ~70% of its height, so a badge sitting below that line gets sliced mid-word. This pins the banner to a region holding the headline whole and leaving the badge out entirely — a missing badge reads as art direction, a halved one reads as a bug. |

Ten of the sixteen masters arrived as campaign artwork and carry an entry here.
Plain food shots need none.

When adding one, derive and then **look at the card**: the rect has to clear
headline flourishes and land on printed packaging marks rather than through
them. Each of these took two or three passes to get right.

### Substitution while artwork is outstanding

Products without their own photography borrow the closest supplied asset in the
same visual family — mapped in `SUBSTITUTE_ASSET_KEYS`, by glaze colour and
finish rather than by menu section, since that is what a customer actually reads
in a thumbnail:

`SUBSTITUTE_ASSET_KEYS` is **empty** — nothing borrows.

The mechanism is kept for the next product added to the menu ahead of its shoot.
Map the new key to the closest supplied asset by visual family, and it inherits
both guardrails automatically.

Two guardrails come with this:

- A borrowed photo shows a different product. Substituted items are flagged by
  `isSubstituted()` and the **product detail** screen captions the hero
  "Serving suggestion", so a customer inspecting the item closely is never told
  it is something it is not. Alt text always names the product ordered, not the
  product pictured.
- `npm run assets:audit` still counts substituted products as outstanding.
  Substitution changes what a customer sees, not what the shoot list owes.

`<FoodImagePlaceholder>` — a bb.q Black/Red tile reading "Photography coming
soon" — remains the fallback for any product with neither its own artwork nor a
mapped substitute. Both disappear on their own the moment the master lands.

Earlier batches traded against brief §7 (clear product recognition) by letting
products borrow a related photograph while their own shoot was outstanding. That
trade-off is now closed — every product shows itself.

---

## Architecture

```
src/
  app/            Expo Router routes (file-based)
  components/
    ui/           Primitives: Text, Button, Card, Chip, TextField, …
    food/         FoodImage + branded placeholder
    brand/        bb.q wordmark
  features/       Feature modules: menu, cart, home, orders, rewards, stores,
                  account, auth — each owns its hooks and components
  services/       Typed API client, per-domain services, seed data
  store/          Zustand: cart, fulfilment, auth
  theme/          Colour, typography, spacing, radius, elevation tokens
  types/          Domain models
  utils/          Money, dates, validation, cart maths, geo
```

**Architecture rule (brief §3):** no business logic in screen components.
Pricing lives in `utils/cart.ts`, commercial rules in `constants/config.ts`,
data access in `services/`. Screens compose — they do not calculate.

### Key decisions

- **Money never touches raw floats.** All arithmetic in `utils/money.ts` rounds
  through cents, so `0.1 + 0.2` is `0.3` and totals never drift.
- **Expiry is evaluated at fetch time, not render time.** Reading the clock
  during render makes output depend on re-render timing; `fetchVouchers()`
  stamps an `expired` flag and TanStack Query keeps it fresh.
- **The menu is data, not code.** Products, option groups, prices, promotions
  and rewards all come from the service layer. A product with no options simply
  renders fewer sections — no special-casing.
- **The payment gateway is abstracted.** `services/paymentService.ts` is the
  only file that knows which South African provider is in use.
- **The store map has no native dependency.** `StoreMapPreview` plots stores
  schematically in pure RN, so it works in Expo Go and in tests without an API
  key. Its props are already the ones a real map needs — swap in react-native-maps
  or Mapbox there and no caller changes.

---

## Screens

**Entry** — Splash · Onboarding · Sign in · Register · OTP · Guest · Location permission
**Main** — Home · Search · Menu categories · Product listing · Product detail · Customisation · Add-ons · Cart
**Fulfilment** — Delivery/Collection/Dine-in · Store selection · Address · Delivery instructions · Scheduling
**Checkout** — Payment · Promo code · Rewards redemption · Order review · Confirmation
**Post-order** — Live tracking · Order history · Re-order · Order details · Rate order
**Loyalty** — Rewards home · Points balance · Available rewards · Reward detail · Voucher wallet · Offers · Promotional detail
**Account** — Profile · Saved addresses · Payment methods · Notifications · Preferences · Help · Contact · Terms & privacy

Primary navigation: **Home | Menu | Rewards | Orders | More**, with a persistent
cart bar above the tab bar whenever the basket is non-empty.

---

## Design system

| Token | Value |
|---|---|
| bb.q Red (primary CTA, active nav) | `#E31937` |
| bb.q Black (headings, dark surfaces) | `#221E1E` |
| Headings | Helvetica Neue Bold / platform equivalent |
| Body | Helvetica Neue Regular / platform equivalent |

Never hard-code a hex value or font size in a component — import from
`@/theme`. Every pressable clears the 44pt minimum touch target, and every
interactive element carries an accessibility label and state.

The wordmark is drawn in type (`components/brand/BrandMark.tsx`) so it stays
crisp at any size and inverts cleanly. Swap in the licensed logo file there when
brand assets are provisioned — it is the only place the mark is drawn.

---

## Testing

```bash
npm test
```

143 tests covering money arithmetic, cart pricing and option resolution, form
validation, date and scheduling logic, the catalogue's data integrity
and substitution mapping, the Zustand cart store, all service layers, and the
UI primitives.

The data-integrity suite is worth knowing about: it asserts that every product
references a real asset key, that every recommendation points at a real product,
that option-group defaults are valid, and that no category is empty. Adding a
malformed product to `menuData.ts` fails the build.

---

## Backend integration

Set `EXPO_PUBLIC_USE_MOCK_API=0` and point `EXPO_PUBLIC_API_BASE_URL` at the
API. Each service already declares the endpoint and response type it expects:

| Service | Endpoints |
|---|---|
| `menuService` | `GET /v1/menu`, `/v1/menu/products/:id` |
| `storeService` | `GET /v1/stores?lat&lng`, `/v1/stores/:id` |
| `orderService` | `GET/POST /v1/orders`, `/v1/orders/:id`, `…/cancel`, `…/rating` |
| `rewardsService` | `/v1/loyalty/*`, `/v1/promotions`, `/v1/vouchers/validate` |
| `accountService` | `/v1/account/*`, `/v1/support/*` |
| `authService` | `/v1/auth/*` |
| `paymentService` | `/v1/payments/*` |

`services/apiClient.ts` handles auth headers, timeouts and error normalisation
in one place, so moving to GraphQL means rewriting that file, not every caller.

**Secrets:** tokens go to the platform keychain via `expo-secure-store`. Only
`EXPO_PUBLIC_*` values are inlined into the bundle, and card details are never
captured by our own form — that belongs inside the gateway's PCI-compliant SDK.

---

## Known gaps

Honest list of what is stubbed, and where to pick it up:

- **Card capture** shows an explanatory alert instead of a form — the gateway
  SDK belongs at that call site in `account/payment-methods.tsx`.
- **Address geocoding** anchors new addresses to the city centre. Wire a
  geocoder in `checkout/address.tsx` where the comment marks the spot.
- **The store map** is schematic (see Key decisions above).
- **Push notifications** are configured in `app.json` but no token registration
  runs yet; `config.push.projectId` is the hook-in point.
