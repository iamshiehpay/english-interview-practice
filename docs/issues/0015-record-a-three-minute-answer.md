---
status: ready-for-human
---

# Record a three-minute answer and review the transcript before submitting

## Parent

[PRD — Voice practice](../prd-voice-practice.md)

## User stories covered

12, 16–36, 48, 50, 52, 53

## What to build

Raise the recording limit from 90 seconds to three minutes, make the recording
visible while it runs, and replace the forced "use voice / keep text" choice with
a transcript that lands in the normal answer box.

While recording, the learner sees the elapsed time and is warned as three minutes
approaches. At the limit the recorder stops itself and sends everything captured
so far to transcription — nothing recorded is discarded. Controls are start, stop
and re-record; there is no pause and resume. Starting a recording stops any
read-aloud playback.

After transcription the editable transcript goes straight into the answer box and
the learner can press the existing submit control immediately — no per-sentence
review and no confirmation tick. When the answer box already has text the learner
chooses replace or append, and the existing text is preserved either way; it is
never silently overwritten. Re-recording over an existing recording asks first.
The transcript is written to the local draft as soon as it is accepted. A mixed
Chinese and English transcript is preserved as spoken — not translated, not
polished. Nothing is submitted automatically; an unsubmitted transcript is not an
Answer Attempt.

A transcription failure keeps the recording on the page for retry, and the learner
can also re-record or switch to typing. The panel states plainly that reloading
the page can lose a not-yet-submitted recording, names the transcription service,
and says that feedback assesses the transcript's content and English expression
only — never pronunciation or accent.

The three-minute budget must be derived from one stated number that the browser
timer, the browser byte check, the documented limit and the server-side validation
all agree on, so the four cannot drift apart. The chosen byte budget must
comfortably hold three minutes of the compressed formats browsers actually produce.

## Acceptance criteria

- [x] A recording runs for at most three minutes and the elapsed time is visible
      while recording.
- [x] A warning appears as the limit approaches, and at the limit the recorder
      stops itself and transcribes everything captured so far.
- [x] Start, stop and re-record are available; pause and resume are not offered.
- [x] Starting a recording stops any read-aloud playback.
- [x] The three-minute budget, the browser byte check, the interface wording and
      the server-side limit derive from one stated constant, asserted by a test so
      they cannot drift.
- [x] The transcript appears in the normal answer box, editable, and can be
      submitted with the existing control in one click.
- [x] With text already in the answer box, replace and append are both offered and
      neither loses the existing text.
- [x] Re-recording over an existing recording asks for confirmation first.
- [x] The transcript is saved as a local draft as soon as it is accepted.
- [x] A mixed Chinese and English transcript is stored exactly as returned.
- [x] Nothing is submitted automatically; an unsubmitted transcript creates no
      Answer Attempt.
- [x] A transcription failure keeps the recording available for retry and offers
      re-record and type-instead, and leaves the Practice Record byte-identical.
- [x] A browser that cannot record, and a declined microphone permission, each
      produce a plain explanation and a working text path.
- [x] An empty or failed recording is reported and discarded cleanly.
- [x] Leaving the page with an unsaved recording or transcript warns first.
- [x] The panel names the transcription service, states that a reload can lose a
      not-yet-submitted recording, and states that feedback does not assess
      pronunciation or accent.
- [x] The stale 90-second, 6 MB and "temporary audio deleted after transcription"
      wording is gone.
- [x] API-level tests cover: the enforced size bound against the stated budget, an
      oversized upload and an unsupported media type refused with nothing written,
      and the existing `test/speech.test.js` guarantees still passing.
- [x] Browser smoke covers, with a stubbed recorder and microphone: elapsed time
      shown, near-limit warning shown, transcript reaching the answer box,
      one-click submit, replace and append both preserving text, and failure
      leaving the retry control.

## Blocked by

None — can start immediately.

## Verification

Implemented and verified through the API and browser seams.
[Evidence](../verification/0015.md). Real-microphone acceptance — technical
vocabulary, mixed Chinese and English, a genuine three-minute answer, a declined
permission, and a real transcription failure — is pending human validation.
