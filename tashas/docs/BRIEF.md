<!-- Converted from Tashas_Claude_Code_Booking_Payment_Notification_Marketing_Brief_FINAL.docx with pandoc. The images in section 17 are omitted here; see tashas/assets. -->

tashas

**CLAUDE CODE DEVELOPMENT BRIEF**

Premium App · Production Booking & Payments · Notifications · Lifecycle
Marketing · 28 Images

  -----------------------------------------------------------------------
  PROJECT GOAL\
  Build a polished Tashas customer experience across mobile web, iOS and
  Android. The app must include a reliable booking lifecycle, secure
  provider-backed payments, automated service notifications and a
  consent-aware marketing engine that turns verified customer journeys
  into measurable repeat visits. Retain the responsive HTML asset gallery
  with all 28 embedded images as a companion handover tool. Use approved
  data and provider integrations; never simulate production booking or
  payment success.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

Prepared for Claude Code. The 28 user-supplied JPEGs are embedded in
this Word document and in the self-contained HTML asset library. A JSON
metadata manifest is provided separately and bundled with the assets.

Brand direction is based on Tashas' published emphasis on beautiful
food, distinctive café environments, attentive personal service and
individual "Inspired By" identities. The app should not inherit the dark
black-and-gold MÁBU visual system.

# 1. Implementation mandate

  -----------------------------------------------------------------------
  **BUILD, DO NOT ONLY PLAN\
  **Inspect the repository and available assets first. Preserve existing
  working code where possible, create an implementation plan, then build
  and test feature by feature. The HTML gallery is an asset handover and
  responsive reference; it must not be described as a production ordering
  app until real backend services and provider integrations are
  configured.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

-   Create a premium customer-facing experience for Tashas with its own
    visual identity: warm ivory, oak, stone, soft botanical greens,
    refined typography, natural daylight, editorial photography and
    generous whitespace.

-   Use the 28 supplied images as core approved art-direction assets. Do
    not silently replace them with stock images. Exact menu names,
    prices, dietary claims, opening times and branch claims must come
    from approved source data.

-   Provide an adaptive web experience that works on iPhone/iPad Safari,
    Android Chrome and desktop browsers. Provide installable PWA
    behaviour over HTTPS where practical; native app-store builds
    require a tested mobile wrapper/shared codebase and separate release
    steps.

-   Keep the code structured so web, iOS, Android and future admin tools
    can use the same typed services and backend domain models.

-   Never promise guaranteed first-place Google ranking. Build the
    technical and local SEO foundations and measure results over time.

# 2. Required deliverables

  -----------------------------------------------------------------------
  **Deliverable**                     **Requirement**
  ----------------------------------- -----------------------------------
  Claude Code implementation          Runnable project with README,
                                      environment sample, architecture
                                      plan, tests and run/deploy
                                      instructions.

  Responsive HTML asset library       One self-contained HTML file with
                                      all 28 photos embedded as data
                                      URIs, image descriptions, metadata,
                                      search/filter, Download HTML,
                                      native share and WhatsApp access
                                      controls.

  Image metadata manifest             JSON containing filename, asset ID,
                                      title, alt text, suggested
                                      placement, file dimensions, file
                                      size, SHA-256, EXIF fields present
                                      and disclosure of missing
                                      capture/camera data.

  Mobile experience                   Responsive web/PWA for iOS and
                                      Android. Native wrappers/builds
                                      only after repository inspection
                                      and platform QA.

  Guest journey                       Branch discovery, menu, reservation
                                      flow, rewards, notification
                                      preferences, account, campaigns and
                                      conversion tracking.

  Admin/CMS foundation                Branch data, menu content,
                                      promotions, campaign pages, image
                                      metadata, reward rules and
                                      notification templates managed
                                      without editing UI components.

  QA and handover                     Unit/integration/E2E tests,
                                      accessibility checks, SEO
                                      validation, broken-link scan and a
                                      list of provider credentials still
                                      required.

  Booking + payment engine            End-to-end reservation lifecycle,
                                      secure provider-backed checkout,
                                      deposits where required, verified
                                      payment webhooks,
                                      cancellation/refund handling,
                                      reconciliation and audit trail.

  Notification + lifecycle marketing  Event-triggered in-app/push/email
                                      and optional SMS/WhatsApp adapters;
                                      guest preferences, consent records,
                                      suppression, automated journeys,
                                      campaign management and performance
                                      reporting.

  Operations dashboard                Branch booking configuration,
                                      payment status/reconciliation,
                                      refund permissions, notification
                                      delivery health, campaign approvals
                                      and role-based staff controls.
  -----------------------------------------------------------------------

# 3. Tashas experience and design direction

  -----------------------------------------------------------------------
  **Design token**                    **Initial direction**
  ----------------------------------- -----------------------------------
  Paper / surfaces                    Warm ivory and soft cream; avoid
                                      stark pure-white as the dominant
                                      surface.

  Natural materials                   Oak, pale marble, brushed brass,
                                      linen, stone and ceramic.

  Botanical accent                    Muted olive / sage green used for
                                      active controls and subtle
                                      emphasis.

  Photography                         Natural window light, editorial
                                      framing, appetising true-to-life
                                      food textures, relaxed hospitality
                                      and real-looking interiors.

  Typography                          Refined editorial serif for select
                                      headlines, highly legible
                                      sans-serif for UI and navigation.

  Motion                              Subtle fades and short transitions;
                                      respect reduced-motion settings and
                                      keep interactions fast.

  Interaction                         Clear CTAs, large tap targets,
                                      accessible contrast, persistent
                                      booking/order actions and friendly
                                      error/empty states.

  Per-location identity               Keep shared brand DNA but let each
                                      approved branch story and "Inspired
                                      By" concept retain its own content
                                      and imagery.
  -----------------------------------------------------------------------

