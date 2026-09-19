---
status: completed
---

# Add voice-first Answer Attempts

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

24–27, 38, 41

## What to build

Add a voice-first path to the existing Practice Loop. A learner records an answer, sends it through a replaceable speech-to-text provider, reviews the resulting transcript, and continues through the same Feedback Report and revision flow used by written answers. Raw audio is temporary and deleted after successful transcription by default.

The text-answer path remains available and both paths produce the same Answer Attempt contract. Speech provider failures must be retryable without losing the selected question or an existing Practice Record.

## Acceptance criteria

- [x] The learner can record and submit a spoken answer from the local interface.
- [x] A replaceable speech-to-text provider contract and deterministic fake are available.
- [x] The learner can inspect the exact transcript that will be evaluated.
- [x] Spoken and written answers enter the same downstream Feedback Report and revision workflow.
- [x] Raw audio is deleted after successful transcription by default and is not included in a Practice Record.
- [x] A transcription failure can be retried or replaced with text without losing the selected question or saved state.
- [x] The product does not score pronunciation, accent, emotion, or personality.
- [x] API-level tests cover successful transcription, failure and retry, temporary-audio cleanup, and transcript propagation into feedback.

## Blocked by

- [Issue 0001](./0001-complete-a-text-practice-loop-from-a-pasted-jd.md)

## Verification

Independent reviewer passed all eight criteria. [Evidence](../verification/0003.md).
