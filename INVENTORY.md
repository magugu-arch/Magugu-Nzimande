<!-- GENERATED FILE — do not edit. Run `npm run docs:inventory`. -->

# Inventory

The route map, component inventory and asset manifest the brief asks for as
outputs. Generated from the repository by `scripts/generate-inventory.mjs`,
and held to it by `__tests__/inventory.test.ts` — if this file and the code
disagree, the test fails rather than the document quietly going stale.

---

## Route map

34 routes. Paths are what Expo Router resolves: `(groups)` are
organisational and never appear in a URL, and `index` collapses into its parent.

| Route | Screen | |
|---|---|---|
| `/` | `src/app/index.tsx` |  |
| `/+not-found` | `src/app/+not-found.tsx` |  |
| `/account/contact` | `src/app/account/contact.tsx` |  |
| `/account/help` | `src/app/account/help.tsx` |  |
| `/account/legal` | `src/app/account/legal.tsx` |  |
| `/account/notifications` | `src/app/account/notifications.tsx` |  |
| `/account/payment-methods` | `src/app/account/payment-methods.tsx` |  |
| `/account/preferences` | `src/app/account/preferences.tsx` |  |
| `/account/profile` | `src/app/account/profile.tsx` |  |
| `/cart` | `src/app/cart/index.tsx` |  |
| `/checkout` | `src/app/checkout/index.tsx` |  |
| `/checkout/address` | `src/app/checkout/address.tsx` |  |
| `/checkout/schedule` | `src/app/checkout/schedule.tsx` |  |
| `/checkout/store` | `src/app/checkout/store.tsx` |  |
| `/forgot-password` | `src/app/(auth)/forgot-password.tsx` |  |
| `/home` | `src/app/(tabs)/home.tsx` |  |
| `/location` | `src/app/(onboarding)/location.tsx` |  |
| `/menu` | `src/app/(tabs)/menu.tsx` |  |
| `/more` | `src/app/(tabs)/more.tsx` |  |
| `/offers` | `src/app/offers/index.tsx` |  |
| `/offers/[id]` | `src/app/offers/[id].tsx` | dynamic |
| `/order/[id]` | `src/app/order/[id]/index.tsx` | dynamic |
| `/order/[id]/confirmation` | `src/app/order/[id]/confirmation.tsx` | dynamic |
| `/order/[id]/rate` | `src/app/order/[id]/rate.tsx` | dynamic |
| `/orders` | `src/app/(tabs)/orders.tsx` |  |
| `/product/[id]` | `src/app/product/[id].tsx` | dynamic |
| `/register` | `src/app/(auth)/register.tsx` |  |
| `/reset-password` | `src/app/(auth)/reset-password.tsx` |  |
| `/rewards` | `src/app/(tabs)/rewards.tsx` |  |
| `/rewards/[id]` | `src/app/rewards/[id].tsx` | dynamic |
| `/rewards/vouchers` | `src/app/rewards/vouchers.tsx` |  |
| `/sign-in` | `src/app/(auth)/sign-in.tsx` |  |
| `/verify` | `src/app/(auth)/verify.tsx` |  |
| `/welcome` | `src/app/(onboarding)/welcome.tsx` |  |

---

## Component inventory

39 exported components. Screens compose these; none of them
reaches for a raw colour or type value — everything resolves through `src/theme`.

### Design system

| Component | File |
|---|---|
| `Badge` | `src/components/ui/Badge.tsx` |
| `Button` | `src/components/ui/Button.tsx` |
| `Card` | `src/components/ui/Card.tsx` |
| `Chip` | `src/components/ui/Chip.tsx` |
| `Divider` | `src/components/ui/Divider.tsx` |
| `FavouriteButton` | `src/components/ui/FavouriteButton.tsx` |
| `ListRow` | `src/components/ui/ListRow.tsx` |
| `ProgressBar` | `src/components/ui/ProgressBar.tsx` |
| `QuantityStepper` | `src/components/ui/QuantityStepper.tsx` |
| `Screen` | `src/components/ui/Screen.tsx` |
| `ScreenHeader` | `src/components/ui/ScreenHeader.tsx` |
| `Section` | `src/components/ui/Section.tsx` |
| `StarRating` | `src/components/ui/StarRating.tsx` |
| `LoadingState`, `EmptyState`, `ErrorState`, `OfflineState` | `src/components/ui/StateViews.tsx` |
| `Text` | `src/components/ui/Text.tsx` |
| `TextField` | `src/components/ui/TextField.tsx` |
| `Toggle` | `src/components/ui/Toggle.tsx` |

