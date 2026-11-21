# Building screens

How every screen in `apps/web` is put together. Follow it and a new screen will look, behave and
read like the rest of the product. The reference screens are the welcome page
(`app/(citizen)/page.tsx`), sign-in (`app/(citizen)/sign-in/`) and home (`app/(citizen)/home/`).

## 1. File pattern

```
app/(citizen)/<route>/page.tsx        server component: `metadata`, the guard, and <XScreen />
app/(citizen)/<route>/XScreen.tsx     'use client': data, state, markup
app/(citizen)/<route>/x.module.css    only if the design-system layout pieces are not enough
```

- The site is a **static export**. There is no server, no API routes, no server actions.
- Record IDs created at runtime (cases, drafts, messages) go in the **query string**, never in a
  path segment: `/applications/case/?id=CASE-DEMO-000041`. Read them with `useSearchParams()` and
  wrap the screen in `<Suspense>` in `page.tsx` (see `sign-in/page.tsx`).
- A dynamic path segment is only allowed for static content, with `generateStaticParams()`.
- Internal links are app-absolute **with a trailing slash**: `/services/`, `/messages/view/?id=…`.
  Use `AppLink` or `LinkButton`, never a raw `<a>`, so navigation stays client-side and works under
  a base path.
- Every page sets `export const metadata = { title: '…' }` (plain, short; the template adds the
  product name).

## 2. Data

Screens only talk to the mock services through the gateway.

```tsx
const token = usePersonToken();
const cases = useGatewayQuery(['cases', token], (g) => g.workflow.listCases(token ?? ''), {
  enabled: Boolean(token),
});

const book = useGatewayMutation((g, input: BookAppointmentInput) =>
  g.appointments.book(input, { idempotencyKey }),
);
```

- Query keys start with the domain noun: `'cases'`, `'case'`, `'drafts'`, `'inbox'`, `'points'`…
- Any write to the mock store refreshes every query automatically; do not invalidate by hand.
- Every mutation needs an **idempotency key**: `newIdempotencyKey('book-appointment')` from
  `@/lib/idempotency`. Make it **once per intent** (`useState(() => newIdempotencyKey('…'))` or a
  ref), reuse it if the person retries, and make a new one for a new intent.
- Errors are always `GatewayError`. Show `error.safeMessage`, and `error.traceRef` as "Reference
  for support". Never show anything else from an error.
