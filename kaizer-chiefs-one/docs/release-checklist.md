# Release checklist

Work through this before any build goes beyond internal review. Items marked ✅ are done in this
repository; everything else needs the club or a later phase.

## Club approvals (blockers)

- [ ] Official CI manual applied: palette, typefaces, crest, wordmark, app icon (`docs/brand-assets.md`)
- [ ] Every concept image replaced with licensed, consented photography (`imagery.ts` statuses all `approved`)
- [ ] Providers chosen and contracts signed for each feature to go live (`docs/open-decisions.md`)
- [ ] Final legal texts: terms, privacy notice, community rules, Fan Moments terms (bump versions)
- [ ] POPIA review of data inventory, consent, retention and deletion (`docs/security-privacy.md`)
- [ ] Store listing, bundle identifiers and developer accounts (`app.config.ts`)

## Engineering

- ✅ Design tokens with contrast tests
- ✅ Contracts with accuracy rules; demo adapters validated against them
- ✅ Loading, empty, unavailable, error and stale states on every data screen
- ✅ RLS on every table, tested as each role
- ✅ Admin permissions enforced on the server and in the data layer
- ✅ Production refuses demo adapters and demo sign-in; payments locked off
- ✅ Secrets absent from source and client bundles (checked)
- ✅ CI: typecheck, lint, format, tests, admin build, native bundles, screen sweep, admin smoke test
- [ ] Live adapters written and contract-tested against each provider's sandbox
- [ ] Identity provider wired (mobile and admin), with staff MFA
- [ ] Upload pipeline: signed upload URLs, EXIF stripping, malware and content scanning
- [ ] Push notifications: EAS project, APNs/FCM, opt-in audiences, deep-link routing on tap
- [ ] Supabase CLI run against a local stack (`supabase start`, `supabase db reset`, `supabase test db`)
- [ ] Crash reporting and analytics, configured without personal data
- [ ] Performance budget checked on a low-end Android device
- [ ] Accessibility audit with VoiceOver and TalkBack, Dynamic Type at maximum, Reduce Motion on

## Device testing

- [ ] iOS: current and previous major version, small and large screens
- [ ] Android: a low-end device on the oldest supported version, and a current flagship
- [ ] Offline and poor-network behaviour (stale indicators, retries, no false empty states)
- [ ] Session expiry, sign-out and account deletion flows

## Operations

- [ ] Backups and point-in-time recovery enabled; restore tested
- [ ] Staff trained on moderation, escalation and safeguarding
- [ ] Support contacts in Help; incident response owner named
- [ ] Release runbook and rollback plan (EAS Update channel rollback, function version pinning)
