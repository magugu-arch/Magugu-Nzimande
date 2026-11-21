# Integrations

Every integration in this build is a mock. None has been tested against a
real system or a sandbox, and none should be described as working.

## How an integration plugs in

```
App  ──HTTPS──▶  /v1 API (Edge Function)  ──▶  provider adapters  ──▶  club systems
                 createService()               TicketingProvider, …    (credentials here)
```

- **Contracts** are the interfaces in `packages/adapters/src/providers.ts`.
  Each read returns the data plus where it came from, when the provider last
  confirmed it, and whether it can be vouched for now. A provider that cannot
  answer returns no data and a reason. It never returns a guess.
- **The service** in `packages/api-client/src/service.ts` composes providers
  into the payloads screens need. It is the body of the server.
- **Credentials** live with the server. Nothing in the app bundle is secret,
  and the app never calls a provider directly.
- **In demo mode** the app runs the same service in-process over the mock
  adapters (`apps/mobile/src/data/api.tsx`). Pointing it at a real server is
  one line: `createHttpApi({ baseUrl, deviceId, getAccessToken })`. That
  client validates every reply against the contract.

To make an integration live: implement its interface against the vendor's
sandbox, test it there, then change its entry in
`packages/adapters/src/config.ts` from `mock` to `configured`.

## What each one needs

| Provider               | Owner                                               | Needs before it can be built                                                       |
| ---------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `TicketingProvider`    | Club ticketing lead and ticketing vendor            | Approved deep links or SDK; SSO or account-link model; attribution reporting terms |
| `FixturesProvider`     | Club rugby operations                               | Approved fixtures feed; competition and venue identifiers; update cadence          |
| `LiveMatchProvider`    | Rugby operations and data provider                  | Licensed live data contract; redistribution rights for mobile; attribution wording |
| `CMSProvider`          | Digital and editorial lead                          | Content system of record; Welsh and English workflow; correction and takedown SLA  |
| `MembershipProvider`   | Ticketing and membership operations                 | Member identity matching; eligibility source; renewal dates                        |
| `RewardsProvider`      | YMLAEN programme owner                              | Programme rules and terms; rewards API; fraud controls and support process         |
| `CommerceProvider`     | Commercial lead                                     | Store platform and approved links; stock and price source                          |
| `HospitalityProvider`  | Commercial lead                                     | Approved packages; enquiry or booking destination                                  |
| `NotificationProvider` | Digital lead and data protection officer            | APNs and FCM credentials; consent model; frequency caps                            |
| `VenueProvider`        | Stadium operations and accessibility representative | Approved venue map; step-free routes; disabled supporters policy; facility list    |

The same list is shown in the app under **More → Demo controls** and in the
console's Overview.

## Outbound links

Every destination is in `officialLinks` in `packages/adapters/src/config.ts`.
Four are the pages the brief names (ticket information, season tickets,
fixtures, rugby). The rest (travel, accessibility, hospitality, shop, media,
contact, privacy) open the club site's front page and say that the exact page
is still to be confirmed. Nothing is scraped or fetched from the club's site.

## Sign-in

There is no real sign-in. Two demo accounts stand in for the club's identity
provider, and no credential is asked for or stored. The database expects
Supabase Auth; the club may choose another provider.

## Push notifications

Preferences are stored and shown. No push token is requested and nothing is
sent: that needs APNs and FCM credentials and the club's consent model.
