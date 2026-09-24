# MVP Acceptance Criteria

> 2026-09-24 更新：v1.0.0 採 [ADR 0020](adr/0020-validate-v1-with-ai-persona-loops.md) 的 AI-validated 驗收門檻；真人使用與人工標註移至 v1.0.0 之後。履歷個人化、選用第二次作答與首次回饋後的英文示範依[最新試行決策](learner-flow-discussion.md)與[ADR 0017](adr/0017-use-selected-resume-and-optional-revision.md)實施。

The MVP is complete only when a learner can execute the full product loop and the evaluation gates below pass.

## Core flow

The learner can:

1. Configure a Job Search Profile or paste a job description.
2. Create an immutable Job Snapshot.
3. Generate a cited Job Capability Map.
4. Generate a reviewable Question Set containing 8–12 questions.
5. answer one question by voice or text.
6. Receive a structured Feedback Report.
7. Revise and answer the same question again.
8. Compare both Answer Attempts.
9. Save a Focus Point and local Practice Record.

## Quality gates

- All model-produced structures pass schema validation.
- Every Job Capability cites text present in the Job Snapshot.
- Every generated question links to at least one Job Capability.
- Model inferences are not presented as employer-published facts.
- Every quoted feedback excerpt exists in the evaluated transcript.
- An Experience Gap neither suppresses a question nor causes an automatic low score.
- Across three repeated evaluations of the same input, at least 90% of dimension ratings differ by no more than one level.
- All critical constraints pass across the initial twenty Evaluation Cases.
- Provider failures can be retried without corrupting an existing Practice Record.
- The learner can delete one Practice Record or all locally stored product data.

## AI persona validation for v1.0.0

Before declaring v1.0.0 AI-validated, an AI agent completes five full Practice Loops through the real local UI and real language-model provider, following a persona documented in advance. Each completed record has a unique id and a `docs/verification/` evidence link. An independent AI verifier attests the ledger using `attestedBy` and `attestedAt`; `creator` stays null. Across all five loops the ledger covers:

- At least two Question Categories.
- At least two Job Snapshots.
- At least one Experience Gap question.
- At least one deliberately induced failure followed by recovery.

The twenty Evaluation Case labels are persona-drafted and independently AI-approved, explicitly marked AI-reviewed. The release status must say **AI-validated**. These checks exercise the app and its evaluation pipeline; they do not establish real learner comprehension, motivation, voice, or real speech. The original creator mode remains available for real creator Practice Loops and human labels after v1.0.0.

## Portfolio evidence

- A two-to-three-minute demo.
- An architecture diagram.
- A published Evaluation Suite summary.
- Known limitations and failure modes.
- One transcript-grounded before-and-after answer example.
