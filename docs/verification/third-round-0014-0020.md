# Third round integration verification — issues 0014–0020

Date: 2026-09-21. Voice practice (0014–0017), Short Mock Session (0018) and
curated job discovery (0019–0020) integrated and exercised together.

## Automated evidence

- `npm test` — **160/160 pass** (108 before this round). New files:
  `read-aloud`, `recording-limits`, `recordings`, `voice-paths`, `mock-sessions`,
  `search-interpretation`, `job-curation`.
- `npm run test:browser` — **PASS**, one walk covering read-aloud (no autoplay,
  replay, speed change, no overlapping readings), a three-minute recording with a
  visible clock, the replace/append transcript handoff, retained Answer Recordings
  with playback and deletion, a full Short Mock Session, the natural-language
  search criteria flow, the no-results relaxation path, and a curated shortlist
  saved into practice — plus every pre-existing assertion.
- `npm run evaluate` — `automatedPass: true`, rating stability 80/80.
  `releaseStatus: BLOCKED` for the same four pre-existing reasons (pending
  independent bilingual semantic review, pending human labels, pending creator
  five-loop validation, no live-model quality evaluation). **This round neither
  adds nor removes a release blocker, and nothing here is an MVP release claim.**
- `npm run codex:verify` — **PASS**, re-run because adding `interpretSearch`,
  `mockSummary` and `curateJobs` to `src/codex-language.js` changed the isolation
  fingerprint. Without it the Codex provider would return 428.

## Integrated walk in a real browser

Against a real server (`WORKSPACE_DIR` scratch workspace, port 4399) in Chrome
152, not the smoke harness:

- Pasted a job description, generated a Question Set, and saw the read-aloud
  control with all three speeds.
- `POST /api/speech` returned audio that **decoded through the browser's real Web
  Audio stack**: 0.6 s, mono, `audio/wav`. This is stronger evidence than the
  smoke test, which stubs `HTMLMediaElement.play()`.
- Recorded an answer with a synthetic microphone producing a genuine WAV,
  submitted it, and confirmed the retained recording: the playback endpoint
  returned 200, `Content-Type: audio/wav`, `Cache-Control: no-store`, and the
  bytes **decoded to exactly 1 s of audio**.
- Ran a full Short Mock Session: `第 1 / 3 題` progress, no coaching controls
  present during the run, two answers, one skip, and a Session Summary with
  exactly two cards whose quotations were verified to be verbatim substrings of
  the learner's own answers. Per-question feedback count was 0 until opened.
- Walked job discovery: a Chinese request produced `AI Engineer / Taiwan / Entry`
  and **nothing for the fields not stated**; the saved profile was byte-identical
  until confirmation; the shortlist showed all four Fit Breakdown parts, the
  location tag, the retrieval time, the coach's-reading disclaimer and a link to
  the original posting.
- Final workspace state: one retained recording, and `workspace.json` contains **no
  audio bytes**.
- No console errors.

## Defects found and fixed during this round

1. **Overlapping read-aloud playback and an object-URL leak** (independent review,
   issue 0014): the replay control and the speed selector could each start a second
   reading mid-load. Fixed with one per-mount loading guard; a burst of eight rapid
   clicks is now asserted to start at most one further reading.
2. **Key-Sentence Corrections in the follow-up history had no read-aloud control**
   (independent review, issue 0014): that markup is static and was never mounted.
3. **A leftover transcript draft disabled the submit button** when reopening a
   Practice Record (issue 0015): submission is no longer gated on the
   replace-or-keep choice.
4. **An idempotent session resubmit was rejected** by the answer-in-order guard
   (issue 0018): the replay check now runs first, so a learner retrying their own
   submission after a dropped response is not told to answer in order.
5. **A just-finished session did not appear under its job** until a reload
   (issue 0018): the cached workspace is now refreshed.
6. **A raw English browser error leaked into the error banner** on a playback
   failure (found in this integration walk): replaced with a Chinese message.
7. **Stale evaluation artifacts** (pre-existing, from the 0013 provider trim) were
   regenerated in their own commit.

## Known limits — what is NOT verified

- **Real microphone and real transcription are unverified.** Every recording check
  uses a synthetic `MediaRecorder`, and the demonstration speech provider returns
  one fixed sentence regardless of the audio. Nothing here is evidence about
  transcription accuracy, technical vocabulary, mixed Chinese and English, a
  genuine three-minute answer, a declined microphone permission, or a real
  transcription failure. **All of these remain pending human acceptance**, as the
  voice discussion required.
- **Real text-to-speech is unverified.** No live `gpt-4o-mini-tts` call was made.
- **Audible playback in an `<audio>` element could not be verified in this
  browser.** This Chrome build fails to decode WAV in a media element — a control
  WAV built in-page, never touching the server, failed identically, while Web Audio
  decoded the same bytes. The failure is an environment limitation, not a product
  defect: the endpoint serves correct, decodable audio, and the interface surfaces
  a clear retryable failure rather than going silent. Real OpenAI read-aloud returns
  `audio/mpeg`, which this browser reports as `probably` playable. **Audible
  playback is pending human check.**
- **Model quality is unverified throughout.** The demonstration providers return
  fixed text for feedback, the Session Summary, search interpretation and job
  curation. The validators and the workflow are proven; whether a real model writes
  a useful summary, reads a learner's sentence correctly, or picks the right five
  jobs is not.
- **Job source coverage is narrow.** Greenhouse boards plus the demonstration
  source. 104 was investigated and is not shipped.
- **No independent review for issues 0016–0020.** The reviewer for 0016 hit an API
  session limit part-way through; 0017–0020 were never reviewed. The two areas most
  warranting an independent read are the recording data-integrity invariant with
  `RecordingStore` path safety, and outbound-data discipline in discovery.
- Phone-browser acceptance is deferred; desktop only this round.
