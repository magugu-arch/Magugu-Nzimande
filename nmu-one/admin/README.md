# NMU ONE operator console

The web console for the teams who run NMU ONE: communications, faculties,
approvers, commerce and platform owners. Next.js 16, exported as static files.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static site in out/
npm run verify     # typecheck, lint, build, then the browser checks
```

## What it does

| Page | For |
|---|---|
| Dashboard | What needs you today, by role |
| Notifications | **Create → Approve → Schedule → Deliver → Measure** (brief §11): audience, priority, deep link, schedule, expiry, quiet hours, channels, lock-screen preview, delivery funnel |
| Emergency notice | Skips the queue; approver-only, needs a reason, flagged in the audit log |
| Approvals | One queue for notices, events and help articles |
| Audiences | Saved audiences and a builder with live reach (totals only, never people) |
| Events | Ticket uptake, new events (approved before publishing), cancellations |
| Commerce | Open/close vendors, pause order-ahead, prep times, sold-out items |
| Service directory | Every app service: owner, system, status and who can see it |
| Help content & search | Approve assistant articles; try questions as any role |
| Moderation | Reported listings: keep or remove |
| Roles & permissions | Operator roles, plus the app's own permission matrix |
| Analytics | Open rates, reach by category, ticket uptake, orders |
| Audit log | Every change: who, what, when |

## Trying it

Use **Working as** in the top bar to switch operator:

- **Ayanda Khumalo**, communications officer: writes notices for campus, community, academic and alumni.
- **Pieter van Wyk**, faculty publisher: Business & Economic Sciences audiences only.
- **Lindiwe Mthembu**, approver: approves, sends emergency notices, moderates.
- **Farah Abrahams**, commerce manager: vendors and menus.
- **Kagiso Molefe**, analyst: read-only.
- **Naledi Zulu**, platform administrator: everything, including roles.

Write a notice as Ayanda, then switch to Lindiwe to approve it. Two browser
tabs stay in sync, so you can present both sides at once.

### Live mode

Built with `npm run build:live`, the console has no operator picker and keeps
nothing in the browser. Staff sign in with NMU SSO (authorization code +
PKCE), and the BFF holds the data and runs every action as the operator it
signed in. To try it with the reference BFF:

```bash
cd .. && npm run bff          # http://127.0.0.1:8787, with a development sign-in page
cd admin && npm run build:live && npx serve out-live    # or: npm run e2e:live
```

The development sign-in page lists the six operators above.

## How it's built

- `src/lib/operators.ts`: what each operator role may do, scoped publishing and
  separation of duties.
- `src/lib/actions.ts`: every action as a plain function of the console's data:
  permission-checked, audited, no browser or React. The console runs them in
  demo mode; the BFF (`../bff/src/console.ts`) runs the same functions in live
  mode, as the signed-in operator.
- `src/lib/store.ts`: the console's state. Demo state lives in `localStorage`,
  one demo per demo day; **Reset demo** starts over. Live state comes from the
  BFF (`src/lib/live.ts`), refreshed every five seconds.
- `src/lib/seed.ts`: synthetic operators, audiences and notices. Events, vendors,
  menus and help articles come from the app's own fixtures in `../src/core`.
- `src/views/`: one client component per page; `src/app/` holds the routes.
- `src/components/charts.tsx`: small accessible charts with colours validated
  for contrast and colour-blind safety, keyboard tooltips and a table view.

Pages render after the browser loads (and, live, after sign-in), and the
console runs on the app's demo clock (`EXPO_PUBLIC_DEMO_CLOCK`).

## Checks

`npm run e2e` serves `out/` and, in Chromium:

- runs axe-core (WCAG 2.0, 2.1 and 2.2, A and AA) on all 15 pages at 1366px and 390px, and checks nothing scrolls sideways;
- drives the workflow: validation, submit, approval by another operator, delivery, metrics, return-for-changes, early send, emergency notice, audit trail, commerce, help-article approval and role scoping;
- checks the skip link, focus handling, live announcements and keyboard-reachable chart values.

`npm run e2e:live` starts the reference BFF and drives the live build: sign-in
through the development SSO page (and axe-core on it), Ayanda submitting a
notice she can't approve, signing out, Lindiwe approving it, and the audit log
crediting each step to the right person.

Screenshots go to `.e2e/`. The console's rules are also unit-tested in
`../__tests__/console.test.ts`, and the server's enforcement of them in
`../__tests__/bff.test.ts`.
