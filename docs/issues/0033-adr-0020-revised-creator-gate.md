---
status: ready-for-agent
---

# ADR 0020: an AI-validated v1.0.0 — persona creator gate and persona loops in the ledger

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

37, 38, 39, 40, 41, 42, 43, 45

## Context

The creator-status check currently requires five loops that are all
`synthetic: false`, plus two Job Snapshots, two Question Categories, one
Experience Gap, one induced failure with recovery, `creator` and `attestedAt`.
The creator decided (2026-09-24) that v1.0.0 is an **AI-validated release**
with no creator-only gates: five AI persona loops replace the real creator loop
and the 20 labels are AI-reviewed, all honestly marked as AI (see the last
decision in `docs/next-steps-discussion.md`). Coverage is not lowered. The
2026-09-23 persona walkthrough (persona 林小安, independent server, real Codex
provider, fake speech) states that it is *not* creator evidence; ADR 0020
changes that for runs 2–5. Its temporary workspace was backed up on 2026-09-24
to `.workspace/persona-qa-2026-09-23/` (gitignored; 4 snapshots, 5 records).
`docs/devops-discussion.md` already renumbers its tentative ADR to 0021.
`docs/verification/0020.md` is an unrelated issue-verification document.

## What to build

- **ADR 0020** in `docs/adr/`: v1.0.0 is AI-validated — the creator gate is met
  by five AI persona Practice Loops attested by an AI verifier (never in the
  creator's name), the 20 labels are persona-drafted and AI-approved, and the
  release status says "AI-validated"; it amends ADR 0014's "human labels are
  primary" for v1.0.0 only and lists real creator use and human labels as
  post-v1.0.0 work. It also records the definition of
  an AI persona Practice Loop (an AI agent drives the real local app's UI with a
  real language-model provider, not the fake one, playing a persona whose
  background is documented beforehand and never extended by invention, completing
  one full Practice Loop that leaves a real record id and links to a
  `docs/verification/` document); the four coverage rules applied across all
  five loops; why the bar is lowered; the accepted risk (persona loops and AI
  labels exercise the pipeline and UI, not a real learner's comprehension,
  motivation or voice, and not real speech; nothing is human-validated).
- **Creator-status check** with a ledger `validationMode`: `"creator"` keeps
  today's rule unchanged; `"ai-persona"` requires at least five completed loops
  with unique record ids, all `synthetic: true` with non-empty `persona` and an
  `evidence` path under `docs/verification/`; the four coverage rules over all
  loops; `creator` null; non-empty `attestedBy` and a valid `attestedAt`. The
  result exposes the mode, and failure messages distinguish "pending fifth
  persona loop / attestation" from coverage failures.
- **Ledger**: set `validationMode: "ai-persona"` and add the four persona loops (walkthrough runs 2–5) with their real
  record id, snapshot id, category, completion time, input mode,
  `synthetic: true`, `persona: "林小安"`, `evidence` pointing to the walkthrough
  document; run 2 `experienceGap: true`; run 4 `inducedFailure` of the
  cancel-and-retry type with `recovered: true`. Take every value from the
  backed-up workspace records, not from the prose; leave `creator`,
  `attestedBy` and `attestedAt` null (0034 adds the fifth loop and attests).
- **Docs**: update `MVP-ACCEPTANCE.md` and `creator-validation.zh-TW.md` to the
  new rule (the runbook explains the AI-validated mode and keeps the human mode
  for after v1.0.0); append a dated
  note to the walkthrough document that ADR 0020 makes runs 2–5 count as persona
  loops, without rewriting its original text.

## Acceptance criteria

- [ ] ADR 0020 exists and states the AI-validated rule, the persona-loop definition, AI-reviewed labels, the coverage rules, the ADR 0014 amendment, the rationale, the risk and the post-v1.0.0 human work.
- [ ] Tests: `"creator"` mode behaves exactly as before (its existing tests still pass); `"ai-persona"` with five valid persona loops and AI attestation passes; a non-null `creator`, a missing `attestedBy`/`attestedAt`, a persona loop missing `persona` or `evidence` (or evidence outside `docs/verification/`), fewer than five loops, or any unmet coverage rule fails.
- [ ] The ledger holds exactly the four persona loops in `"ai-persona"` mode, every field verified against `.workspace/persona-qa-2026-09-23/workspace.json`, and the check reports only the pending fifth loop and attestation.
- [ ] `MVP-ACCEPTANCE.md`, the runbook and the walkthrough note agree with ADR 0020.
- [ ] `npm test` passes; the offline evaluation (`npm run evaluate`) still runs without model calls.

## Files likely touched

- `docs/adr/0020-*.md` (new)
- `evaluation/checks.js`, `test/evaluation.test.js`
- `evaluation/v3/creator-validation.json`
- `docs/MVP-ACCEPTANCE.md`, `docs/creator-validation.zh-TW.md`, `docs/verification/persona-walkthrough-2026-09-23.md` (append only)

## How to verify

```sh
npm test
npm run evaluate
```

## Blocked by

None — can start immediately.

## Comments
