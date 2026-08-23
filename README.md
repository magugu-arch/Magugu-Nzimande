# bb.q Chicken South Africa — Mobile Ordering App

Production-oriented React Native customer ordering app for bb.q Chicken South
Africa, built to the supplied product brief.

> **New to this project? Start with [HANDOVER.md](./HANDOVER.md)** — orientation,
> what is stubbed, and what to do first. This file is the reference manual.

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
| `npm run assets:brand` | Regenerate every icon and in-app logo from the logo masters |
| `npm run assets:typefit` | Measure every button label against §22.4's geometry and fail on overflow |
| `npm run preview:web` | Run the whole app in a browser — layout and type, no build needed |
| `npm run audit:screens` | Render all 26 screens at two widths; fail on overflow, blank screens, console errors or §32.6 gaps |
| `npm run smoke:order` | Sign in, add an item and place an order end to end against the mock layer |
| `npm run build:dev` | EAS development build (dev client) for both platforms |
| `npm run build:preview` | EAS internal-distribution build for review |
| `npm run build:prod` | EAS store build |
| `npm run prebuild` | Regenerate the native `ios/` and `android/` projects |
| `npm run doctor` | `expo-doctor` project health check |

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

## Building for a device (EAS)

The app has been verified in Metro and in tests, but a real QA pass needs it on
hardware — and push notifications only work in a development build, since Expo
Go dropped remote push in SDK 53.

### One-time setup

```bash
npm install -g eas-cli     # the build scripts call `eas`
eas login
eas init                   # writes the real projectId into app.json
```

`eas init` replaces the placeholder `extra.eas.projectId`. Until it does,
push registration reports "no EAS project id configured" rather than failing
silently — `resolveProjectId()` rejects the all-zero placeholder on purpose.

### Build profiles

| Profile | Command | What it is |
|---|---|---|
| `development` | `npm run build:dev` | Dev client, internal distribution, mock API. The one to install for day-to-day work — it pairs with `npm start`. |
| `development-simulator` | `npm run build:sim` | Same, as an iOS simulator build. No Apple device registration needed. |
| `preview` | `npm run build:preview` | Release build, internal distribution, still on the mock API. For stakeholder review without a backend. |
| `preview-live` | `eas build --profile preview-live --platform all` | Same, pointed at the real API. Use once the backend is up. |
| `production` | `npm run build:prod` | Store build, auto-incrementing version, live API. |

`appVersionSource` is `remote`, so EAS owns the build number and `production`
increments it automatically — no version bumps in git.

### Day-to-day

```bash
npm run build:dev:ios      # once, then install on the device
npm start                  # open the dev client and it connects
```

Local native builds (`npm run android` / `npm run ios`) work too if Xcode or
Android Studio is set up; `npm run prebuild` regenerates the native projects.
`ios/` and `android/` are gitignored — they are generated, never edited by hand.

### Before the first store submission

- Fill the placeholders in `eas.json` → `submit.production.ios`
  (`appleId`, `ascAppId`, `appleTeamId`).
- Replace the generated icon with the licensed bb.q artwork.
- **Push in the background:** iOS `UIBackgroundModes` deliberately does *not*
  include `remote-notification`. User-facing alerts do not need it, and Apple
  rejects apps that declare background modes they do not use. Add it only if
  the backend starts sending silent content-available pushes to refresh order
  state.

---

## Architecture

