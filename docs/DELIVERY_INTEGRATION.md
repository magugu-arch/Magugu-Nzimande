# Delivery channels — Pappas Direct, Uber Eats, Mr D

What is built, what is deliberately not built, and exactly what Pappas must
obtain before the two external channels can carry a real order.

This is the document the extension brief's §10.12 asks for: *"If official
provider API contracts or credentials are unavailable, DO NOT invent them.
Finish with mocks/interfaces and clearly document exactly what
credentials/contracts are required."*

---

## The shape of it

```
                    ┌──────────────────────────────┐
   Pappas app       │  src/integrations/delivery   │
   (this repo)      │                              │
                    │  DeliveryProvider contract   │
                    └──────────────┬───────────────┘
                     ┌─────────────┼─────────────┐
                     │             │             │
            PappasDirectAdapter  UberEats     MrD
                     │           Adapter     Adapter
                     │             │             │
            app's own services     └──────┬──────┘
            (orders, stores)              │
                                   Pappas broker (server)
                                   holds every credential
                                          │
                                  ┌───────┴───────┐
                              Uber Eats        Mr D
                              merchant API   partner API
```

**The app never calls a provider API.** It calls a Pappas-owned broker, and
the broker calls the provider. This is the one non-negotiable structural
decision, and it exists because extension §1 and §11 both require that no
provider secret reaches the client. A mobile bundle is a file anyone can
download and read, so an `EXPO_PUBLIC_UBER_EATS_KEY` is a published key.
Requests cannot be signed on device; the credential lives on a server and the
device authenticates as the customer rather than as the merchant.

It also means the code in this repository is honest today. The broker's
endpoint shape is *Pappas'* to define, so defining it invents nothing. What
would be invented — and what §10.12 forbids — is a guess at Uber Eats' or
Mr D's own request bodies, status names or auth scheme. Those sit behind the
broker and behind contracts that do not exist yet.

---

## What works right now

| Capability | Pappas Direct | Uber Eats | Mr D |
|---|---|---|---|
| Delivery | ✅ | ⏳ declared | ⏳ declared |
| Collection / Pickup | ✅ | ⏳ declared | ✗ not offered |
| Scheduled order | ✅ | ⏳ declared | ✗ not offered |
| ETA | ✅ | ⏳ declared | ⏳ declared |
| Live courier tracking | ✗ no feed exists | ⏳ declared | ⏳ declared |
| Cancellation | ✅ | — | — |
| Webhooks | — | ⏳ declared | ⏳ declared |
| Loyalty attribution | ✅ | ✗ no agreement | ✗ no agreement |

✅ works · ⏳ declared, awaiting contract · ✗ not available

**Pappas Direct is complete and independent.** Extension §11's first
acceptance criterion. Nothing about the external channels being absent,
disabled or broken can affect it — it is backed by this app's own store and
order services.

Two entries deserve a note rather than a tick:

- **Pappas Direct has no live tracking, and does not claim it.** Direct
  delivery is run by the restaurant and there is no courier GPS feed behind
  it. Declaring the capability is how a map with an invented moving pin gets
  built on top of nothing, which §5 forbids.
- **Mr D offers no collection.** Its public product is address-based delivery.
  Claiming pickup would put a collection option in front of a customer that
  the channel cannot honour.

---

## Outstanding blockers

Nothing below can be resolved in this repository. Each needs a commercial
step first.

### Uber Eats

1. **Uber Eats merchant account** for Pappas, Nelson Mandela Square, with
   Uber Direct / Eats Marketplace API access enabled.
2. **API credentials** — client id, client secret, and the OAuth scopes for
   order integration. Issued to the *broker*, never to the app.
3. **Store id mapping** — Uber Eats' own identifier for the Pappas store,
   to map against `pappas-nelson-mandela-square`.
4. **Menu sync contract** — the payload format Uber Eats expects, and whether
   Pappas pushes the catalogue or Uber Eats pulls it.
5. **Webhook event catalogue** — the exact event type strings and their
   meanings. This is what fills `STATUS_MAP['uber-eats']` in `webhooks.ts`,
   which is empty today and deliberately so.
6. **Webhook signing secret** and the signature scheme, for the broker to
   verify deliveries.
7. **Commercial terms** — commission rate, delivery fee treatment, settlement
   cadence. These become broker configuration, not app constants (§8).
8. **Loyalty attribution position** — whether the agreement permits Pappas to
   identify the customer on a marketplace order. Today the answer is assumed
   to be no, and `channelEligibility.ts` encodes that.

### Mr D

1. **Mr D restaurant partner account** and API/integration access. Mr D does
   not publish an open partner API; integration is arranged through their
   partner team.
