---
status: awaiting-human-validation
---

# Ship the Evaluation Suite and portfolio release

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

42–45

## What to build

Deliver a versioned Evaluation Suite and portfolio-ready MVP release. The suite runs representative Job Snapshots and transcripts through the Local HTTP API, enforces deterministic structure and grounding constraints, records human-labelled expectations, optionally reports model-judge signals, and produces a readable regression summary. Complete the agreed real-use validation and package the evidence needed for an interviewer to understand the product and its limitations.

## Acceptance criteria

- [x] The Evaluation Suite contains approximately five representative job descriptions and twenty answer transcripts across all four Question Categories.
- [x] Cases include irrelevant answers, unsupported claims, mixed-language answers, transcription noise, Experience Gaps, and attempts to introduce requirements absent from the JD.
- [x] Deterministic checks cover schema validity, exact citation presence, question-to-capability linkage, feedback quotation, and prohibited unsupported claims.
- [ ] Human-labelled expectations are versioned and model-judge results, if used, are reported separately rather than treated as ground truth.
- [x] Across three repeated evaluations of identical inputs, at least 90% of dimension ratings differ by no more than one level.
- [x] Every critical constraint in the Evaluation Suite passes or is documented as a known release blocker.
- [ ] The creator completes five full Practice Loops across at least two Job Snapshots and two Question Categories, including one Experience Gap and one induced failure.
- [x] The release includes an architecture diagram, evaluation summary, known limitations, and a transcript-grounded before-and-after example.
- [x] A two-to-three-minute demo can show the product's core flow without relying on undocumented setup.

## Blocked by

- [Issue 0002](./0002-generate-a-grounded-capability-map-and-question-set.md)
- [Issue 0003](./0003-add-voice-first-answer-attempts.md)
- [Issue 0005](./0005-personalize-with-optional-candidate-evidence.md)
- [Issue 0006](./0006-track-focus-points-across-practice-loops.md)
- [Issue 0007](./0007-harden-the-local-workspace-and-provider-controls.md)

See [verification and pending gates](../verification/0008.md). Automated demo ratings are not live-model acceptance evidence.

Subscription extension: independent reviewer verified60/60 live synthetic cases and79/80 stable dimensions (98.75%). AC5 is accepted; human labels and five creator loops remain pending. [Live report](../portfolio/codex-evaluation-summary.md).