- Values that only exist in the browser (the clock, storage) use `useHydrated()` from
  `@/lib/hydration`: `const greeting = useHydrated() ? greetingFor() : 'Welcome'`. Do not copy data
  into state from an effect — derive it while rendering, or key a component on the record id so it
  starts fresh (ESLint's `react-hooks/set-state-in-effect` is on).
- `getGateway()` is browser-only. Never call it while rendering; only in queries, mutations,
  effects and event handlers.

## 3. States — every data-driven region has all of them

| State           | How                                                                                                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading         | `<QueryBoundary query={q} loadingLabel="Loading your applications">`                                                                           |
| Empty           | `isEmpty` + `empty={<EmptyState title="…" actions={…}>…</EmptyState>}` — always offer a next step                                              |
| Offline         | handled by `QueryBoundary` (`OfflineState` with retry)                                                                                         |
| Error + retry   | handled by `QueryBoundary` (`ErrorState` with the safe message and trace reference)                                                            |
| Pending action  | `<Button loading={mutation.isPending}>`; never disable without saying why                                                                      |
| Action failed   | `<Notice tone="danger" role="alert" title="…">{mutation.error.safeMessage}</Notice>` beside the action                                         |
| Success         | visible confirmation (`Notice tone="success"` or the next screen) **and** `announce('…')` from `@hao/accessibility`                            |
| Action required | `Card tone="attention"` with one clear button                                                                                                  |
| Unavailable     | `<UnavailableState title reason whatNext alternatives actions>` — no dead ends: say why, what to do next, the alternatives and how to get help |

To see offline, slow and error states, use Profile → Prototype controls (it sets the simulated
network in the gateway).

## 4. Signed-in screens

```tsx
// page.tsx
export default function Page() {
  return (
    <RequireTier tier="A2" reason="see your applications">
      <ApplicationsScreen />
    </RequireTier>
  );
}
```

- `tier` defaults to A1 (any signed-in person). Personal case data, appointments and messages
  need **A2**. Submitting an identity-changing application needs **A3**, reached with
  `useSession().stepUp()` after an explicit confirmation — never silently.
- `useSession()` gives `{ session, ready, stepUp, signOut, … }`; `usePersonToken()` gives the
  signed-in person's token or `null`.
- The guards are for usability. They are not security: there is no server in the prototype.

## 5. Feature flags

`const { flags } = useFlags()` → `wallet`, `biometricVerification`, `aiGuide`,
`partnerIntegrations`. A gated screen shows `<FutureNotice />` when on, and an `UnavailableState`
that explains the gate when off. Never present a gated capability as live.

## 6. Layout recipe

```tsx
<Container>
  <PageHeader
    eyebrow="…"
    title="…"
    lede="…"
    back={{ href: '/applications/', label: 'My applications' }}
  />
  <Stack gap={6}>
    <Section title="…" id="…">
      …
    </Section>
  </Stack>
</Container>
```

- One `h1` per page — `PageHeader` renders it. Then `h2` (`Section`), then `h3`. Never skip a level.
- `Container width="narrow"` for forms and reading pages; default width for dashboards and lists.
- `Split` for a main column with an aside; `Grid min="16rem"` for card grids (one column on phones);
  `Stack` for vertical rhythm; `Cluster` for tags and button rows.
- Mobile first: design at 360 px. The bottom tab bar is fixed, so never put a fixed footer of your
  own at the bottom; a sticky primary button must sit above it.
- One dominant action per screen (`Button`/`LinkButton` primary), others `secondary` or `quiet`.

### Design system (`@hao/design-system`)

`Button` `LinkButton` `IconButton` `Spinner` · `Card` (tones `default` `sunken` `brand` `attention`
`info` `success`; `padding="flush"` for photo-topped cards; `interactive`) · `Tag` · `Notice` ·
`Avatar` (initials only) · `DescriptionList` · `Disclosure` · `Divider` · `Stack` `Cluster` `Grid`
`Container` `Split` `Eyebrow` `Lede` `Muted` `PageHeader` `Section` · `TextInput` `Textarea`
`Select` `Checkbox` `RadioGroup` `Switch` `SegmentedControl` · `LoadingState` `Skeleton`
`EmptyState` `ErrorState` `OfflineState` `UnavailableState` `SampleNotice` `FutureNotice` ·
`Timeline` `Stepper` `Dialog`.

### App components (`@/components`)

`Photo` · `PhotoCard` `IconTile` `Rows` `Row` (`cards.tsx`) · `StatusTag` · `QueryBoundary` ·
`RequireTier` `RequireRole`.

Helpers: `@/lib/format` (`formatDateTime`, `formatDate`, `formatDay`, `formatTime`,
`formatTimeInZone`, `formatRelative`, `formatSampleAmount`), `@/lib/catalogue` (`serviceHref`,
`findService`, `SAMPLE_CATALOGUE`), `@/lib/queries`, `@/lib/session`, `@/lib/prefs`,
`@/lib/idempotency`.

Use tokens (`var(--space-4)`, `var(--color-text-muted)`, `var(--radius-md)`), never raw colours or
pixel font sizes. Icons come from `lucide-react`, always with `aria-hidden="true"` beside text.

## 7. Photographs

- Only through `<Photo asset="A12" ratio="4 / 3" sizes="…" />`. Alt text and the focal point come
  from `assets/manifest.json`.
- Add `decorative` when the text next to the image already says what it shows (most cards). Leave
  it off for hero and editorial images, so the manifest's alt text is read.
- Shapes: `rounded` (default), `soft`, `arch` (portrait feature images — the "one front door"
  motif), `circle`, `square` (flush inside a card).
- Photographs are context, never information. A status, name, place, date or instruction must be
  real text rendered by the app. Never caption a generic building, vehicle or person as a real
  office, official vehicle or named individual.
- Screens and documents inside photographs are props. Never refer to them as the product's UI.
- Every one of the 60 assets has a placement (`placements` in the manifest) and must be used at
  least once; `npm run assets:check` fails otherwise. `A35` and `A52` are flagged "needs review"
  (they contain a national-flag motif): keep them cropped to the people and do not add more uses.

## 8. Words

- Plain language, sentence case, South African English. "Apply for a passport", not internal terms.
- Say what happens next. Say why a detail is needed (`Disclosure summary="Why we ask"`).
- **Never invent** fees, requirements, eligibility rules, timeframes, office names, laws or
  outcomes. Service content comes from the sample catalogue and carries `<SampleNotice />`.
- Never show an estimated completion date. Show the last update time and the next step.
- "Received" never implies "approved". A decision is always "recorded by an authorised official".
- People in the demo are a first name and initial. References on screen are masked
  (`maskReference(caseId)` → `••••2481`) outside the case's own page.
- Sample amounts are shown with `formatSampleAmount` and the words "sample amount".

## 9. Accessibility (WCAG 2.2 AA is the target)

- Every control has a visible label. Hints and errors are tied to the field (the form components do
  this). Do not use placeholder text as a label.
- Nothing is conveyed by colour alone: status has words and an icon (`StatusTag`).
- Touch targets are at least 44 × 44 px. Buttons do things; links go places.
- After an action that changes the page, call `announce('…')` and keep or move focus sensibly
  (to the new heading or the confirmation). After a failed submit, focus the first field in error.
- Dialogs use `Dialog` (native `<dialog>`, focus is trapped, Escape closes).
- Respect reduced motion: only use the provided `rise` class and CSS transitions.
- Time limits (for example a step-up that expires) are stated in words before they start.
- Test at 320 px wide and with the text-size preference set to "larger": nothing may clip,
  overlap or need horizontal scrolling.

## 10. Before you finish

```
npx tsc --noEmit -p apps/web/tsconfig.json
npx eslint apps/web/src
npx prettier --write apps/web/src
```

Do not add dependencies. Do not edit shared code (`packages/`, `services/`, `apps/web/src/lib`,
`apps/web/src/components`) from inside a feature: if something is missing, build it locally in
your route folder and say so, so it can be promoted properly.
