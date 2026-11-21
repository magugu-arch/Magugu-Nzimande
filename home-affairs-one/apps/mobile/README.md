# Mobile app (not started)

The brief proposes a React Native app for iOS and Android. For this prototype the experience is
delivered as a mobile-first, installable web app (`apps/web`), which covers the same journeys on a
phone without an app-store release.

A native app would reuse `packages/api-contracts`, `packages/shared-types`, the design tokens and the
gateway shape, and add what only a native app can: secure hardware-backed storage, platform passkeys,
push notifications and app attestation. See `docs/architecture/decisions.md`.