# 4. Core app information architecture

  -----------------------------------------------------------------------
  **Area**                            **Screens and functions**
  ----------------------------------- -----------------------------------
  Home                                Search restaurants/branches;
                                      near-me location opt-in; seasonal
                                      story; menu highlights; book a
                                      table; offers; branch cards;
                                      editorial campaigns.

  Find a Tashas                       Search by city/suburb/landmark; map
                                      and list; distance; confirmed
                                      address; hours; contact;
                                      directions; booking and
                                      branch-specific menus.

  Menu                                Categories, search, filters, item
                                      details, approved descriptions,
                                      prices, dietary/allergen info only
                                      where verified, favourites and
                                      availability.

  Reservations                        Date, party size, available slots,
                                      guest details, occasion,
                                      preferences, confirmation,
                                      reminders, change/cancel and
                                      waitlist where supported.

  Orders (optional by branch)         Pre-order / collection / delivery
                                      only where Tashas confirms the
                                      branch and operational system
                                      support it; provider adapters and
                                      secure checkout.

  Rewards                             Guest account, points/visits, tier
                                      progress, available rewards,
                                      voucher wallet, redemption, expiry
                                      and history. Rules must be
                                      admin-configurable.

  Events / experiences                Approved branch events, seasonal
                                      offers, booking action, date/time,
                                      capacity, terms and campaign source
                                      tracking.

  Notifications                       Booking confirmations and
                                      reminders, waitlist, events,
                                      rewards, service messages,
                                      preference centre and marketing
                                      opt-in/out.

  Profile                             Guest details, saved branches,
                                      favourites, booking history, order
                                      history where supported, rewards,
                                      consent and notification
                                      preferences.

  Help                                Contact branch, FAQs, booking/order
                                      support, privacy and terms,
                                      accessible fallback if an
                                      integration is unavailable.
  -----------------------------------------------------------------------

# 5. Booking architecture

-   Availability must come from a confirmed booking provider or
    controlled demo adapter. Never imply a table is available based on
    static mock data in production.

-   Implement reservation create/confirm/amend/reschedule/cancel and
    waitlist where the provider supports it; persist status and audit
    events.

-   Use idempotency keys and webhook deduplication. Handle timeout,
    stale slot, provider failure and double-submit states safely.

-   Include booking reference, branch, date/time, party size, policy,
    contact and calendar link in confirmations.

-   Provider names, APIs, booking terms, deposit requirements and
    credentials must be confirmed by Tashas; do not invent integrations.

# 6. Rewards, notifications and growth automation

  -----------------------------------------------------------------------
  **System**                          **Required behaviour**
  ----------------------------------- -----------------------------------
  Rewards ledger                      Every earn/redeem/expire/reversal
                                      operation is persisted and
                                      auditable; no double earning on
                                      duplicated bookings or events.

  Earning rules                       Configurable approved triggers:
                                      completed visit, event attendance,
                                      approved purchase or campaign;
                                      exact rewards to be supplied by
                                      Tashas.

  Notifications                       In-app + push/email adapter
                                      architecture; SMS/WhatsApp only
                                      when the provider, sender,
                                      templates and consent process are
                                      approved.

  Booking reminders                   Configurable scheduled reminders;
                                      use guest locale/timezone and
                                      respect channel preferences.

  Lifecycle campaigns                 Welcome, first booking, post-visit,
                                      birthday if guest has supplied date
                                      and consent, reward earned/expiry,
                                      win-back and event announcements.

  Segmentation                        Segment by chosen branch,
                                      preferences, consent, booking/visit
                                      history and reward status; avoid
                                      sensitive inferences.

  Consent                             Separate transactional service
                                      messages from marketing opt-in;
                                      maintain timestamp, channel, source
                                      and opt-out audit.

  Experimentation                     A/B-test landing copy and CTA
                                      placement only with measurable
                                      metrics and appropriate consent;
                                      prevent dark patterns.
  -----------------------------------------------------------------------

# 7. Marketing machine and conversion tracking

-   Create campaign landing pages for seasonal menus, location stories,
    events, brunch, coffee, gifts and approved offers; every page should
    have one clear primary conversion.

-   Build tracked deep links and UTM standards across email, QR codes,
    paid social, search and WhatsApp; preserve source parameters through
    booking/checkout.

-   Add newsletter sign-up and consent capture, referral links where
    approved, reactivation flows and an editorial/content management
    workflow.

-   Measure branch search → branch view → directions/call/booking; menu
    view → booking/order; reward view → redemption; campaign visit →
    conversion; repeat visit rate and customer retention.

-   Dashboard should report conversion rate, booking completion,
    cancellation/no-show, source/medium, branch performance,
    campaign-attributed revenue where connected and notification
    opt-out/failure rates.

-   Do not credit revenue to the site or app without attribution rules.
    Document attribution windows and exclusions with Tashas.

# 8. SEO and local-search requirements

  -----------------------------------------------------------------------
  **SEO REALITY\
  **The engineering team can improve discoverability and eligibility, but
  cannot guarantee a first-place ranking. Results depend on relevance,
  competition, authority, branch data quality, website performance and
  ongoing work.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

-   Keep critical branch and menu content crawlable in server-rendered
    or static HTML; avoid requiring app install, sign-in or client-only
    JavaScript to access core search content.

-   Create unique canonical location pages for every verified branch
    with real address, phone, hours, amenities, menu links, reservation
    CTA, directions and original branch content.

-   Add valid Restaurant / LocalBusiness JSON-LD on applicable pages.
    Use only accurate data present in visible page content; validate
    markup and monitor Search Console.

-   Generate XML sitemap, robots.txt, canonical URLs, clean URLs, 301
    redirects for changed paths, Open Graph metadata, descriptive
    titles/meta descriptions, image alt text and properly sized image
    variants.

-   Use descriptive filenames and modern responsive image formats for
    production derivatives; preload only genuinely critical hero imagery
    and lazy-load below-the-fold photos.

-   Link to each official Google Business Profile for the corresponding
    real branch. Maintain consistent name/address/phone/hours; do not
    create fake locations or reviews.

-   Add Search Console, analytics and conversion events. Monitor index
    coverage, branded and non-branded searches, local landing-page
    traffic, booking conversions and Core Web Vitals.

-   For app stores, implement App Store Optimisation: correct app
    name/subtitle/description, accurate category, screenshots, privacy
    disclosures, version notes and review prompts that do not gate
    functionality.

Reference: Google Search Central LocalBusiness structured data guidance:
https://developers.google.com/search/docs/appearance/structured-data/local-business

