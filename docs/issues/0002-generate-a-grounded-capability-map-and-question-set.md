---
status: completed
---

# Generate a grounded Capability Map and Question Set

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

10–20, 40–44

## What to build

Expand the pasted-JD tracer bullet into a reviewable Job Capability Map and an 8–12-question Question Set. Every capability and question must preserve its relationship to exact Job Snapshot evidence, separate facts from inference, and cover the four MVP Question Categories. The learner can inspect the reasoning, accept a recommended next question, choose another question, or request additional grounded questions.

Experience Gaps remain eligible for practice. The system must support conceptual, hypothetical, transferable, and honest learning-plan framing without claiming that generated questions are actual employer questions.

## Acceptance criteria

- [x] The Job Capability Map is schema-valid and every capability cites exact text present in the Job Snapshot.
- [x] Facts and model inferences are visibly distinguishable.
- [x] The generated Question Set contains 8–12 questions spanning role fit, experience depth, behavioral judgment, and technical communication.
- [x] Every question links to at least one capability and its supporting job-description evidence.
- [x] The learner can view a recommendation, choose a different question, and request additional questions without modifying the Job Snapshot.
- [x] Duplicate and unsupported questions are detected by deterministic constraints or surfaced for review.
- [x] Experience Gaps do not suppress questions or create an automatic low score.
- [x] API-level tests cover citation validation, unsupported requirements, duplicate questions, category coverage, malformed output, and Experience Gap behavior.

## Blocked by

- [Issue 0001](./0001-complete-a-text-practice-loop-from-a-pasted-jd.md)

## Verification

Independent reviewer passed all eight criteria. [Evidence](../verification/0002.md).
