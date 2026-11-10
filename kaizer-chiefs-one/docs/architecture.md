# Architecture

```
            ┌──────────────────────────┐        ┌──────────────────────────┐
            │  apps/mobile (Expo 57)   │        │  apps/admin (Next.js 16) │
            │  screens → hooks         │        │  pages + server actions  │
            │  → providers registry    │        │  → DAL (session, RBAC)   │
            └────────────┬─────────────┘        └────────────┬─────────────┘
                         │ ProviderResult<T>                  │ staff JWT (production)
       demo adapters ◄───┤ (local only, labelled)             │
                         │ HTTPS, anon key + user JWT         │
            ┌────────────▼────────────────────────────────────▼─────────────┐
            │ Supabase: Postgres (RLS) · Auth · Storage · Edge Functions     │
            │ functions hold every provider secret; tables hold synced data  │
            └────────────┬──────────────────────────────────────────────────┘
                         │ server-side adapters
     ┌──────────┬────────┴──┬────────────┬───────────┬─────────┬──────────┐
     │ Club CMS │ Match feed│ Membership │ Ticketing │ Rewards │ Commerce │  … chosen by the club
     └──────────┴───────────┴────────────┴───────────┴─────────┴──────────┘
```

## Layers

**Contracts (`packages/contracts`).** zod schemas are the single definition of every domain
object. They carry the brief's rules as refinements (no demo scores, no demo membership, no demo
wallet, five-minute entry tokens, consent on every Fan Moment), so any adapter that tried to break
them would fail validation. The same package holds the provider interfaces, the RBAC matrix and
the capability-flag resolver.

**Providers.** The mobile app's `src/data/providers.ts` is the only place that decides, per
feature, whether the demo adapter, the live adapter or an "off" adapter answers. Screens call
hooks in `src/data/queries.ts` and never import an adapter. Every call returns a
`ProviderResult`: either data with its provenance (source, fetched and updated times, and a state
of live, cached, stale or demo) or an honest unavailable reason. Screens render those through
`QueryState`, so loading, error, unavailable and success are handled the same way everywhere.

**Live adapters** are deliberately thin: one HTTPS call to a Supabase edge function, then
validation against the contract before a screen sees anything. All provider credentials live in
function secrets.

**Capability flags.** `EXPO_PUBLIC_FEATURE_*` (mobile) and `ADMIN_FEATURE_*` (admin) set each
feature to `off`, `demo` or `live`. Local defaults to demo; staging and production default to off.
Production refuses demo, `live` refuses to start without its variables, and payments cannot be
switched on. Any problem stops the app at launch with a screen that names the variables (never
their values).

**Database (`supabase/`).** RLS is on for every table. Provider-synchronised tables (membership,
tickets, wallets, transactions) are read-only to their owner and written only by server
functions. State changes that need rules go through security-definer functions with explicit
checks and audit entries: `moderate_fan_post`, `remove_my_fan_post`, `set_staff_role`. Triggers
enforce what policies cannot express: new Fan Moments always start in review (or escalated when
they show children), publishing needs `content.publish`, scheduling a campaign needs
`notifications.schedule` and a time at least five minutes ahead, and the audit log is append-only.

**Admin.** Next.js server components and server actions only; there is no client-side data
access. A data access layer (`src/lib/dal.ts`) verifies the signed session and permission for
every page and action, and the data layer checks the permission again. In production the admin
talks to Postgres as the signed-in staff member so RLS applies a third time.

## Mobile app structure

```
apps/mobile/src
  app/            Expo Router routes: (tabs) home/match/fan/tickets/profile, (auth), detail routes
  components/     Design-system components (Text, Button, PressableScale, Sheet, TabBar, ...)
  config/         env + capability resolution, image registry, brand asset slots
  data/           providers registry, demo adapters, live adapters, auth, query hooks
  features/       feature components (FixtureCard, TicketCard, SignInGate, ...)
  state/          zustand stores (session in SecureStore; preferences; demo Fan Moments)
  theme/          React Native styles generated from packages/ui
```

## Motion and interaction

- `PressableScale`: feedback on press-in, critically damped spring, interruptible; Reduce Motion
  swaps scale for opacity.
- `SegmentedControl` and `TabBar`: selection markers are springs that re-target from their current
  position.
- `Sheet`: tracks the finger 1:1, rubber-bands past its resting point, projects the flick with
  Apple's deceleration formula to decide whether to close, and hands the finger's velocity to the
  closing spring. It leaves along the path it entered.
- Spring values are tokens (`packages/ui/src/motion.ts`) expressed as damping ratio and response,
  converted to stiffness and damping for Reanimated.

## Session and auth

Mobile: in demo mode a local session (12 hours) is kept in the platform keychain/keystore via
`expo-secure-store`, checked on resume and every minute, and ended with a clear notice when it
expires. Live sign-in is deliberately not wired until the club chooses its identity provider.

Admin: an HMAC-signed, httpOnly, SameSite=Strict cookie that expires after eight hours; the role is
re-read on every request so changes and deactivations apply immediately.