# 9. HTML access, downloading, iOS, Android and WhatsApp

  -----------------------------------------------------------------------
  **Requirement**                     **Implementation rule**
  ----------------------------------- -----------------------------------
  Self-contained gallery              Embed all 28 JPEGs as data URIs in
                                      the delivered HTML. Include a
                                      metadata JSON object in the source;
                                      maintain asset ID, filename and
                                      descriptive alt text.

  Download HTML                       Include a visible Download HTML
                                      button that saves a standalone
                                      .html file with embedded imagery
                                      and metadata. Test the downloaded
                                      file offline.

  iOS / Android                       Use responsive CSS, safe-area
                                      padding, keyboard-friendly
                                      controls, accessible tap targets,
                                      native share fallback and PWA
                                      manifest/install guidance when
                                      served over HTTPS.

  Share sheet                         Use navigator.share and
                                      navigator.canShare only after
                                      feature detection; file sharing
                                      varies by OS/browser and must
                                      gracefully fall back.

  WhatsApp                            Include an explicit WhatsApp
                                      button. When hosted over HTTPS,
                                      share the public page URL through
                                      wa.me. For local file access,
                                      explain that a local path cannot be
                                      opened by other users; provide
                                      Download HTML and native file-share
                                      fallback.

  Production URLs                     Do not hard-code temporary sandbox
                                      paths as public app URLs. The site
                                      must be deployed to a stable HTTPS
                                      domain before its page link can be
                                      shared widely or installed as a
                                      PWA.

  Offline limitations                 A single HTML file can show its
                                      embedded image assets offline, but
                                      live booking, rewards, analytics
                                      and API-connected content require
                                      network access.
  -----------------------------------------------------------------------

Web Share API reference:
https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API

# 10. Security, privacy and reliability

-   Keep secrets and provider credentials on the server. Never expose
    production API keys in HTML or mobile bundle.

-   Use secure sessions/token handling, rate limiting, input validation,
    server-side pricing/eligibility and least-privilege admin roles.

-   Apply South African POPIA principles: collect only necessary
    personal data, explain purposes, store consent records, support
    access/correction/deletion workflows and define retention.

-   Payment data must be handled by an approved provider. Do not store
    raw card details.

-   Log operational events without unnecessarily logging sensitive guest
    data. Use idempotency for bookings, points and notifications.

-   Add error monitoring, backups, health checks, dependency scans,
    secure headers, CSP and deployment/rollback instructions.

# 11. Suggested technical architecture

  -----------------------------------------------------------------------
  **Layer**                           **Suggested approach**
  ----------------------------------- -----------------------------------
  Web                                 Next.js + TypeScript for crawlable
                                      pages and responsive web
                                      experience; use server rendering /
                                      static generation for locations and
                                      editorial content.

  Mobile                              If native capabilities are
                                      required, use React Native + Expo +
                                      TypeScript sharing domain types and
                                      API contracts; otherwise deliver an
                                      installable PWA as the first
                                      mobile-accessible release.

  Backend                             TypeScript API/domain modules;
                                      PostgreSQL; schema migrations;
                                      queues for reminders and campaigns;
                                      typed validation at the API
                                      boundary.

  State/data                          TanStack Query or equivalent
                                      server-state cache; central domain
                                      types; no business rules hidden in
                                      screen components.

  CMS/admin                           Manage branch details, menus,
                                      offers, campaigns, image assets,
                                      reward rules and notification
                                      templates with role controls and
                                      audit trail.

  Analytics                           Privacy-aware event interface,
                                      campaign UTM capture, branch
                                      attribution and dashboard
                                      integrations configured via
                                      environment variables.

  Images                              Original supplied JPEGs retained in
                                      the handover; production optimised
                                      responsive variants served from
                                      stable HTTPS storage/CDN.
  -----------------------------------------------------------------------

# 12. Required TypeScript model examples

// src/assets/types.ts

export interface BrandImageAsset {

id: string;

originalFilename: string;

title: string;

altText: string;

width: number;

height: number;

fileSizeBytes: number;

sha256: string;

role: \"food\" \| \"coffee\" \| \"interior\" \| \"people\" \|
\"ingredients\" \| \"campaign\";

recommendedUse: string;

exif: Record\<string, string\>;

publicUrl?: string; // assigned only after approved upload/CDN
deployment

}

// src/booking/types.ts

export type BookingStatus = \"requested\" \| \"confirmed\" \|
\"amended\" \| \"cancelled\" \| \"completed\" \| \"no-show\" \|
\"waitlisted\";

export interface BookingRequest {

branchId: string; date: string; time: string; partySize: number;

guestName: string; guestEmail: string; guestPhone: string;

occasion?: string; specialRequest?: string; idempotencyKey: string;

}

// src/rewards/types.ts

export type RewardTxnType = \"earn\" \| \"redeem\" \| \"expire\" \|
\"reverse\" \| \"adjust\";

export interface RewardLedgerEntry {

id: string; guestId: string; type: RewardTxnType; points: number;

referenceType: \"booking\" \| \"visit\" \| \"campaign\" \| \"admin\";

referenceId: string; idempotencyKey: string; createdAt: string;

}

// src/notifications/types.ts

export type Channel = \"in-app\" \| \"push\" \| \"email\" \| \"sms\" \|
\"whatsapp\";

export interface GuestPreference {

guestId: string; category: \"booking\" \| \"service\" \| \"rewards\" \|
\"events\" \| \"marketing\";

enabled: boolean; channels: Channel\[\]; updatedAt: string;

}

# 13. Production booking, payments and lifecycle marketing engine

  -----------------------------------------------------------------------
  **MANDATORY BUILD SCOPE\
  **Booking, payment, notifications and marketing automation must operate
  as one connected system. The app must not be a set of static screens or
  dead buttons. Implement typed domain services, persistent records,
  provider adapters, admin settings, operational logs and automated
  tests. Live integrations may remain disabled until Tashas approves
  providers and supplies access, but the end-to-end flow must work
  against a clearly labelled sandbox/demo adapter.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

Design principle: a customer action should progress safely from
discovery to booking, payment (when required), confirmation, visit,
follow-up and repeat engagement. Use a shared event system, but keep
payment, reservations, notifications and marketing as separate modules
with clear contracts.

## 13.1 Booking system --- end-to-end guest journey

  -----------------------------------------------------------------------
  **Stage**                           **Required behaviour**
  ----------------------------------- -----------------------------------
  Find a café                         Search by area, city, current
                                      location or branch name; list/map
                                      views; show verified branch details
                                      and directions.

  Choose date and party               Date, time/service period, guest
                                      count and optional occasion.
                                      Support branch-specific rules and
                                      opening hours.

  Availability                        Return live slots from the
                                      authorised reservation provider.
                                      Hold a selected slot only if the
                                      provider supports holds; set expiry
                                      and release behaviour.

  Guest details                       Guest checkout plus optional
                                      account autofill. Collect only
                                      required name, email and mobile
                                      data. Capture occasion and
                                      accessibility/seating requests only
                                      when supported.

  Policy and deposit                  Show the branch-specific deposit,
                                      cancellation, grace-period, no-show
                                      and refund terms before final
                                      confirmation.

  Payment when required               Create an internal payment attempt
                                      linked to a booking attempt.
                                      Confirm only after authoritative
                                      server-side payment verification
                                      and booking-provider confirmation.

  Confirmation                        Display booking reference, branch,
                                      date/time, party size, paid/deposit
                                      amount, policy summary, calendar
                                      action and manage-booking link.

  Manage booking                      View, amend, reschedule, cancel or
                                      join a waitlist when the configured
                                      provider allows it. Reconfirm any
                                      changes to deposit or policy.

  Visit and follow-up                 Allow staff/provider status to mark
                                      attended, completed, cancelled or
                                      no-show. Trigger eligible rewards
                                      and post-visit communications only
                                      from verified status events.
  -----------------------------------------------------------------------

