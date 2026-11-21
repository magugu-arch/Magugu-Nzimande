# Tests

| Folder           | What it checks                                                                     | Runner     |
| ---------------- | ---------------------------------------------------------------------------------- | ---------- |
| `contract/`      | The brief's sample objects stay valid against the prototype contracts.             | Vitest     |
| `integration/`   | Whole journeys through the real gateway and every mock service, no UI.             | Vitest     |
| `security/`      | Guardrail scan: synthetic data only, no secrets, no network calls, no uploads.     | Vitest     |
| `e2e/`           | Every screen renders for the right person, on a phone and a desktop.               | Playwright |
| `accessibility/` | Automated WCAG checks (axe) on every screen. Manual checks are in `docs/runbooks`. | Playwright |

Unit tests live next to the code they test (`*.test.ts` in `packages/`, `services/`, `infrastructure/`
and `apps/web/src`). `npm test` runs all Vitest suites; `npm run test:e2e` needs `npm run build` first.