### Brand

| Component | File |
|---|---|
| `BrandMark` | `src/components/brand/BrandMark.tsx` |

### Food imagery

| Component | File |
|---|---|
| `FoodImage` | `src/components/food/FoodImage.tsx` |
| `FoodImagePlaceholder` | `src/components/food/FoodImagePlaceholder.tsx` |

### System

| Component | File |
|---|---|
| `OfflineBanner` | `src/components/system/OfflineBanner.tsx` |

### Feature components

| Component | File |
|---|---|
| `CartLineRow` | `src/features/cart/components/CartLineRow.tsx` |
| `OrderTotals` | `src/features/cart/components/OrderTotals.tsx` |
| `StickyCartBar` | `src/features/cart/components/StickyCartBar.tsx` |
| `FulfilmentSelector` | `src/features/home/components/FulfilmentSelector.tsx` |
| `PromotionBanner` | `src/features/home/components/PromotionBanner.tsx` |
| `NutritionPanel` | `src/features/menu/components/NutritionPanel.tsx` |
| `OptionGroupPicker` | `src/features/menu/components/OptionGroupPicker.tsx` |
| `ProductCard` | `src/features/menu/components/ProductCard.tsx` |
| `ProductRow` | `src/features/menu/components/ProductRow.tsx` |
| `OrderTimeline` | `src/features/orders/components/OrderTimeline.tsx` |
| `RewardCard` | `src/features/rewards/components/RewardCard.tsx` |
| `OpeningSoonBanner` | `src/features/stores/components/OpeningSoonBanner.tsx` |
| `StoreCard` | `src/features/stores/components/StoreCard.tsx` |
| `StoreMapPreview` | `src/features/stores/components/StoreMapPreview.tsx` |
| `AccountRequired` | `src/features/system/AccountRequired.tsx` |

---

## Asset manifest

13 supplied photographs, each derived into four responsive
variants by `npm run assets:pappas`.

| Variant | Ratio | Width | Used on |
|---|---|---|---|
| `thumb` | 1:1 | 400px | menu rows, cart lines, reorder chips |
| `card` | 4:5 | 800px | category cards, editorial cards, dish cards |
| `hero` | 4:3 | 1400px | home hero, category hero, product detail |
| `banner` | 16:9 | 1600px | campaign banners, event cards |

| Asset key | Master | First catalogue use |
|---|---|---|
| `mezedakia` | `—` | _venue / editorial only_ |
| `seafood` | `—` | _venue / editorial only_ |
| `salads` | `—` | _venue / editorial only_ |
| `signatureMains` | `—` | _venue / editorial only_ |
| `souvlaki` | `—` | _venue / editorial only_ |
| `steakOnRock` | `—` | _venue / editorial only_ |
| `fishMarket` | `—` | _venue / editorial only_ |
| `desserts` | `—` | _venue / editorial only_ |
| `breakfast` | `—` | _venue / editorial only_ |
| `cocktails` | `—` | _venue / editorial only_ |
| `diningRoom` | `—` | _venue / editorial only_ |
| `barDetail` | `—` | _venue / editorial only_ |
| `squareView` | `—` | _venue / editorial only_ |

Masters live in `assets/pappas/{food,venue,ci}/` and are never shipped to a
screen. Every one is a finished poster carrying its own Cinzel headline, so the
derivative pipeline cuts each variant from inside a declared `food_safe` region
that excludes the typography — brief §6 and §14. Three masters are held back
entirely and have no key here: `01` and `02` are photography-direction boards
and `15` is the CI brand sheet, which §10 designates as references rather than
content.
