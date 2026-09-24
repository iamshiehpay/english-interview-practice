---
status: completed
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

- [x] Label-check tests: valid AI labels pass and report mode `ai`; an AI approval without `reviewerType: "ai"` fails; human-mode tests still pass.
- [x] All 20 labels match the 0035 packet and pass the label check; drafter and approver are different agents (recorded under Comments).
- [x] AI provenance is disclosed in the label file, the README and the summary.
- [x] The offline review step reports every gate; the release status reads "AI-validated" only if the automated, semantic-review, label and creator gates all pass.

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

### 2026-09-24 — Reopened after prerequisites passed

User explicitly approved continuing 0036. Both predecessors are now completed: 0034 (`a71b902`) and 0035 (`680c9e3`). The authorized Codex run and independent 60-output semantic review passed; label drafting and implementation may proceed against its frozen packet. No additional model calls are needed. The offline label gate must compare approved ranges and required/forbidden findings with every saved repeat, preserving the live runner’s deterministic coverage. Historical blocked-state notes above are superseded by these new results.

### 2026-09-24 — Completed; honest release gate remains blocked

- Backend `prepare0035` implemented explicit AI/human/mixed label attribution, legacy schema-v1/v2 human compatibility, and a shared comparison of all sixty saved outputs against approved ranges and case-sensitive required/forbidden findings. Label mismatches remain separate from automatic constraints, with regression tests for the future runner and actual saved-run integration. No protected model source changed or new model call occurred.
- `persona0034` wrote the [rater card](../verification/0036-rater-persona.md) before drafting twenty unapproved labels. Distinct approver `review0031` inspected every case and delivered individual approval reasons. It corrected English-expression ranges on three cases to 3–4 based on grammatical/intelligible wording, independently of content relevance/support. The label artifact explicitly records both AI identities and provenance.
- Structural label validation passes 20/20 in `ai` mode. Output comparisons pass 52/60: eight saved level-2 English-expression ratings fall outside approved 3–4 ranges (`ai-experience-depth` repeats 1,3; `backend-behavioral` repeats 1–3; `embedded-technical-communication` repeats 1–3). These are preserved as quality evidence in [0041](./0041-separate-english-expression-from-content-quality.md), not hidden or repaired by broadening expectations.
- First Spec review identified stale summary text and future-run mixing of label/automatic failures. The same developer fixed both. Independent `attest0034` verified 224/224 full tests, syntax and diff checks, source provenance, and offline output; `standards0036` reported Standards PASS and `review0031` final Spec PASS. [Verification report](../verification/0036-independent-verification.md).
- Final `node evaluation/review-report.js` exits 1 as required: automatic PASS, AI bilingual semantic review PASS, AI label gate FAIL, AI persona gate PASS, release BLOCKED. This completes the requested inspection/reporting workflow; it does not assert an AI-validated release. [Summary](../portfolio/evaluation-v3-summary.md) discloses the failures, workflow-only source drift and outstanding real-user/speech/human-label validation. No push or release tag was created.
