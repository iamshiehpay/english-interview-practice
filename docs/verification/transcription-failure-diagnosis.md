# Transcription failure: diagnosis and what changed

Date: 2026-09-21. Raised by the learner: 「可以聽到聲音，但語音轉錄失敗」, then
「我電腦有開麥克風且剛剛測試麥克風是沒問題的，請幫我找出原因」.

## What was actually wrong

Not the transcription pipeline. **Three layers were each discarding the reason a
transcription failed**, so every cause produced the same sentence and retrying was
a guess:

1. `src/cloud.js` threw before reading the provider's response body. *(Fixed in
   `06ea7ed`, before this round.)*
2. `src/server.js` replaced every `>= 500` error with one generic sentence, so even
   the reason recovered in step 1 never reached the browser.
3. `src/operations.js` stored `errorCode: 'OPERATION_FAILED'` and no message, so
   the retry banner in the page could only say 「失敗」.

Layer 3 is visible in the learner's own workspace: four failed `transcription`
operations between 07:31 and 07:45 on 2026-09-21, each 1.0–1.7 s (a real round
trip that returned something), every one recorded with no reason at all.

## The pipeline itself is proven working

Against the real service, with the key sourced from
`~/.config/interview-coach/speech.env` and never printed:

| Check | Result |
| --- | --- |
| TTS (`gpt-4o-mini-tts`) | `audio/mpeg`, 66432 bytes |
| STT of an OGG/Opus round trip | exact sentence returned |
| **STT of a genuine Chrome `audio/webm;codecs=opus` recording** | `"I would clarify the requirements before comparing the alternatives."` |

The third row is the path the browser actually uses. It was produced by recording
real speech through Chrome's own `MediaRecorder` (67675 bytes) and feeding that
file to `OpenAISpeechProvider.transcribe` — so the browser's encoder, the media
type mapping, the multipart upload and the model are all confirmed good.

An incidental finding from that harness: when the audio source is silent, Chrome
still produces a **110-byte header-only WebM**. `blob.size` is truthy, so such a
recording used to upload happily and fail opaquely. This is what a muted or
OS-denied microphone looks like from inside the page.

## What changed in this round

- **The reason survives.** `AppError` gained a `reason` field: our own wording,
  vetted never to quote a provider body. `src/server.js` returns it for `>= 500`
  too, and `src/operations.js` persists it, so the retry banner now reads
  「原因：…」 instead of just 「失敗」.
- **Provider bodies still never reach disk.** A provider can echo back anything it
  was sent, including a credential, so `providerFailure` supplies a reason naming
  only the HTTP status and pointing at the server terminal's `[provider]` line.
  `redactSecrets` in `src/domain.js` is the shared guard for anything logged,
  stored or displayed.
- **Local microphone evidence, before any audio is sent.** The recording panel now
  names the selected input device, shows a live input-level meter while recording,
  and afterwards reports length, size and the highest level observed, with local
  playback of the take. A silent recording is now visible in the page rather than
  only after a failed transcription. The meter is deliberately described as input
  strength only — it does not claim to detect speech.
- **Two defects found while integrating that work** (it was uncommitted in the
  tree): a transcribed recording still counted as "held only in this page", so the
  reload warning fired after a successful submit; and re-recording asked 「會蓋掉
  目前這段還沒送出的錄音」 about a recording that had already been submitted — a
  blocking `confirm()` that froze the page entirely and hung the smoke test.

## Automated evidence

- `npm test` — **168/168 pass** (166 before). New: a failed operation records a
  reason without ever storing the provider body or key-shaped strings (asserted
  against the workspace file on disk); a validation failure keeps its own wording.
- `npm run test:browser` — **PASS**, with new assertions for the input-level meter
  and device label during recording, local playback and the length/size/level
  summary after transcription, and that re-recording an already-transcribed take
  raises no `confirm()`.
- Banner rendering verified in Chrome against a throwaway server whose speech
  provider always returns HTTP 400 with a body containing a sentinel: the page
  showed 「原因：語音服務回報這段音訊有問題。請看終端機的 [provider] 訊息了解原因，
  或重新錄一次。」 and neither the page, `/api/operations` nor the workspace file
  contained the body or key sentinel.

## Not verified

- **The learner's specific failure is still unidentified.** Every cause now
  reports itself, but which one they hit is not known: the four recorded failures
  predate the change and carry no reason.
- No real microphone was used. `navigator.permissions.query({name:'microphone'})`
  for `http://127.0.0.1:4310` returned `prompt` in the learner's Chrome profile,
  and granting it is theirs to do. Note that `localhost:4310` and `127.0.0.1:4310`
  hold **separate** permissions.
- macOS system-level microphone access for Chrome was not readable (the TCC
  database requires Full Disk Access). A microphone that works in another
  application can still be denied to Chrome, and that yields exactly the silent
  track described above.
- Human acceptance outstanding as before: technical vocabulary, mixed
  Chinese/English, a genuine three-minute answer, denied permission, and model
  quality for feedback and summaries. **Automated tests are not human acceptance
  and this is not an MVP release claim.**
