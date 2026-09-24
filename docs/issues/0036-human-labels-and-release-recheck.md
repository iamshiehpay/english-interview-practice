---
status: ready-for-human
---

# Twenty human labels on the v3 Codex packet, offline release recheck and summary update

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

46, 47, 48, 51

## Context

Labels must match the review packet produced by the v3 Codex run in 0035
(`caseId` and `inputChecksum` unchanged). Per ADR 0014, human labels are
primary; AI may draft but only the creator approves. The label check requires,
per case: `status: "approved"`, reviewer, reviewedAt, rationale, a 1–4 range for
each of the four dimensions, evidence quotes that occur verbatim in the
transcript, required and forbidden findings, and
`bilingualSemanticConsistency: "approved"` only after the creator has compared
the English / Chinese pairs. About one hour of creator time.

## What to build

- An AI subagent drafts all 20 labels from each packet item's template: ranges,
  rationale, verbatim evidence quotes, required / forbidden findings and
  bilingual-consistency notes, all with `status` left unapproved.
- The creator reviews, edits and approves each case individually; only then are
  `status`, `reviewer`, `reviewedAt` and `bilingualSemanticConsistency` set.
- The label file (or `evaluation/README.md`) records that drafts were
  AI-assisted and that the creator is the reviewer.
- Run the offline review step (no model calls) and update
  `docs/portfolio/evaluation-v3-summary.md` with the gate results: human labels,
  semantic review, creator gate (0034) and the resulting release status.

## Acceptance criteria

- [ ] All 20 labels match the 0035 packet and pass the label check.
- [ ] Every approval was given by the creator case by case (recorded under Comments with the date); no case was bulk-approved.
- [ ] AI-assisted drafting is disclosed.
- [ ] The offline review step reports the human-label gate as PASS.
- [ ] The evaluation summary states each gate's status; the release status reads PASS only if every gate, including the creator gate, passes.

## Files likely touched

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
- [Issue 0034](./0034-creator-real-practice-loop.md) — only for the final release-status line; labelling can start once 0035 is done.

## Comments
