# MVP Acceptance Criteria

> 2026-09-18 更新：履歷個人化、選用第二次作答、首次回饋後可看英文示範及 headspace-meditation 視覺，依[最新試行決策](learner-flow-discussion.md)與[ADR 0017](adr/0017-use-selected-resume-and-optional-revision.md)實施。下文舊版強制雙次作答、逐項經驗核准及參考時機的描述已由新決策取代；人工標註與五次真人練習仍未完成。

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

## Real-use validation

Before declaring the MVP complete, the creator completes:

- Five full Practice Loops.
- At least two Question Categories.
- At least two Job Snapshots.
- At least one Experience Gap question.
- At least one deliberately induced failure, such as an irrelevant answer or provider timeout.

## Portfolio evidence

- A two-to-three-minute demo.
- An architecture diagram.
- A published Evaluation Suite summary.
- Known limitations and failure modes.
- One transcript-grounded before-and-after answer example.