```
src/
  app/            Expo Router routes (file-based)
  components/
    ui/           Primitives: Text, Button, Card, Chip, TextField, …
    food/         FoodImage + branded placeholder
    brand/        BrandMark — the licensed lock-up, the only place it is drawn
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

### Production hardening

| Concern | How it is handled |
|---|---|
| **Render crashes** | `ErrorBoundary` wraps the whole tree. A thrown error would otherwise unmount everything and leave a white screen — worst of all mid-checkout. It shows a branded recovery screen, says the cart survived (it is persisted), and gives the support number, because a customer whose order just vanished wants a person rather than a retry button. |
| **Offline** | `startNetworkMonitoring()` wires NetInfo into TanStack Query's `onlineManager`, so queries pause and resume on reconnect instead of burning retries into an error state. `OfflineBanner` says what still works: browsing and cart-building do, only checkout needs the network. The offline check is deliberately conservative — `isInternetReachable` is null while probing, and treating that as offline flashes a banner on every cold start. |
| **Push** | `notificationService` registers, syncs the token, and routes taps. Every failure path returns a reason rather than throwing: notifications are a convenience, not a prerequisite for ordering. Registration waits until the customer opts in via Preferences — asking on first launch is the reliable way to get denied permanently — and Preferences explains a denial rather than leaving a toggle that lies. |
| **Cold-start taps** | `useInitialNotificationRoute` handles the tap that launched the process, which the normal response listener never sees. Without it, tapping "your order is here" on a closed app lands on Home. |
| **Untrusted payloads** | `routeForNotification` only follows an in-app path. An `href` pointing anywhere else is ignored and the category decides instead. |

### The logo

Two master files in `assets/brand/masters/` are the source of truth — the full
lock-up and the symbol mark, each tight-cropped with a transparent ground.
`npm run assets:brand` derives everything else from them, so the mark is drawn
once and every size agrees.

| Output | From |
|---|---|
| `icon.png`, `favicon.png` | Symbol, reversed on bb.q Red — the lock-up is 5.6:1 and would vanish in a square |
| `android-icon-{foreground,background,monochrome}.png` | Symbol inside the adaptive safe zone, over solid red |
| `notification-icon.png` | Symbol, strokes thickened for 24dp |
| `splash-icon.png` | Reversed lock-up, transparent, over the red splash ground |
| `brand/lockup{,-reversed}{,@2x,@3x}.png` | What `BrandMark` renders |

Nothing here rearranges or recolours the logo. The two variants are the two the
guidelines show: full colour on light grounds, all-white reversed on red and
black. The one deliberate exception is the notification badge, whose strokes are
thickened because at 24dp the line weight collapses into a smudge — an optical
correction at a single size, measured rather than guessed.

The masters were separated out of the supplied guidelines page rather than
exported from the original artwork, which is a raster. The art is flat
three-colour, so each pixel was unmixed into red and black coverage maps and
re-rendered from those — which is why the symbol is crisp at 1024px rather than
a blurred upscale of a 136px crop. It is still not vector: for print or signage,
replace the two masters and re-run the script.

### Buttons and colour, to guidelines §22 / §32

`components/ui/Button.tsx` is the whole of §22. Four variants in descending
emphasis — `primary`, `secondary`, `tertiary`, `text` — three sizes at the
published heights (56 / 44 / 36) and label sizes (16 / 14 / 13 semibold), and
all four of §22.3's states defined per variant rather than one shared grey.

Two rules the component enforces so callers cannot break them:

- **44×44 minimum touch target (§22.9)** even though §22.4 makes the small
  button 36px tall. The shortfall goes into `hitSlop`, not into the box.
- **Uppercase labels**, matching every CTA in the app mockups, with
  `preserveCase` for the long or dynamic ones §22.7 cautions against. The
  accessible name stays in its written case — a screen reader should not shout.

Two it cannot: §22.7's "one primary button per screen" and "don't mix styles in
the same hierarchy" are composition decisions, so they stay with the reviewer.

Colour is held to §32.3 by `utils/contrast.ts` and a test over every pair the
theme ships. Writing that test found four real failures in the status palette —
amber on its own tint missed even the 3:1 large-text bar — so those hues were
darkened at the same hue. Two departures from the drawings are deliberate and
marked in the source: disabled primary takes the pressed red for its label
rather than the white the guidelines draw, because §22.9's own panel scores
that pairing 2.1:1 and marks it Fail; and the tab bar keeps a filled icon for
the active tab rather than §23.6's uniform line icons, because that gives the
active state a signal that is not colour, which is what §32.4 asks for.

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

| Token | Value | Source |
|---|---|---|
| bb.q Red | `#E31937` | §10.2, §23.4 |
| bb.q Black | `#221E1F` | §10.2, §23.4 — the app page says `#221E1E` |
| White / Cream / Light Grey | `#FFFFFF` / `#FFF5E6` / `#F2F2F2` | §23.4 |
| Headings, buttons, labels | Montserrat, weights per level | §11, §14 |
| Body copy, captions, data | Arial — system face, not bundled | §12 |
| Quotes and accents | Playfair Display Italic, sparingly | §13 |
| Screen gutter / inner gap / tight gap | 24 / 16 / 4 | §23.7 |

Montserrat and the one Playfair italic are bundled and loaded before the first
frame, imported per weight rather than from the package root — the root barrel
statically requires all eighteen Montserrat cuts, which Metro then ships. Arial
is deliberately not bundled: §12 chose it for being universally available, and
Android substitutes Roboto, which `theme/typography.ts` makes explicit rather
than leaving to the platform.

§14's point sizes (a 90pt H1) are the print scale. What carries into the app is
which face and weight each level takes, its casing, and the ratios between
levels. Caps are reserved for the campaign headline and the section eyebrow;
§14 sets H1–H3 in caps, but the client's own app mockups read "My Cart" and
"Popular Menu", and caps on a product name would cost legibility §32.4 asks us
to protect.

Never hard-code a hex value or font size in a component — import from
`@/theme`. Every pressable clears the 44pt minimum touch target, and every
interactive element carries an accessibility label and state.

The logo is only ever drawn by `components/brand/BrandMark.tsx`, which picks
between the two approved variants and sizes them from the master's own aspect
ratio — so no caller can stretch the lock-up, whatever it passes in `style`.
Guidelines v1.0 §3.1 requires the official master file and forbids rebuilding
the mark from fonts; this is the one place that rule has to hold.

---

## Testing

```bash
npm test
```

289 tests covering money arithmetic, cart pricing and option resolution, form
validation, date and scheduling logic, the catalogue's data integrity
and substitution mapping, the Zustand cart store, all service layers, the UI
primitives, notification routing (including malformed and off-app payloads),
the error boundary, and the brand asset set — that every icon app.json names
exists at the size it claims, and that the ratio `BrandMark` draws at still
matches the logo master, and the brand guidelines themselves — every colour
pair the theme ships asserted against §32.3's contrast thresholds, button
heights and touch targets against §22.4 and §22.9, and every screen read to
prove no long button label was left to be uppercased against §22.7's advice.

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
- **Push delivery** needs a development build and an EAS project id — Expo Go
  dropped remote push in SDK 53. Registration, token sync, tap routing and
  cold-start routing are all built; set `EXPO_PUBLIC_PUSH_PROJECT_ID` and the
  backend's `/v1/account/push-tokens` endpoint to switch it on.
- **The logo masters are raster**, lifted from the supplied guidelines page
  rather than exported from the original artwork (see The logo above). Fine for
  screens, not for print.
- **Crash reporting** has a hook but no provider: pass `onError` to
  `ErrorBoundary` to wire Sentry or Crashlytics.
