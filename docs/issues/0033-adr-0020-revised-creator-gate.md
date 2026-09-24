---
status: ready-for-agent
---

# ADR 0020: one real creator loop plus four AI persona loops, with persona loops in the ledger

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

37, 38, 39, 40, 41, 42, 43, 45

## Context

The creator-status check currently requires five loops that are all
`synthetic: false`, plus two Job Snapshots, two Question Categories, one
Experience Gap, one induced failure with recovery, `creator` and `attestedAt`.
The creator decided (2026-09-24) to lower the headcount, not the coverage. The
2026-09-23 persona walkthrough (persona 林小安, independent server, real Codex
provider, fake speech) states that it is *not* creator evidence; ADR 0020
changes that for runs 2–5. Its temporary workspace was backed up on 2026-09-24
to `.workspace/persona-qa-2026-09-23/` (gitignored; 4 snapshots, 5 records).
`docs/devops-discussion.md` already renumbers its tentative ADR to 0021.
`docs/verification/0020.md` is an unrelated issue-verification document.

## What to build

- **ADR 0020** in `docs/adr/`: the revised rule (at least one real creator
  Practice Loop plus AI persona Practice Loops, five in total); the definition of
  an AI persona Practice Loop (an AI agent drives the real local app's UI with a
  real language-model provider, not the fake one, playing a persona whose
  background is documented beforehand and never extended by invention, completing
  one full Practice Loop that leaves a real record id and links to a
  `docs/verification/` document); the four coverage rules applied across all
  five loops; why the bar is lowered; the accepted risk (persona loops exercise
  the pipeline and UI, not a real learner's comprehension, motivation or voice).
- **Creator-status check**: pass requires at least five completed loops with
  unique record ids; at least one `synthetic: false`; every `synthetic: true`
  loop has a non-empty `persona` and an `evidence` path under
  `docs/verification/`; the four coverage rules over all loops; `creator` and a
  valid `attestedAt`. Its failure messages distinguish "pending creator loop /
  attestation" from coverage failures.
- **Ledger**: add the four persona loops (walkthrough runs 2–5) with their real
  record id, snapshot id, category, completion time, input mode,
  `synthetic: true`, `persona: "林小安"`, `evidence` pointing to the walkthrough
  document; run 2 `experienceGap: true`; run 4 `inducedFailure` of the
  cancel-and-retry type with `recovered: true`. Take every value from the
  backed-up workspace records, not from the prose; leave `creator` and
  `attestedAt` null.
- **Docs**: update `MVP-ACCEPTANCE.md` and `creator-validation.zh-TW.md` to the
  new rule (the runbook now asks the creator for one real loop); append a dated
  note to the walkthrough document that ADR 0020 makes runs 2–5 count as persona
  loops, without rewriting its original text.

## Acceptance criteria

- [ ] ADR 0020 exists and states the rule, the definition, the coverage rules, the rationale and the risk.
- [ ] Tests: one real + four valid persona loops with attestation passes; five persona loops fails; a persona loop missing `persona` or `evidence` (or with evidence outside `docs/verification/`) fails; each unmet coverage rule fails; missing `creator` / `attestedAt` fails. The old "a synthetic loop fails" assertion is replaced deliberately.
- [ ] The ledger holds exactly the four persona loops, every field verified against `.workspace/persona-qa-2026-09-23/workspace.json`, and the check reports only the pending real creator loop and attestation.
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
