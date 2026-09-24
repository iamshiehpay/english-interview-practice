---
status: needs-info
---

# Twenty AI-reviewed labels on the v3 Codex packet, offline release recheck and summary update

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

46, 47, 48, 51

## Context

Labels must match the review packet produced by the v3 Codex run in 0035
(`caseId` and `inputChecksum` unchanged). Under ADR 0020 the v1.0.0 labels are
persona-drafted and AI-approved and must be marked as such; they must never be
presented as human labels. The label check today requires, per case:
`status: "approved"`, reviewer, reviewedAt, rationale, a 1–4 range for each of
the four dimensions, evidence quotes that occur verbatim in the transcript,
required and forbidden findings, and `bilingualSemanticConsistency: "approved"`.

## What to build

- **Label check**: add `reviewerType` per label (`"human"` or `"ai"`); accept
  AI approvals only when marked `"ai"`; report the label mode (human / ai /
  mixed) so the summary can say "AI-reviewed labels". Human-mode behaviour is
  unchanged. Cover with tests.
- **Drafting**: a rater-persona agent (e.g. an experienced Taiwan tech
  interviewer, card written first) drafts all 20 labels from each packet item's
  template with `status` left unapproved.
- **Approval**: an independent reviewer agent (not the drafter) checks each case
  individually — quotes verbatim, ranges justified by the transcript, findings
  consistent with the rubric, English / Chinese pairs consistent — edits or
  rejects as needed, and only then sets `status`, `reviewer` (agent / model
  identity), `reviewedAt`, `reviewerType: "ai"` and
  `bilingualSemanticConsistency`.
- Document the AI provenance in the label file and `evaluation/README.md`.
- Run the offline review step (no model calls) and update
  `docs/portfolio/evaluation-v3-summary.md`: each gate's status and mode, the
  release status as "AI-validated" (never "human-validated"), and the
  post-v1.0.0 human validation still to do.

## Acceptance criteria

- [ ] Label-check tests: valid AI labels pass and report mode `ai`; an AI approval without `reviewerType: "ai"` fails; human-mode tests still pass.
- [ ] All 20 labels match the 0035 packet and pass the label check; drafter and approver are different agents (recorded under Comments).
- [ ] AI provenance is disclosed in the label file, the README and the summary.
- [ ] The offline review step reports every gate; the release status reads "AI-validated" only if the automated, semantic-review, label and creator gates all pass.

## Files likely touched

- `evaluation/checks.js`, `evaluation/review-report.js`, `test/evaluation.test.js`
- `evaluation/v3/human-labels.json`
- `evaluation/README.md`
- `docs/portfolio/evaluation-v3-summary.md`

## How to verify

```sh
npm test
node evaluation/review-report.js
```

## Blocked by

- [Issue 0035](./0035-codex-evaluation-and-semantic-review.md)
- [Issue 0034](./0034-fifth-persona-loop-and-ai-attestation.md) — only for the final release-status line; labelling can start once 0035 is done.

## Comments

### 2026-09-24 — Blocked prerequisites; no labels drafted or approved

- Required predecessor [0035](./0035-codex-evaluation-and-semantic-review.md) is `needs-info`: its only authorized run failed the Codex binary trust check before inference, leaving no frozen analysis and zero packet outputs. There are no valid generated-question checksums on which to base the twenty labels. No rater persona was started, no label implementation/drafting/approval was performed, and no approval was attributed to a human or AI reviewer.
- The handoff requires listed blockers completed before work starts. [0034](./0034-fifth-persona-loop-and-ai-attestation.md) also remains `needs-info` because of 0033's historical provenance gap, so the final creator gate is unavailable.
- Current live-run gates: automated **FAIL** (0/60 outputs, stability 0/0); semantic review **NOT RUN** (no outputs); labels **NOT RUN** (no qualifying packet); creator/AI-persona **PENDING** (four loops, fifth and independent attestation absent). Release status is **BLOCKED**, not AI-validated and never human-validated.
- `node evaluation/review-report.js` was independently checked in 0035 and exits 1 on missing frozen analysis; no model calls occur. Resume only after 0035 has a valid, independently reviewed packet and the required dependency status is resolved. No automatic second evaluation is authorized.
- This is a dependency disposition, not a claim of completed labelling or failed label tests. All acceptance criteria remain unchecked. Post-v1 real creator use, real speech/comprehension validation and human labelling remain outstanding under ADR 0020.