2. **API credentials** and endpoint documentation, issued to the broker.
3. **Store id mapping**, as above.
4. **Menu and modifier format.**
5. **Webhook event catalogue** — fills `STATUS_MAP['mr-d']`, empty today.
6. **Webhook signing secret** and scheme.
7. **Commercial terms**, as above.
8. **Loyalty attribution position**, as above.

### Pappas, either channel

- **The broker service itself.** Not in this repository. Its required
  endpoints are specified below.
- **Menu prices.** The canonical Pappas catalogue in this app carries
  business-input placeholders wherever a price has not been supplied — see
  `PLACEHOLDERS.md`. Marketplace pricing is a separate decision again.

---

## What the broker must implement

Four endpoints per channel. The app calls these and nothing else.

```
POST {BROKER}/channels/{providerId}/validate-address
POST {BROKER}/channels/{providerId}/quote
POST {BROKER}/channels/{providerId}/create-order
POST {BROKER}/channels/{providerId}/cancel-order
```

`{providerId}` is `uber-eats` or `mr-d`. Request and reply shapes are in
`src/integrations/delivery/providers/ExternalChannelAdapter.ts` — the
`Broker*Reply` interfaces are the contract.

Three requirements on the broker that the app depends on and cannot enforce:

1. **Translate status vocabulary.** The broker returns
   `CanonicalOrderStatus` values, never a provider's native string. The app
   has no mapping table for provider statuses and must not acquire one.
2. **Honour `Idempotency-Key`.** The app sends it as both a header and a body
   field on `create-order`, and will retry after a timeout with the same key.
   A broker that ignores it turns one timeout into two dinners.
3. **Persist `eventId` for every webhook and reject duplicates**
   (§6). The client-side `SeenEventLedger` is a second line of defence only —
   a device that was asleep never saw the first delivery, so client memory
   cannot be the guard.

---

## Environment variables

Set on the **client** (publishable — these say which channels to offer, not
how to reach them):

| Variable | Default | Meaning |
|---|---|---|
| `EXPO_PUBLIC_PAPPAS_DIRECT_ENABLED` | `true` | Offer the direct channel |
| `EXPO_PUBLIC_UBER_EATS_ENABLED` | `false` | Offer Uber Eats |
| `EXPO_PUBLIC_MR_D_ENABLED` | `false` | Offer Mr D |
| `EXPO_PUBLIC_CHANNEL_BROKER_URL` | `''` | Base URL of the Pappas broker |

Set on the **broker only** — never in this repository, never in an
`EXPO_PUBLIC_*` name, never in `app.json`:

```
UBER_EATS_CLIENT_ID
UBER_EATS_CLIENT_SECRET
UBER_EATS_WEBHOOK_SECRET
UBER_EATS_STORE_ID
MR_D_API_KEY
MR_D_WEBHOOK_SECRET
MR_D_STORE_ID
```

`__tests__/secrets.test.ts` already fails the build on a credential-shaped
name in the client bundle. The delivery layer adds no exception to it.

---

## Turning a channel on

1. Broker deployed, provider credentials configured on it.
2. `STATUS_MAP[provider]` in `webhooks.ts` populated from the provider's
   documented event catalogue.
3. `EXPO_PUBLIC_CHANNEL_BROKER_URL` set.
4. `EXPO_PUBLIC_UBER_EATS_ENABLED=true` (or the Mr D equivalent).

No other code change. The registry picks the channel up, the picker shows it
as available instead of coming soon, and the shared checkout treats it like
any other channel. Enabling one channel does not touch the other — §11.

---

## Where things live

| File | Job |
|---|---|
| `types.ts` | The brief's §3 domain contracts |
| `statusMachine.ts` | Canonical state machine, legal transitions, customer copy |
| `fulfilment.ts` | Bridge between the app's three fulfilment types and the providers' two |
| `money.ts` | Rand ↔ cents, once, at the boundary |
| `idempotency.ts` | One key per intent, not per attempt |
| `webhooks.ts` | Normalisation, duplicate rejection, payload sanitising |
| `channelEligibility.ts` | Promotion channel scoping, loyalty attribution |
| `catalogueMapping.ts` | Per-channel name/price/availability overrides |
| `deepLinks.ts` | Push target parsing and deferral (main brief §17.10) |
| `providerRegistry.ts` | Flags, capability discovery, availability, default channel |
| `providers/` | The three adapters |

Tests: `__tests__/deliveryProviders.test.ts`,
`__tests__/deliveryWebhooks.test.ts`, `__tests__/deliveryCommerce.test.ts`.
