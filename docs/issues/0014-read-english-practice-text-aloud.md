---
status: awaiting-human-validation
---

# Read English practice text aloud

## Parent

[PRD — Voice practice](../prd-voice-practice.md)

## User stories covered

1–11, 49, 53

## What to build

A learner-initiated "read aloud" capability for the English text the product asks
the learner to hear: the Job-grounded Interview Question (on the question screen
and inside a Practice Record), the Follow-up Question, the Illustrative Answer,
and each Key-Sentence Correction rewrite.

The replaceable speech provider gains an optional second capability beside
`transcribe`: speaking a supplied English string at one of a small fixed set of
speeds, returning audio bytes and their media type. The configured external
implementation uses OpenAI `gpt-4o-mini-tts`, keyed from the server environment
only. The deterministic demonstration provider returns a short, obviously
synthetic tone, labelled in the interface as a demonstration that is not real
speech, so the whole path works with no key while never passing for a model.

The browser never sends free text to be spoken. It sends a **reference** to
content the server already stores — a question in a Question Set, a Follow-up
Question, a cached Illustrative Answer, or one Key-Sentence Correction rewrite —
and the server resolves the English string from its own data before calling the
provider. This keeps the product from becoming a general text-to-speech proxy and
makes "Traditional Chinese is never read aloud" enforceable on the server.

Audio is returned for immediate playback and never persisted. The control offers
play, stop, replay and a speed choice; nothing ever plays automatically; starting
a recording stops any playback. When no read-aloud service is configured the
control is hidden with a short explanation rather than offered and failing. The
provider settings panel names the read-aloud service and states that English
practice text is sent to it.

Read-aloud is deliberately kept outside the long-running operations tracker (it
is a short, learner-initiated read with no saved result and would flood the
operations strip), but concurrent read-aloud work is bounded so a held request
cannot open unbounded provider calls.

## Acceptance criteria

- [x] A learner can press a control to hear the English interview question read
      aloud, and can stop and replay it.
- [x] A speed choice with at least a slower, normal and faster option changes the
      returned audio request; the selected speed persists while the learner stays
      on the screen.
- [x] No audio ever starts without a learner action.
- [x] Read-aloud is available for the interview question, the Follow-up Question,
      the Illustrative Answer and each Key-Sentence Correction rewrite.
- [x] The English question and its Traditional Chinese meaning both remain on
      screen; no Traditional Chinese text is ever sent to the read-aloud service.
- [x] The endpoint accepts only references to stored content; free text, an
      unknown reference, and a reference to Chinese-only content are refused, and
      the provider is not called.
- [x] A provider without a speaking capability is reported as unavailable through
      the provider summary, the control is hidden with an explanation, and the
      endpoint refuses cleanly rather than throwing.
- [x] A read-aloud failure leaves the question, the Question Set and every saved
      draft unchanged and can be retried.
- [x] The demonstration provider is labelled in the interface as not real speech.
- [x] The provider settings panel names the read-aloud service and the text sent
      to it.
- [x] The API key is read only from the server environment; it appears in no
      response, log line, error message, workspace field or test artifact.
- [x] Concurrent read-aloud requests are bounded, and exceeding the bound returns
      a clear retryable error.
- [x] API-level tests cover: a stored reference reaching the provider with exactly
      the stored English text; each refusal above; unavailability reporting;
      provider failure leaving stored data unchanged.
- [x] Browser smoke covers: the control exists, does not auto-play, replays,
      stops, and the existing assertions still pass.

## Blocked by

None — can start immediately.

## Verification

Implemented and independently reviewed; two confirmed review findings fixed.
[Evidence](../verification/0014.md). Real-voice acceptance with a configured
OpenAI key is pending human validation.
