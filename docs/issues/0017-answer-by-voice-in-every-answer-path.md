---
status: ready-for-human
---

# Answer by voice in every path that accepts an answer

## Parent

[PRD — Voice practice](../prd-voice-practice.md)

## User stories covered

13–15, 40

## What to build

Today the recording panel is mounted only by the primary-answer editor. Extend it
to every path that accepts an Answer Attempt: the same-question revision, each
Follow-up Question, and the fresh question of a Focus Point Continuation.

Each mount targets the answer it belongs to, so a Follow-up Question recording is
transcribed against that follow-up and its Answer Recording is attached to the
follow-up's attempt — never to the primary attempt. The follow-up answer path gains
the transcript-draft handling and the recording-promotion step that the primary path
already has, including its own draft storage so a follow-up transcript survives a
reload.

The Focus Point Continuation editor is the ordinary primary-answer editor for a new
Practice Record, so it should inherit voice without special handling; the issue is
to verify that and fix whatever prevents it rather than to build a second path.

Everything from issues 0015 and 0016 applies unchanged in each path: the
three-minute cap, the elapsed time and near-limit warning, the replace/append
handoff, the retry-on-failure behaviour, local retention, and replay from history.

## Acceptance criteria

- [x] A learner can record a same-question revision, and its recording is attached
      to the second Answer Attempt.
- [x] A learner can record an answer to each Follow-up Question, and each recording
      is attached to that follow-up's attempt.
- [x] A learner can record the fresh question of a Focus Point Continuation.
- [x] A follow-up transcript is saved as a draft and survives a page reload.
- [x] A follow-up recording never lands on the primary attempt, and a primary
      recording never lands on a follow-up.
- [x] Two follow-ups on the same practice keep separate recordings.
- [x] Every recording is replayable from the Practice Record and the answer-version
      history, including follow-up answers.
- [x] Typing remains fully available in every path; voice is never mandatory.
- [x] Transcription preconditions still hold per path: a completed practice accepts
      no new recording, the two-attempt limit still applies, and a follow-up that
      already has an answer accepts no new one.
- [x] A transcription failure in any path leaves that path's saved state
      byte-identical and offers retry, re-record and type-instead.
- [x] Deleting the practice deletes primary, revision and follow-up recordings
      together.
- [x] API-level tests cover: a follow-up recording attached to the follow-up
      attempt, a revision recording attached to the second attempt, two follow-ups
      keeping separate recordings, and per-path precondition refusals.
- [x] Browser smoke covers recording a follow-up answer and replaying it, with the
      existing follow-up assertions still passing.

## Blocked by

- [Issue 0015](./0015-record-a-three-minute-answer.md)
- [Issue 0016](./0016-retain-and-replay-answer-recordings.md)

## Verification

Implemented and verified through the API and browser seams.
[Evidence](../verification/0017.md). Real-microphone acceptance across the four
answer paths is pending human validation.