## 13.2 Booking rules and failure states

-   Never show a slot as confirmed solely because it appeared in a
    cached list. Revalidate availability before final create/confirm
    when the provider supports revalidation.

-   Use idempotency keys for create, amend, cancel, waitlist and payment
    requests. A repeated request must return the same result or a safe
    conflict, not create duplicates.

-   Persist a booking state machine: draft → availability-selected →
    pending-payment (if needed) → requested → confirmed; terminal or
    recovery states include cancelled, waitlisted, failed and no-show.
    Keep provider state and internal state mapping documented.

-   Handle provider timeout after submit by checking the provider using
    the correlation/idempotency reference before retrying. Never tell
    the guest a booking failed until the system has reconciled whether
    it succeeded.

-   Use signed, verified and deduplicated provider webhooks for booking
    changes. Save webhook receipt, event identifier, signature
    verification result, timestamp and processing status.

-   If payment succeeds but reservation creation fails, put the workflow
    into a reconciliation state and either retry reservation creation
    safely or initiate the approved refund path. Alert staff and
    communicate accurately to the guest.

-   If a slot expires while the guest is paying, do not charge for an
    unavailable reservation unless the payment flow and provider policy
    explicitly support a recoverable hold. Release/void/refund according
    to gateway status and approved policy.

-   Do not invent booking integrations. If the chosen booking provider
    cannot expose APIs, use an approved hosted booking path and clearly
    label its limits; do not pretend it is a fully native booking
    system.

## 13.3 Payment system --- secure and reconcilable

Implement payment through a server-side provider adapter. Select the
real gateway only after Tashas confirms merchant account, supported
countries/currencies, methods, settlement needs and commercial terms. Do
not hard-code a gateway into screen components.

  -----------------------------------------------------------------------
  **Payment capability**              **Build requirements**
  ----------------------------------- -----------------------------------
  Payment use cases                   Reservation deposits or
                                      pre-authorisations where required;
                                      approved event/ticket payments;
                                      vouchers/gift cards; and
                                      order-ahead payments only for
                                      branches/providers that actually
                                      support them.

  Payment methods                     Cards and any additional methods
                                      that the contracted gateway and
                                      Tashas merchant account support.
                                      Treat Apple Pay, Google Pay,
                                      instant EFT and other methods as
                                      capability-discovered, not
                                      guaranteed.

  Checkout                            Prefer gateway-hosted checkout or
                                      approved tokenised SDK. Clearly
                                      show amount, currency,
                                      item/deposit, refund/cancellation
                                      rules and a secure return URL.

  Server verification                 Verify gateway status server-side
                                      through an authenticated
                                      API/webhook. Never trust the client
                                      redirect, query string or
                                      screenshot as proof of payment.

  Payment states                      Create a documented state machine
                                      covering created, pending,
                                      requires-action, authorised,
                                      succeeded, failed, cancelled,
                                      refund-pending, partially-refunded
                                      and refunded, mapped to the
                                      gateway's actual states.

  Receipts                            Create a receipt/reference record;
                                      send payment confirmation only
                                      after verified success. Include
                                      business identity, reference,
                                      amount, currency, date and support
                                      route according to approved
                                      invoicing rules.

  Refunds                             Support full and partial refunds
                                      where allowed, with role-based
                                      approval, reason, gateway
                                      reference, audit trail and
                                      notification. Refund state must
                                      reconcile with provider state.

  Operations                          Add webhook signature verification,
                                      idempotency, retries,
                                      dead-letter/replay handling,
                                      settlement/reconciliation report
                                      and alerts for mismatched
                                      booking/payment states.
  -----------------------------------------------------------------------

## 13.4 Payment-to-booking transaction flow

1.  Create a booking attempt and an internal reference on the server.

2.  Ask the reservation provider to validate the chosen slot and create
    a temporary hold if it supports one.

3.  Calculate any required deposit and applicable fees on the server;
    never trust totals submitted by the browser/app.

4.  Create a payment session through the gateway adapter using the
    internal booking-attempt reference as the merchant reference.

5.  Send the guest to the hosted checkout or approved provider SDK, then
    return them to a status page that polls the server safely.

6.  Verify the payment status via the gateway's API/webhook, verify
    signatures and deduplicate the event.

