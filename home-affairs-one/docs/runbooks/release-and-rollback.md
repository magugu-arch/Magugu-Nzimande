# Release and rollback

How a change to the Home Affairs One prototype is verified, published and undone, and the product
brief's launch gates set out as a checklist. In this prototype a "release" is nothing more than a
folder of static files; the launch gates describe what a real service would need, and **none of
them has been met**.

Status: a procedure for a non-production prototype. Publishing the site anywhere needs a person's
approval first (`.claude/rules/guardrails.md`). Nothing here authorises a pilot or any use of live
data.

## What a release is here

- The output of `npm run build`: the folder `apps/web/out`, copied to a static file host.
- There is no server, database, migration, secret or account to release alongside it.
- Two build-time settings are compiled into the files: `NEXT_PUBLIC_BASE_PATH` (the sub-path the
  site is served from) and `NEXT_PUBLIC_FLAG_PROFILE` (`prototype` or `pilot`).
- All state lives in each visitor's own browser. A release cannot read or change it.

## Verifying a change

Do these in order, from the `home-affairs-one/` folder. Record the outcome of each; do not report a
step as passed unless you ran it and saw it pass.

1. `npm run verify` — typecheck, lint, format check, unit tests, asset check.
2. `npm run build` — with the base path and flag profile the release will use.
3. `npm run test:e2e` — journeys and axe checks against the export (build without a base path for
   this step; see `local-development.md`).
4. `npm run preview` — look at every screen you changed, at phone width and on a desktop.
5. Manual accessibility checks for the changed screens (`manual-accessibility-testing.md`).
6. Write the change report the project rules ask for: files changed, commands run, results, known
   gaps, and how to roll back.

### Before publishing

- [ ] A named person has approved publication.
- [ ] The concept ribbon is visible on every page, and sample content is labelled as sample.
- [ ] The built pages carry `noindex`: `grep -c noindex apps/web/out/index.html` returns 1 or more.
- [ ] The flag profile is the intended one, and gated previews are labelled.
- [ ] No real names, identity numbers, documents, logos, seals or fees have crept in.
- [ ] Photographs flagged "needs review" in `docs/design/asset-manifest.md` (currently A35 and A52)
      have been reviewed or replaced before any wider audience sees them.
- [ ] The commit that was built is written down next to the address it was published to.
- [ ] The previous published build, or its commit, is kept so it can be restored.

## Rolling back

### The code

```bash
git revert <commit>          # a new commit that undoes one change
git revert -m 1 <merge>      # the same for a merge commit
```

Revert rather than rewriting history, so the record of what happened stays intact. Then run the
verification steps again — a revert is a change like any other.

### The published site

Rebuild from the last known-good commit, with the same base path and flag profile, and copy
`apps/web/out` to the host again. If the previous export was kept, re-uploading it is quicker.
Removing the files from the host takes the prototype offline entirely; nothing else depends on it.

A faster mitigation when the problem is in a gated preview: rebuild with
`NEXT_PUBLIC_FLAG_PROFILE=pilot`, which switches the wallet, biometric verification, service guide
and partner previews off by default.

### What a redeploy does not undo

| Left behind in visitors' browsers            | Effect                                                                                      | Remedy                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Service-worker cache (`hao-shell-v1`)        | Pages are fetched fresh; other static files may be served from cache once before refreshing | Reload twice, or clear site data. Changing `VERSION` in `apps/web/public/sw.js` makes browsers drop the old cache |
| Demo data in `localStorage` (`hao.v1:` keys) | Records written by the newer code stay as they are                                          | Reset demo data. If a change altered the shape of stored records, say so in the report                            |
| Flag overrides (`hao.flags.v1`)              | A device may still show or hide a gated preview                                             | Clear the key or the site data                                                                                    |

Changing the shape of stored records, or the storage namespace, counts as a data migration: ask for
approval first.

## Launch gates — not met

The brief (§23) lists eight gates that must all be satisfied before launch. This prototype
satisfies none of them, and was never intended to.

| #   | Launch gate (brief §23)                                                                    | Status                                                                        |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| 1   | Legal authority, regulations, service rules and content approved by accountable DHA owners | **Not met**                                                                   |
| 2   | Security architecture, privacy impact, records retention and data sharing approved         | **Not met**                                                                   |
| 3   | All integrations have named system owners, sandbox evidence, SLAs and rollback plans       | **Not met**                                                                   |
| 4   | User testing demonstrates successful completion and accessible alternatives                | **Not met**                                                                   |
| 5   | Caseworker, call-centre, partner and incident teams are trained and resourced              | **Not met**                                                                   |
| 6   | No unresolved critical security or accessibility blockers                                  | **Not met** — neither has been assessed                                       |
| 7   | Status and notification content reconciled against authoritative systems                   | **Not met** — content is sample; there are no authoritative systems connected |
| 8   | A rollback, outage and customer communication plan is tested                               | **Not met** — this runbook covers a static prototype only                     |

### Release evidence the brief expects

| Test domain (brief §23) | Evidence required                                                       | What exists today                                                     |
| ----------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| User research           | Research report, usability issues, design decisions and retest          | None                                                                  |
| Functional              | Service-specific functional test suite and business acceptance          | Unit tests beside the mock services. No business acceptance           |
| Integration             | Contract and integration tests, sandbox approval, runbooks              | Typed ports and schemas. No real integration or sandbox               |
| Identity                | Independent identity assurance and security review                      | None. Sign-in is a mock                                               |
| Accessibility           | Accessibility audit and user test evidence                              | Lint rules and a manual test procedure. No audit, no recorded results |
| Security                | Security sign-off, remediation report, accepted residual risks          | A threat-model outline. No testing                                    |
| Privacy                 | POPIA impact assessment, processing inventory, vendor clauses           | Design notes only                                                     |
| AI assurance            | Evaluation set, versioned knowledge base, human review, monitoring plan | Not applicable yet: no model is connected                             |
| Resilience              | Load report, disaster-recovery exercise evidence, availability SLO      | None. Offline and error states are simulated                          |
| Operations              | Training, process maps, support model, go-live readiness sign-off       | None                                                                  |

### Approval gates before a public pilot

The brief's Appendix C adds five approval gates, each with accountable functions "to be confirmed":
(1) mandate and scope; (2) legal and privacy; (3) architecture and security; (4) operations and
inclusion; (5) procurement and controlled pilot. None has been started. The brief is explicit that
"no pilot should connect to live identity, biometric or immigration records until the Department
has approved the legal basis, technical controls, data agreements, security assessment and
accountable operational owner."

When a gate is met, record who approved it, when, and where the evidence is kept — here, and in the
decision log (`docs/architecture/decisions.md`).
