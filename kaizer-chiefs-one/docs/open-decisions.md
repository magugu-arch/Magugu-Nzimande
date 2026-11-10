# Open decisions requiring the club

Each item blocks the feature named on the right from leaving demo or off mode. Owners are as
proposed in the brief.

| # | Decision or input | Owner | Unblocks |
| --- | --- | --- | --- |
| 1 | Official CI manual: palette, typefaces, crest and wordmark vectors, kit and sponsor artwork, approval workflow | Brand / marketing | Replacing `packages/ui/src/color.ts` and `type.ts`; filling `apps/mobile/src/config/brandAssets.ts`; the app icon |
| 2 | Content source (CMS) and editorial approval process | Communications / digital | `content` capability → live |
| 3 | Licensed match data provider, update frequency and data licence | Football operations / digital | `matchData` → live (fixtures, Match Centre, squad) |
| 4 | Identity provider (Supabase Auth or the club's existing IdP) | IT / security | Real sign-in, registration, recovery, session policy |
| 5 | Membership / CRM system, identity matching and entitlement rules | Membership / CRM | `membership` → live |
| 6 | Ticketing provider, secure entry-token method, transfer and support rules | Ticketing operations | `tickets` → live, ticket handoff |
| 7 | Official shop / e-commerce provider and checkout ownership | Retail / commerce | `commerce` → live (`EXPO_PUBLIC_SHOP_URL`) |
| 8 | Rewards provider, programme rules, points ledger, partner permissions | Commercial / loyalty | `rewards` → live |
| 9 | Payment acquirer, refunds and reconciliation | Finance | `payments` stays off until then; enforced in code |
| 10 | Fan content terms, consent wording, safeguarding policy, moderation staffing, retention and escalation | Legal / community | `fanMoments` → live; final consent text replaces `FAN_TERMS_VERSION` draft |
| 11 | Privacy notice, POPIA review, analytics, retention and deletion workflows, incident ownership | Privacy / legal / IT security | Final legal texts, analytics opt-in, account deletion |
| 12 | Push notifications: APNs/FCM accounts, consent rules, segmentation | Digital / IT | `notifications` → live |
| 13 | Languages, launch markets, accessibility target, device support matrix | Product owner | Localisation, QA matrix |
| 14 | Store listing: app name, bundle identifiers, developer accounts | Product owner | Replacing `org.example.kcone.concept` in `app.config.ts` |
| 15 | Licensed, consented photography (and youth image permissions) | Brand / safeguarding | Replacing every `concept` entry in `apps/mobile/src/config/imagery.ts` |