7.  Confirm or finalise the reservation through the authorised booking
    provider, then persist both records and publish
    \`booking.confirmed\` and \`payment.succeeded\` events.

8.  If either side fails, enter a reconciliation workflow. Do not
    silently mark a booking paid or confirmed. Show clear next steps and
    alert staff when manual action is needed.

## 13.5 Required payment service contract

// src/payments/types.ts

export type PaymentStatus =

\| \"created\" \| \"pending\" \| \"requires-action\" \| \"authorised\"

\| \"succeeded\" \| \"failed\" \| \"cancelled\"

\| \"refund-pending\" \| \"partially-refunded\" \| \"refunded\";

export type PaymentPurpose =

\| \"reservation-deposit\" \| \"event\" \| \"voucher\" \| \"order\";

export interface CreatePaymentRequest {

guestId?: string;

bookingAttemptId?: string;

purpose: PaymentPurpose;

referenceId: string;

amountMinor: number; // ZAR cents; integer only

currency: \"ZAR\" \| string; // validate against gateway/account config

description: string;

returnUrl: string;

cancelUrl: string;

idempotencyKey: string;

metadata?: Record\<string, string\>;

}

export interface PaymentRecord {

id: string;

provider: string;

providerPaymentId?: string;

referenceId: string;

status: PaymentStatus;

amountMinor: number;

currency: string;

purpose: PaymentPurpose;

createdAt: string;

updatedAt: string;

}

export interface PaymentProvider {

createCheckout(request: CreatePaymentRequest): Promise\<{

payment: PaymentRecord;

checkoutUrl?: string;

clientToken?: string;

}\>;

getStatus(paymentId: string): Promise\<PaymentRecord\>;

refund(request: {

paymentId: string; amountMinor?: number; reason: string;

idempotencyKey: string;

}): Promise\<PaymentRecord\>;

verifyWebhook(rawBody: Uint8Array, headers: Record\<string, string\>):
Promise\<{

eventId: string; payment: PaymentRecord; eventType: string;

}\>;

}

## 13.6 Notification centre --- service messages and marketing journeys

Use one central notification orchestrator with separate transactional
and marketing rules. Booking/payment messages are service
communications; promotions and campaigns require the correct consent or
other legally approved basis. The system must record the consent
wording/version, purpose, channel, timestamp, source, status and
withdrawal. Get Tashas legal/privacy sign-off for the production rules
before activating marketing sends.

  -----------------------------------------------------------------------
  **Trigger**             **Transactional         **Marketing / lifecycle
                          action**                action**
  ----------------------- ----------------------- -----------------------
  Booking confirmed       Immediate confirmation  Optional
                          with reference and      preference-based
                          branch details.         pre-visit experience
                                                  message; never bundle
                                                  promotional consent
                                                  into booking
                                                  acceptance.

  Before booking          If checkout is started  Send an
                          and abandoned, do not   abandoned-booking
                          claim a reservation     reminder only where
                          exists.                 consent/legal rules
                                                  permit; use a short
                                                  expiry and frequency
                                                  cap.

  Booking reminder        Configurable reminders, Optional branch story
                          e.g. 24 hours before,   or menu suggestion only
                          plus final              where the channel and
                          branch-approved         consent permit.
                          reminder.               

  Booking                 Immediate accurate      Suppress promotional
  changed/cancelled       update and              messages if the guest
                          policy/payment          has an unresolved
                          implications.           service issue, if
                                                  Tashas defines that
                                                  rule.

  Visit completed         Send feedback or        Offer next-visit story,
                          service follow-up only  seasonal menu or
                          according to approved   relevant branch
                          template and            campaign only to
                          consent/policy.         eligible segments.

  Payment succeeded /     Secure receipt/status   Do not attach unrelated
  failed / refund         message and clear       promotional content to
                          support pathway.        payment failure or
                                                  dispute communications.

  Reward earned / near    Show points/reward      Relevant reward or
  expiry                  balance, expiry and     experience campaign
                          terms.                  subject to preferences
                                                  and frequency caps.

  Guest inactive          No transaction message  Win-back journey based
                          is implied.             on recency/frequency
                                                  and valid consent; cap
                                                  messages and stop after
                                                  opt-out.

  New branch / menu /     Operational info only   Segment by location,
  event                   where relevant.         interest and
                                                  engagement; link to a
                                                  specific landing page
                                                  with source tracking.
  -----------------------------------------------------------------------

## 13.7 Guest preferences and marketing consent

-   Separate channel and category preferences: booking/service, event
    reminders, rewards, menu/news and promotional offers.

-   For direct marketing, capture and retain the consent or legally
    approved basis that applies to each channel; make the choice
    understandable and freely given. Do not use a pre-ticked checkbox,
    forced opt-in or bundled consent.

-   Record source, timestamp, consent text/version, purpose,
    destination/channel and changes. Provide an easy unsubscribe/opt-out
    and suppress future marketing promptly.

-   Maintain a global suppression list that overrides campaign lists.
    Re-check eligibility immediately before sending, not only when the
    audience is created.

-   Add frequency caps, quiet hours, send-time configuration, bounce
    handling, push-token invalidation and channel fallback rules.

-   Keep necessary booking/payment service communications distinct from
    marketing communications. Do not include marketing content in
    mandatory transactional messages without review.

-   Use an in-app inbox so guests can revisit relevant confirmations,
    receipts, booking updates and reward notices.

## 13.8 Marketing automation engine and segmentation

  -----------------------------------------------------------------------
  **Module**                          **Required capability**
  ----------------------------------- -----------------------------------
  Customer profile / CRM              One guest profile with verified
                                      contact points, branches of
                                      interest, booking history, reward
                                      activity and consent history;
                                      minimise collected data.

  Segments                            Branch affinity, visit
                                      recency/frequency, event interest,
                                      rewards status and campaign source.
                                      Do not infer sensitive traits.

  Campaign builder                    Admin can choose audience, channel,
                                      template, schedule, frequency cap,
                                      landing page, UTM tags, test
                                      audience and approval status.

  Journey builder                     Event-triggered and scheduled
                                      workflows with waits, conditions,
                                      exits, goals and suppression
                                      checks.

  Content and offers                  Manage campaign cards, seasonal
                                      menus, new branch introductions,
                                      events, vouchers and offer dates.
                                      Keep branch facts and offer terms
                                      approved.

  Attribution                         Persist first-touch and last-touch
                                      source where consent/analytics
                                      rules allow. Track campaign ID, UTM
                                      values, deep link and conversion
                                      window.

  Experiments                         Support A/B tests for subject line,
                                      creative, CTA and send time, with
                                      holdout groups when practical.

  Reporting                           Delivery, bounce, open/click where
                                      available, opt-out, booking
                                      conversion, payment conversion,
                                      redemption and attributable
                                      revenue; distinguish observed data
                                      from estimates.

  Governance                          Role-based publishing approval,
                                      scheduled previews, audit logs,
                                      rollback/cancel send, test mode and
                                      per-branch overrides.
  -----------------------------------------------------------------------

## 13.9 Domain events connecting booking, payment and marketing

Publish a durable event after a state change is committed. Use an outbox
pattern or equivalent so a database commit and event publication cannot
silently drift. Consumers must be idempotent; failed work must retry
with backoff and move to a reviewable dead-letter queue after configured
attempts.

// src/events/domainEvents.ts

export type TashasDomainEvent =

\| { type: \"booking.started\"; attemptId: string; branchId: string }

\| { type: \"booking.confirmed\"; bookingId: string; guestId: string;
startsAt: string }

\| { type: \"booking.cancelled\"; bookingId: string; guestId: string;
reason?: string }

\| { type: \"booking.completed\"; bookingId: string; guestId: string;
branchId: string }

\| { type: \"payment.succeeded\"; paymentId: string; referenceId:
string; guestId?: string; amountMinor: number }

\| { type: \"payment.failed\"; paymentId: string; referenceId: string;
guestId?: string }

\| { type: \"payment.refunded\"; paymentId: string; referenceId: string;
amountMinor: number }

\| { type: \"reward.earned\"; guestId: string; points: number;
referenceId: string }

\| { type: \"campaign.conversion\"; campaignId: string; conversionType:
string; referenceId: string };

export interface EventEnvelope\<T\> {

eventId: string;

occurredAt: string;

schemaVersion: number;

correlationId: string;

payload: T;

}

## 13.10 Minimum API surface

  -----------------------------------------------------------------------
  **Route (example)**                 **Purpose / rules**
  ----------------------------------- -----------------------------------
  GET /api/branches                   Return verified published branches;
                                      location filters must not invent
                                      service coverage.

  GET /api/branches/:id/availability  Return provider availability;
                                      include freshness/expiry where
                                      relevant.

  POST /api/booking-attempts          Create idempotent server-side
                                      attempt and validate selected slot.

  POST /api/bookings                  Create or finalise reservation
                                      using provider adapter; require
                                      idempotency key.

  GET /api/bookings/:id               Return only the authenticated
                                      guest's booking or authorised staff
                                      view.

  POST /api/bookings/:id/reschedule   Validate policy, availability and
                                      any deposit difference.

  POST /api/bookings/:id/cancel       Apply branch/provider policy and
                                      create a cancellation audit event.

  POST /api/payments/checkout         Create gateway checkout from
                                      server-calculated payable amount;
                                      never accept arbitrary trusted
                                      totals.

  GET /api/payments/:id/status        Return verified internal status,
                                      not raw secrets or unverified
                                      gateway payload.

  POST                                Verify signature against raw body,
  /api/payments/:provider/webhook     deduplicate event and enqueue
                                      processing.

  POST /api/payments/:id/refund       Staff permission and policy checks;
                                      idempotent; record reason and
                                      gateway reference.

  GET/PUT /api/guest/preferences      Read/update consent and
                                      notification preferences with an
                                      auditable record.

  GET /api/guest/notifications        Return authorised in-app
                                      notification history.

  Admin /api/campaigns/\*             Restricted role; create, test,
                                      approve, schedule, pause and report
                                      on campaigns.
  -----------------------------------------------------------------------

## 13.11 Admin dashboard and operational tools

-   Branch settings: booking windows, table/slot rules as provider
    permits, deposit policy, cancellation policy, service hours and
    contact details.

-   Booking operations: search bookings, view provider status, manually
    reconcile a failed sync, record a supported staff outcome and view
    the audit trail.

-   Payment operations: payment attempts, provider references, pending
    reconciliation, refunds, settlement export and gateway webhook
    failures. Restrict refund actions by role.

-   Campaign controls: audience preview/count, test-send, approval,
    schedule, pause/cancel, suppression status and branch targeting.

-   Guest support: unified view of booking, payment, consent,
    notification delivery and reward events with personal data masked by
    default.

-   Monitoring: queue depth, webhook errors, notification failures,
    payment mismatches, booking/provider latency, retries and
    dead-letter alerts.

## 13.12 New database tables / persistence requirements

  -----------------------------------------------------------------------
  **Entity**                          **Important fields / constraints**
  ----------------------------------- -----------------------------------
  BookingAttempt                      id, guestId, branchId,
                                      selectedSlot, state, expiryAt,
                                      idempotencyKey UNIQUE,
                                      correlationId, createdAt

  Booking                             id, guestId, branchId, provider,
                                      externalId, status, date/time,
                                      partySize, policyVersion,
                                      depositAmountMinor,
                                      createdAt/updatedAt

  BookingEvent                        id, bookingId, providerEventId
                                      UNIQUE when supplied, eventType,
                                      payloadRedacted, signatureVerified,
                                      processedAt

  Payment                             id, provider, providerPaymentId,
                                      purpose, referenceId, amountMinor,
                                      currency, status, idempotencyKey
                                      UNIQUE, gatewayReference,
                                      timestamps

  PaymentEvent                        id, providerEventId UNIQUE,
                                      paymentId, eventType,
                                      rawPayloadEncryptedOrRedacted,
                                      signatureVerified, processedAt

  Refund                              id, paymentId, amountMinor, reason,
                                      status, approvedBy,
                                      providerReference, idempotencyKey
                                      UNIQUE, timestamps

  GuestConsent                        id, guestId/contactHash, purpose,
                                      channel, status,
                                      consentTextVersion, source,
                                      capturedAt, withdrawnAt

  Notification                        id, guestId, category,
                                      templateVersion, payload, dedupeKey
                                      UNIQUE, scheduledAt, status,
                                      campaignId

  NotificationDelivery                id, notificationId, channel,
                                      providerMessageId, status,
                                      attempts, lastError, sentAt

  Campaign / Journey                  id, status, audienceRuleVersion,
                                      consentPolicyVersion, schedule,
                                      frequencyCap, approval,
                                      attributionWindow

  DomainOutbox                        eventId UNIQUE, eventType,
                                      schemaVersion, aggregateId,
                                      payload, publishedAt, attempts,
                                      nextAttemptAt
  -----------------------------------------------------------------------

## 13.13 Security, privacy and payments controls

-   Never store raw card numbers, CVV or payment authentication secrets.
    Use hosted checkout or approved tokenisation/SDK from the contracted
    gateway.

-   Keep payment, booking, messaging and analytics secrets server-side.
    Verify webhook signatures with the provider's documented method and
    retain raw request bytes only as necessary under a reviewed
    retention policy.

-   Authorise each booking, receipt, refund, preference and admin
    request on the server; never rely on hidden buttons or client role
    flags for access control.

-   Use integer minor-unit amounts, validate currency, recalculate
    amount payable server-side and reconcile gateway status
    independently from booking state.

-   Do not send marketing messages without a valid recorded basis for
    the intended recipient, message purpose and channel. Build
    one-click/low-friction opt-out, suppression checks and auditable
    proof of consent or other approved basis.

-   Apply POPIA data minimisation, purpose limitation, access controls,
    retention schedules and secure deletion/correction workflows. Obtain
    Tashas legal/privacy approval before activation of direct marketing
    journeys.

-   Keep notification previews free of sensitive details; mask guest
    contact/payment data in logs and admin reports.

-   Add rate limits, abuse detection, fraud-aware redemption controls,
    encrypted transport, backups, dependency monitoring and a documented
    incident response/recovery procedure.

## 13.14 Measurement --- business outcomes, not vanity metrics

  -----------------------------------------------------------------------
  **KPI**                             **Measurement definition**
  ----------------------------------- -----------------------------------
  Booking conversion                  Completed confirmed bookings
                                      divided by qualified booking
                                      starts; report by branch, device
                                      and campaign.

  Payment success                     Verified successful payment
                                      attempts divided by initiated
                                      payment attempts; segment by
                                      provider/method without exposing
                                      sensitive data.

  Booking abandonment                 Booking attempts with no confirmed
                                      booking, after a defined timeout,
                                      excluding known technical test
                                      traffic.

  Payment reconciliation incidents    Number and value of mismatches
                                      between internal payment, gateway
                                      and booking records; target zero
                                      unresolved beyond agreed SLA.

  Notification delivery health        Accepted/delivered where provider
                                      supports it, hard bounce, failure,
                                      retry, push token invalidation and
                                      opt-out rates.

  Lifecycle conversion                Campaign-attributed bookings,
                                      visits, voucher redemptions and
                                      revenue under an agreed attribution
                                      window and consent configuration.

  Repeat guest rate                   Share of identifiable
                                      consenting/eligible guests with
                                      another completed visit in the
                                      defined period.

  Incremental effect                  Use holdouts or controlled tests
                                      where practical; do not claim
                                      campaign-generated revenue solely
                                      from last-click reporting.
  -----------------------------------------------------------------------

## 13.15 Required acceptance tests before launch

-   A guest can select a real provider-backed slot, complete any
    > required payment and receive a confirmed booking only when both
    > required states are verified.

-   Repeated submit, network timeout and duplicate webhook tests never
    > create duplicate bookings or double charges.

-   Payment return URL alone cannot mark a payment successful; verified
    > gateway status is required.

-   A payment succeeds but booking finalisation fails: workflow enters
    > reconciliation; guest sees a truthful status; staff receive an
    > alert; retry/refund follows configured policy.

-   Failed, abandoned, cancelled, expired, refunded and partially
    > refunded payments are shown accurately and reconcile after retry.

-   Booking amendments/cancellations produce correct notifications and
    > deposit/refund handling under the approved policy.

-   Marketing sends are blocked when the applicable consent is missing,
    > withdrawn, mismatched by channel or present on the suppression
    > list.

-   Booking confirmation/reminder, payment confirmation/failure/refund,
    > waitlist, visit follow-up and rewards journeys are tested with
    > delivery retries and deduplication.

-   A campaign can be tested, approved, scheduled, paused and reported
    > by a role with the correct permission. Sending audience preview
    > respects consent and suppression.

-   Attribution parameters survive campaign landing page → booking →
    > payment and appear in the reporting model without placing personal
    > data in URLs.

-   Admin permissions, guest data isolation, webhook-signature failures,
    > rate limiting, log redaction and retention/deletion workflows are
    > covered by tests.

-   All payment, booking, notification and marketing adapters have
    > demo/sandbox tests plus clear production configuration errors when
    > credentials are missing.

## 13.16 Required provider and policy checklist

Do not invent the following. Obtain them from Tashas and the contracted
providers before switching live features on:

-   Reservation provider contract, branch coverage,
    availability/create/amend/cancel/waitlist API capabilities, webhook
    security, rate limits and sandbox credentials.

-   Payment gateway, merchant account, supported payment methods, hosted
    checkout/SDK choice, webhook verification, refunds,
    settlement/reconciliation exports, dispute workflow and sandbox
    credentials.

-   Approved deposit amount/rules, refund and cancellation policies,
    no-show approach, booking time limits and branch-specific overrides.

-   Notification provider credentials and sender identities for email,
    push, SMS and/or WhatsApp; approved templates and template approval
    requirements.

-   Approved loyalty/reward policy and whether rewards can be
    earned/redeemed on bookings, visits, vouchers or orders.

-   Privacy notice, consent copy, contact/retention policy, marketing
    channel permissions and legal sign-off under POPIA/direct marketing
    rules.

# 14. Claude Code master build prompt

  -----------------------------------------------------------------------
  **COPY AND PASTE INTO CLAUDE CODE\
  **Open the project repository and use the full instruction below.
  Claude Code should inspect first, then build incrementally and run
  tests after every major feature.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

You are the lead product designer, senior full-stack engineer, mobile UX
specialist,

SEO engineer and growth-platform architect for the Tashas digital
experience.

GOAL

Build a premium, production-oriented Tashas app and responsive website
that acts as a

customer service and marketing growth engine. Deliver a fully
self-contained HTML image

library with all 28 supplied photos embedded, descriptive metadata,
search, Download HTML,

native share and WhatsApp share controls, then extend the project into
the app/site described

in this brief.

FIRST ACTIONS

1\. Inspect the repository, framework, dependency versions, existing
screens, tests, assets,

environment variables, deployment config and existing integrations. Do
not overwrite working

code until you understand it.

2\. Produce a file-by-file plan and identify missing credentials,
approved content and blockers.

3\. Use the supplied asset manifest Tashas_28_Image_Asset_Metadata.json
as the source of image

filenames, pixel dimensions, alt text, hashes and recommended placement.
Preserve originals.

4\. Implement feature by feature, with typecheck, lint, tests and visual
QA after each phase.

BRAND AND UI

Use Tashas\' own brand direction: warm editorial luxury, bright natural
light, cream, oak, stone,

muted botanical green, restrained brass, excellent food photography,
beautiful whitespace and

friendly premium service. Do not use MABU\'s black-and-gold visual
language. Use supplied photos;

never invent dishes, prices, dietary claims, addresses or branch
details. All final menu and branch

content must be approved by Tashas.

CORE CUSTOMER FEATURES --- MUST WORK END TO END

\- responsive home, branch search/map/list, location detail pages,
menus, item detail, favourites;

\- full booking lifecycle: live availability, safe slot validation/hold
where supported, create, confirm, amend, reschedule, cancel, waitlist
and booking history through a provider adapter;

\- order-ahead/delivery/collection only for confirmed supported branches
and providers;

\- guest profile, booking/order history where supported,
loyalty/rewards, offers and vouchers;

\- central event-driven notification service with in-app, push/email and
optional SMS/WhatsApp adapters, preference centre, reminders, delivery
retries, dedupe and immediate opt-out enforcement;

\- events, campaign landing pages, QR/UTM tracking, referral and
lifecycle campaign foundation;

\- accessible Help, policy and contact routes; loading, empty, error and
offline/retry states.

SEO AND DISCOVERY

Use crawlable SSR/static pages, unique verified branch pages, valid
Restaurant/LocalBusiness JSON-LD,

sitemap.xml, robots.txt, canonical metadata, redirects, Open Graph,
descriptive image alt text,

responsive modern image formats, Search Console and analytics
integration. Follow Google guidance.

Never promise rank #1; measure results. Do not fabricate reviews or
create location pages for branches

that do not exist.

HTML ASSET LIBRARY

\- Embed every supplied JPEG in the standalone HTML as a data URI, and
embed the metadata manifest.

\- Include descriptive alt text, search/filter, expandable metadata, a
visible download button that

downloads a truly self-contained HTML file, native file-sharing with
feature detection and

graceful fallback, plus a WhatsApp button.

\- On HTTPS hosting, WhatsApp share should share the hosted URL. When
opened as a local file, do not

pass a file:// or temporary sandbox URL to WhatsApp; offer
download/native file sharing instead.

\- Make all controls usable on iOS Safari, Android Chrome and desktop,
keyboard accessible and touch

friendly. A PWA install flow requires HTTPS and a web app manifest; do
not claim local file mode is

installable as a PWA.

INTEGRATIONS AND SAFETY

\- Build typed adapters for reservation, POS/order, payment gateway,
messaging, analytics, loyalty and maps; implement demo/sandbox adapters
but never fake production success.\
- Implement a real payment lifecycle: server-calculated amount,
hosted/tokenised checkout, verified webhook/API status, reconciliation,
refunds, receipts and audit logs.\
- Connect committed booking/payment events to the notification and
lifecycle marketing engine using a durable outbox/event bus.

\- Do not invent provider APIs or secrets. Use mock adapters only in
development/demo and label them.

\- Keep credentials server-side; never store raw card data; use
gateway-hosted checkout/tokenisation; verify webhook signatures;
validate totals, deposit policies and reward rules server-side.\
- Marketing journeys must use channel-specific consent records,
suppression lists, rate limits, preferences and easy opt-out under
Tashas-approved POPIA rules.

\- Respect applicable privacy/marketing-consent rules and POPIA-related
data minimisation and retention.

\- Use idempotency and event deduplication for booking, points,
redemption and notifications.

TESTS AND DEFINITION OF DONE

\- All 28 images render with correct metadata and alt text; no broken
image assets.

\- Downloaded HTML opens offline with all 28 embedded images and
searchable metadata.

\- Web share is feature-detected. WhatsApp share works with the hosted
URL and local-file fallback is clear.

\- Layout is verified on iPhone-sized, Android-sized, tablet and desktop
viewports.

\- Booking, payment/refund/reconciliation lifecycles, rewards ledger,
notification preferences/delivery retries, consent enforcement,
marketing journeys and campaign attribution have unit/integration/E2E
tests.\
- Test payment success with booking failure, duplicate webhooks,
redirect spoofing, expired slot, partial refund, opt-out immediately
before campaign send and suppression-list enforcement.

\- SEO: validate structured data, canonical URLs, sitemap, robots,
titles, redirects and image dimensions.

\- Typecheck, lint, unit tests, integration tests, E2E tests and
accessibility checks pass.

\- Provide README, .env.example, migrations, deployment instructions,
rollback plan, privacy notes,

provider credential checklist and an honest list of remaining blockers.

Do not leave dead CTAs, fake confirmations, fake availability, mock
revenue or invented provider data

in production. Build a distinct Tashas experience rather than copying
another restaurant\'s interface.

# 15. Test checklist / acceptance criteria

-   All 28 assets are embedded in this document and appear in the
    > standalone HTML library with filenames, dimensions, file sizes,
    > SHA-256 and alt text.

-   HTML works offline after download: images, filtering and metadata
    > disclosure still function.

-   Download HTML creates a valid standalone .html file that opens in
    > current iOS and Android browsers.

-   Native sharing is feature-detected; WhatsApp URL share works only
    > after HTTPS deployment; local-file fallback never shares an
    > inaccessible file path.

-   Responsive layout, tap targets, keyboard navigation, contrast, alt
    > text and reduced motion are reviewed.

-   Booking tests verify duplicate-submit prevention, slot conflicts,
    > failure recovery and provider status updates.

-   Rewards tests verify duplicate prevention, earning, redemption,
    > expiry and reversals.

-   Notifications respect guest preferences; marketing is not sent
    > without valid consent; retries and deduplication are tested.

-   SEO audit confirms verified branch pages, canonical tags,
    > titles/meta descriptions, sitemap, robots,
    > LocalBusiness/Restaurant markup and analytics events.

-   Readme lists how to run locally, build/deploy PWA/native apps,
    > configure credentials and troubleshoot common issues.

# 16. Image library and metadata methodology

The following 28 original JPEG files are embedded in this briefing in
original resolution. File size, dimensions, aspect ratio, hash and the
EXIF fields present were read from the files. Alt text, titles and usage
recommendations are editorial annotations for implementation, not
embedded EXIF facts. The supplied files do not include reliable camera
model or capture-time metadata; do not describe them as camera-verified
photographs.

Full manifest: Tashas_28_Image_Asset_Metadata.json. Self-contained
prototype: Tashas_28_Image_Asset_Library.html. Original assets are
preserved in the companion ZIP.

# 17. Embedded visual asset library --- all 28 images

The 28 images are kept at full resolution in `tashas/assets/originals/` and described in
`tashas/assets/Tashas_28_Image_Asset_Metadata.json`. The supplied self-contained gallery is
`tashas/assets/handover/Tashas_28_Image_Asset_Library.html`.

# 18. External references and final notes

Tashas Group brand story: https://www.tashasgroup.com/tashas

Tashas customer-facing website: https://www.tashascafe.com/home/

Google Search Central --- LocalBusiness structured data:
https://developers.google.com/search/docs/appearance/structured-data/local-business

MDN --- Web Share API:
https://developer.mozilla.org/en-US/docs/Web/API/Web_Share_API

South African Information Regulator --- Guidance Note on Direct
Marketing under POPIA:
https://inforegulator.org.za/wp-content/uploads/2020/07/GUIDANCE-NOTE-ON-DIRECT-MARKETING-IN-TERMS-OF-THE-PROTECTION-OF-PERSONAL-INFORMATION-ACT-4-OF-2013-POPIA.pdf

  -----------------------------------------------------------------------
  **FINAL DELIVERY RULE\
  **Treat the asset library as a source-of-truth handover. The app should
  preserve Tashas' visual personality, make genuine guest actions easy,
  and convert discovery into bookings, visits and repeat visits. All live
  booking, payment, loyalty and messaging services must be verified with
  Tashas before production activation.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
