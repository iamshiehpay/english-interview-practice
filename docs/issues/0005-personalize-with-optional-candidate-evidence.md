---
status: completed
---

# Personalize with optional Candidate Evidence

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

19–23

## What to build

Allow the learner to import resume content, review extracted experience claims, and confirm selected claims as Approved Evidence. Use approved items to personalize question framing and feedback without changing the capability coverage defined by the Job Capability Map. Missing evidence creates an Experience Gap, never a disqualification.

When an answer includes an experience not present in the profile, mark it as unverified and let the learner confirm or reject it. The system must not fabricate metrics, responsibilities, or achievements.

## Acceptance criteria

- [x] The learner can import supported resume content and review extracted claims with links to source excerpts.
- [x] No extracted claim becomes Approved Evidence without explicit learner confirmation.
- [x] Approved Evidence can inform question context and feedback suggestions without suppressing other questions.
- [x] A capability without Approved Evidence is represented as an Experience Gap and remains fully practiceable.
- [x] Experience Gap answers can be coached through conceptual, hypothetical, transferable, and honest learning-plan frames.
- [x] A new claim made during practice is treated as unverified rather than false and can be confirmed or rejected by the learner.
- [x] Generated suggestions do not invent metrics, ownership, employers, or outcomes.
- [x] API-level tests cover confirmed evidence, rejected extraction, absent profiles, Experience Gaps, and unverified claims.

## Blocked by

- [Issue 0002](./0002-generate-a-grounded-capability-map-and-question-set.md)

## Verification

Independent reviewer passed all eight criteria. [Evidence](../verification/0005.md).
