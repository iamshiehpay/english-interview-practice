---
status: completed
---

# Complete a text Practice Loop from a pasted JD

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

1, 4, 9, 11, 14, 18, 25, 28–34, 37, 40–41

## What to build

Deliver the first complete tracer bullet through the Local Workspace. A Target Learner pastes a job description, preserves it as a Job Snapshot, receives one grounded capability and one Job-grounded Interview Question, submits a written Answer Attempt, receives a structured Feedback Report, revises the answer, compares both attempts, selects a Focus Point, and can reopen the saved Practice Record after restarting the application.

The slice must include a usable local interface, Local HTTP API, local persistence, a replaceable language-model provider contract, a deterministic fake provider, schema validation, and behavior tests through the API seam. Keep the analysis and question generation deliberately narrow; the full Job Capability Map and 8–12-question Question Set belong to issue 0002.

## Acceptance criteria

- [x] The local application can be started with documented development commands and reports its health through the Local HTTP API.
- [x] A learner can paste a job description and create an immutable Job Snapshot with source type and capture time.
- [x] A configured provider can return one cited capability and one question, and malformed provider output is rejected without corrupting the Job Snapshot.
- [x] A learner can submit a written Answer Attempt and receive four separate Feedback Report ratings with transcript evidence, one strength, and one priority improvement.
- [x] The complete reference answer remains unavailable until a second Answer Attempt is submitted.
- [x] The learner can compare both attempts, select or accept one Focus Point, and save a Practice Record.
- [x] The Job Snapshot and Practice Record survive an application restart.
- [x] API-level tests cover the complete flow using deterministic fake providers and assert observable behavior rather than prompt text or private functions.
- [x] The implementation uses the project glossary and does not introduce autonomous research, voice recording, job discovery, or Candidate Evidence behavior.

## Blocked by

None — can start immediately.

## Verification

Independent reviewer passed all nine criteria. [Evidence and limitations](../verification/0001.md).
