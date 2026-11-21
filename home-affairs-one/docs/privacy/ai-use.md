# AI use

The position on artificial intelligence for Home Affairs One: what the product brief says AI may
and may not do, what the prototype's "service guide" really is, the guardrails a real assistant
would need, and a list of things AI must never do.

Status: the prototype contains **no AI model**. Nothing here has been through an AI assurance,
privacy or legal review. The guardrails are the brief's proposals, not controls that have been
built or tested.

## The brief's position: assist, never adjudicate

The brief (§13, "AI: assist, never silently adjudicate") says:

- "Final determinations that affect citizenship, immigration status, identity, asylum/refugee
  protection or access to legal rights must remain under legally accountable human and rules-based
  decision processes."
- "AI outputs must be labelled as assistance, grounded in approved policy content, logged and
  reviewable."
- AI may be used "only for guidance, translation assistance, completeness hints, triage and
  human-reviewed summaries".

It describes the proposed assistant (§14) as "a service guide, not an unofficial decision-maker":
it should help a person understand which service they need, what to prepare, how to get through a
form, what a status means and how to reach a person. The brief places the AI service guide in a
later release (phase 2), dependent on an "approved knowledge base + RAG".

The project rules repeat this (`CLAUDE.md`, rule 5): the guide "only finds and quotes versioned
sample guidance with a citation. No decisions, eligibility verdicts or auto-submission, ever."

## What the prototype's service guide actually is

It is **plain keyword search**. No language model, no embedding model, no external service.

| Aspect           | What happens (`services/service-catalogue/src/search.ts`)                                                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input            | The words typed. Filler words ("how", "do", "my" and so on) are dropped                                                                                                            |
| Matching         | Each remaining word is matched against the start of words in a service's title and summary, or a guidance article's title, tags and body. Very short terms must match a whole word |
| Ranking          | Title matches first, then a simple weighted count                                                                                                                                  |
| Output           | Links to services, and guidance results with a snippet quoted from the first matching paragraph                                                                                    |
| Citation         | Every guidance result carries one: the article title, the sample content version and its effective date                                                                            |
| Content searched | The bundled sample catalogue only (`sample-0.1`). The guidance describes how the proposed product behaves; it states no DHA law, fee, requirement or timeframe                     |
| Personal data    | None. The search does not read a person's cases, messages or profile                                                                                                               |
| Network          | None. Nothing typed leaves the device, and nothing is learned or retained by a model                                                                                               |
| No answer        | An empty result list. The screen should then route the person to help rather than guess                                                                                            |

The capability sits behind the `aiGuide` feature flag: on, as a labelled preview, in the
`prototype` profile and off in the `pilot` profile. The flag is named for the capability the brief
proposes; the thing behind it today is search. Screens and documents must not describe it as AI.

Because there is no model, the prototype **does not test** any of the AI guardrails below —
grounding, hallucination, prompt injection, bias or escalation. It only shows the shape of an
answer: a quotation with a citation and a version.

## Guardrails a real assistant must have

These come from the brief (§8, §13, §14, §22, §23), grouped and lightly reworded. They are
requirements to design against, to be confirmed through DHA's own assurance.

**Grounding and honesty**

- Retrieval over versioned, DHA-approved sources only; show citations and effective dates.
- State uncertainty, and route unresolved questions to a person.
- Label every output as assistance.
- Log the model version and the knowledge version for every answer; outputs are reviewable.
- Use the service catalogue's rules and show source links; do not guess eligibility.

**People stay in control**

- The person reviews every field. No automatic submission, and no acceptance of a declaration on
  anyone's behalf.
- A person can always reach a human: call-back, complaint and escalation routes stay visible.
- For critical legal translations, human review, and the option to switch to the source language.

**Data protection**

- Never train public models on submitted identity documents or live cases.
- Explain a case status only from authenticated case events, and show when it was last
  synchronised.
- Apply channel-specific safety rules: the WhatsApp flow is limited to general guidance and never
  handles documents, one-time PINs or case detail.
- Do not infer life events without a lawful source and the person's control.

**Capabilities and their guardrails (brief §14)**

| Capability                    | Guardrail the brief sets                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Conversational service search | Use catalogue rules; show source links; do not guess eligibility                       |
| Form copilot                  | The user reviews every field; no automatic submission or declaration acceptance        |
| Document checklist assistant  | Do not assert legal authenticity; refer to authorised checks                           |
| Case status explainer         | Only use authenticated case events; show the last sync time                            |
| Translation and accessibility | Human-reviewed critical legal translations; the user can switch to the source language |
| Agent copilot                 | Staff verify facts; every action is attributed to staff; monitor automation bias       |
| Fraud signal triage           | Human investigation; explainable reason codes; bias and false-positive monitoring      |

**Assurance before release (brief §23)**

- Test for grounded responses, hallucinations, prompt injection, outdated policy, harmful content
  and escalation.
- Release evidence: an evaluation set, a versioned knowledge base, human review and a monitoring
  plan.
- Content has a legal owner who approves it; the risk register's mitigation for incorrect legal
  guidance is "versioned policy content, legal owner approval, citations/effective dates, fallback
  and human escalation".
- Independent assurance, which the brief's governance model says should include algorithmic
  fairness reviews.

## Things AI must never do

The list combines the brief's explicit prohibitions with the direct consequences of its guardrails
and of this project's rules.

1. Make, record or imply a final decision on identity, citizenship, immigration status, a visa,
   asylum or refugee protection, or any legal eligibility.
2. Make a final identity match.
3. Tell a person whether they are eligible, or guess at requirements, fees or timeframes that are
   not in approved, versioned content.
4. Submit an application, accept a declaration or attest to anything on a person's behalf.
5. Say that a document is legally authentic or valid.
6. Present its output as an official notice, a decision or legal advice.
7. Answer without a citation to approved content, or hide which version it used.
8. Explain a status from anything other than authenticated case events, or invent an expected
   date.
9. Be trained, as a public model, on submitted identity documents, biometrics or live case files.
10. Receive or ask for identity documents, one-time PINs, passwords or biometrics — in the app or
    on WhatsApp.
11. Act for a staff member without that action being attributed to, and checked by, the staff
    member.
12. Flag a person as suspicious without human investigation and an explainable reason.
13. Infer a life event about a person without a lawful source and the person's control.
14. Replace the route to a human being.

## Before a model is ever connected to this codebase

Connecting any model is an external integration, so it needs explicit human approval first (see
`docs/security/secure-development.md`). At a minimum, we propose:

- [ ] An approved, versioned knowledge base with a named content owner.
- [ ] A privacy assessment of what is sent to the model and where it is processed.
- [ ] An evaluation set and pass criteria agreed before testing starts.
- [ ] Logging of model and knowledge versions, with a review process.
- [ ] A kill switch: the `aiGuide` flag off must remove the capability completely.
- [ ] Wording, tested with users, that makes it clear the guide assists and does not decide.
