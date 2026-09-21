---
status: ready-for-agent
---

# PRD — Voice practice: read aloud, record, transcribe, submit, replay

Source of confirmed requirements: [`voice-practice-discussion.md`](./voice-practice-discussion.md)
(2026-09-21 decisions and the 2026-09-21 batch acceptance), [ADR 0005](./adr/0005-use-voice-first-transcript-based-practice.md),
[ADR 0013](./adr/0013-minimize-and-locally-control-practice-data.md) and
[ADR 0019](./adr/0019-retain-local-answer-recordings-for-playback.md).

Nothing in this PRD re-opens a decision the learner already made. Where the
discussion left something open (for example real-microphone acceptance), it is
listed under **Out of Scope** or **Further Notes**, not silently assumed.

## Problem Statement

A Target Learner preparing for an English interview has to *speak*, not type.
Today the Practice Loop is text-first: a voice panel exists, but it only appears
for the primary answer, it is capped at 90 seconds, the recording is destroyed
immediately after transcription, and there is no way to hear the English
question spoken or to hear back what the learner actually said.

The concrete problems:

- The learner reads a Job-grounded Interview Question on screen but never hears
  how it sounds, so a real interview is the first time they process the question
  by ear.
- Ninety seconds is shorter than a realistic interview answer, and nothing on
  screen says how long the learner has been speaking, so a good answer gets
  truncated without warning.
- Recording is available only for the primary first Answer Attempt. A same-question
  revision, a Follow-up Question, and a Focus Point Continuation are text-only,
  so the learner practises the exact thing they need least.
- The transcript flow interrupts: after transcription the learner is forced to
  choose between "use the voice transcript" and "keep the text draft" before they
  can do anything, even when the text box was empty.
- The audio is deleted after transcription, so the learner can never hear their
  own answer again, cannot compare their first and second attempt by ear, and
  cannot tell whether a strange transcript came from their speaking or from the
  transcription service.
- A transcription failure loses the recording, so the only recovery is to speak
  the whole answer again.
- Nothing on screen says which service hears the audio, and the learner cannot
  tell whether a rating reflects what they said or how they said it.

## Solution

Make speaking the natural way to practise, end to end, and let the learner hear
both sides of the conversation.

**Hear the question.** Every English text the product asks the learner to
*produce or consume as English* — the Job-grounded Interview Question, the
Follow-up Question, the Illustrative Answer, and each Key-Sentence Correction
rewrite — gets a learner-initiated "read aloud" control with play, stop, replay
and a speed choice. Nothing ever plays automatically. Traditional Chinese
explanations are never read aloud. Starting a recording stops any playback so
the speech is not recorded back into the answer.

**Speak the answer, anywhere an answer is accepted.** The recording panel is
available for the primary first answer, the same-question revision, each
Follow-up Question, and the fresh question of a Focus Point Continuation. Text
input remains fully available everywhere; voice never becomes mandatory.

**Three minutes, visibly.** A recording runs for at most three minutes. The
elapsed time is shown while recording, the learner is warned as the limit
approaches, and at the limit the recording stops itself and goes to
transcription with everything captured so far — nothing recorded is thrown away.

**Review the transcript, then submit.** After transcription the editable
transcript appears in the answer box and the learner can press the normal submit
button immediately. No per-sentence check and no extra confirmation tick. When
the answer box already has text, the learner chooses to replace it or to append —
it is never silently overwritten. Re-recording over an existing recording asks
first. The transcript is saved as a local draft as soon as it arrives. Mixed
Chinese and English is preserved as spoken: the transcript is not translated or
polished on the learner's behalf. Nothing is submitted automatically; an
unsubmitted transcript is not an Answer Attempt.

**Keep the recording, locally.** When a spoken answer is submitted, its audio is
retained in the Local Workspace and attached to that specific answer version, so
the learner can replay it from the Practice Record and from the answer-version
history. Editing the transcript never changes or re-labels the recording.
Deleting the practice, the job, or the whole workspace deletes the recordings
with it. Recordings that were never submitted stay temporary and are cleaned up.

**Fail without losing the recording.** If transcription fails, the recording
stays on the page for a retry; the learner can also re-record or switch to
typing. The page says plainly that a browser reload can lose a not-yet-submitted
recording.

**Say what leaves the machine.** The interface names the service that receives
the audio for transcription and the text for reading aloud. The API key is read
only from the server environment; it never reaches the browser, the workspace,
test artifacts, Git, or logs. Feedback continues to assess the transcript's
content and English expression only — never pronunciation, accent, fluency,
emotion or personality.

## User Stories

### Hearing the question

1. As a Target Learner, I want to press a button to hear the English interview
   question read aloud, so that I practise processing it by ear.
2. As a Target Learner, I do not want any audio to start on its own, so that
   opening a practice screen in a quiet room is safe.
3. As a Target Learner, I want to replay the question as many times as I like,
   so that I can listen again before answering.
4. As a Target Learner, I want to stop the reading at any moment, so that I keep
   control of my speakers.
5. As a Target Learner, I want to choose a slower or faster reading speed, so
   that I can follow a fast interviewer or check a word.
6. As a Target Learner, I want the English question and the Traditional Chinese
   meaning both kept on screen, so that reading aloud adds to the screen rather
   than replacing it.
7. As a Target Learner, I want only English text read aloud, so that the Chinese
   coaching notes are not spoken at me.
8. As a Target Learner, I want the Follow-up Question, the Illustrative Answer
   and each Key-Sentence Correction rewrite to be readable aloud too, so that I
   can hear the English I am being shown.
9. As a Target Learner, I want reading aloud to stop the moment I start
   recording, so that the question is not captured inside my own answer.
10. As a Target Learner, I want to be told when reading aloud is unavailable
    (no service configured), so that a missing button is explained rather than
    mysterious.
11. As a Target Learner, I want a failed read-aloud to leave the question and my
    draft untouched and let me try again, so that a service hiccup costs me
    nothing.

### Recording an answer

12. As a Target Learner, I want to record a spoken answer to the main question,
    so that I practise the way the interview actually happens.
13. As a Target Learner, I want to record my same-question revision, so that my
    second attempt is practised out loud as well.
14. As a Target Learner, I want to record my answer to each Follow-up Question,
    so that the follow-up exchange is spoken like a real interview.
15. As a Target Learner, I want to record the fresh question of a Focus Point
    Continuation, so that deliberate focus practice is also spoken.
16. As a Target Learner, I want to keep typing instead whenever I prefer, so that
    voice never blocks me.
17. As a Target Learner, I want start, stop and re-record controls, so that the
    recording model is simple; I do not need pause and resume in this version.
18. As a Target Learner, I want to see the elapsed recording time, so that I can
    pace a realistic answer.
19. As a Target Learner, I want a warning as I approach three minutes, so that I
    can land my answer rather than be cut off mid-sentence.
20. As a Target Learner, I want the recording to stop by itself at three minutes
    and transcribe everything captured so far, so that hitting the limit never
    discards what I already said.
21. As a Target Learner, I want to be told clearly if my browser cannot record,
    so that I switch to typing instead of retrying.
22. As a Target Learner who declines the microphone permission, I want a plain
    explanation and a working text path, so that I am not stuck.
23. As a Target Learner, I want an accidental empty or failed recording to be
    reported and discarded cleanly, so that nothing half-broken is submitted.

### From transcript to submitted answer

24. As a Target Learner, I want the transcript to appear in the normal answer box
    where I can edit it, so that there is one place my answer lives.
25. As a Target Learner, I want to submit straight after transcription without an
    extra confirmation step, so that a good transcript costs me one click.
26. As a Target Learner, I want to fix a wrong word or re-record when the
    transcript is wrong, so that accuracy stays in my hands.
27. As a Target Learner with text already written, I want to choose to replace it
    or add the transcript to the end, so that my typing is never silently lost.
28. As a Target Learner, I want to be asked before a new recording overwrites the
    recording I already have, so that re-recording is deliberate.
29. As a Target Learner, I want my transcript saved as a local draft as soon as
    it arrives, so that a browser crash does not cost me the answer text.
30. As a Target Learner speaking a mix of Chinese and English, I want the
    transcript to keep what I actually said, so that the coach reacts to my real
    answer rather than a cleaned-up one.
31. As a Target Learner, I do not want anything submitted automatically, so that
    an unsubmitted transcript never becomes a graded Answer Attempt.
32. As a Target Learner, I want a leaving-the-page warning while a recording or
    transcript is unsaved, so that I do not lose it by accident.

### Failure and recovery

33. As a Target Learner whose transcription failed, I want my recording kept on
    the page so I can retry, so that I do not have to say it all again.
34. As a Target Learner, I want to abandon a failed recording and type instead,
    so that I am never trapped in a retry loop.
35. As a Target Learner, I want to be told that reloading the page can lose a
    not-yet-submitted recording, so that the limits of temporary storage are
    honest.
36. As a Target Learner, I want a transcription failure to leave my selected
    question, my Practice Record and my saved drafts untouched, so that failure
    costs only the retry.

### Replaying my own answers

37. As a Target Learner, I want the recording of a submitted spoken answer kept
    on this machine, so that I can hear myself again later.
38. As a Target Learner, I want each recording attached to the specific answer
    version it belongs to, so that my first and revised attempts do not get mixed
    up.
39. As a Target Learner, I want to replay a recording from the Practice Record
    and from the answer-version history, so that I can compare how I said it with
    what the Feedback Report says.
40. As a Target Learner, I want to replay my Follow-up Question answers too, so
    that the whole exchange is reviewable.
41. As a Target Learner who edits a transcript after recording, I want the
    recording left exactly as it was and labelled honestly, so that the audio is
    never presented as matching edited text.
42. As a Target Learner, I want a Practice Record with no audio (a typed answer,
    or an older record) to open normally without a broken player, so that history
    stays readable.
43. As a Target Learner deleting one practice, I want its recordings deleted with
    it, so that deletion means deletion.
44. As a Target Learner deleting a job, I want the recordings of all its practices
    deleted too, so that nothing is orphaned.
45. As a Target Learner deleting all local data, I want every recording removed,
    so that the workspace deletion promise still holds.
46. As a Target Learner, I want recordings I never submitted to be cleaned up
    rather than accumulate, so that temporary audio does not pile up on disk.
47. As a Target Learner, I want to see roughly how much recording audio is stored
    locally, so that local retention is visible rather than hidden.

### Disclosure, privacy and scope of assessment

48. As a Target Learner, I want the screen to name the service that receives my
    audio before I record, so that I consent knowingly.
49. As a Target Learner, I want the screen to name the service that receives the
    text for reading aloud, so that outbound text is disclosed too.
50. As a Target Learner, I want my API key kept in the server environment only,
    so that it never appears in the browser, my workspace, test output, Git or
    logs.
51. As a Target Learner, I want my retained recordings kept on this machine and
    not uploaded anywhere for storage, so that local means local.
52. As a Target Learner, I want the Feedback Report to judge what I said and how I
    expressed it in English, and to say so, so that I am not silently scored on my
    accent.
53. As a Target Learner, I want to know that the demonstration provider does not
    really transcribe or really speak, so that I do not mistake a demo for a
    model.

## Implementation Decisions

### Domain language

`CONTEXT.md` already defines **Practice Record** as retaining "an associated
local recording for spoken answers when available". This PRD adds one term:

- **Answer Recording（回答錄音）** — the retained local audio of one submitted
  spoken Answer Attempt, associated with that specific answer version and deleted
  with its owning practice data. It is evidence of what the learner said, not a
  scored artifact; a later transcript edit does not change it.

Everything else uses existing vocabulary (Answer Attempt, Practice Record,
Follow-up Question, Focus Point Continuation, Illustrative Answer,
Key-Sentence Correction, Local Workspace).

### Speech provider contract

The existing replaceable speech provider gains a second capability beside
`transcribe`. A provider advertises what it supports; the application never
assumes both.

- `transcribe({audioPath, mimeType, signal}) -> {transcript}` — unchanged.
- `speak({text, speed, signal}) -> {audio: Buffer, mimeType}` — new, optional.
  `speed` is one of a small fixed set of multipliers. A provider without `speak`
  reports read-aloud as unavailable and the interface hides the control with an
  explanation.

The configured external implementation uses OpenAI `gpt-4o-mini-transcribe` for
transcription and `gpt-4o-mini-tts` for reading aloud, both keyed from the
server environment only. The deterministic demonstration provider keeps its
fixed sample transcript and returns a short, obviously synthetic tone for
`speak`, labelled in the interface as a demonstration that is not real speech —
so the whole path is exercisable without a key while never passing for a model.

### Reading aloud is reference-addressed, never free text

The read-aloud endpoint does not accept arbitrary text from the browser. The
browser sends a *reference* to stored content — a question in a Question Set, a
Follow-up Question, a cached Illustrative Answer, or a specific Key-Sentence
Correction rewrite — and the server resolves the English text from its own
stored data before calling the provider. This keeps the product from becoming a
general text-to-speech proxy, guarantees that only the intended English strings
are sent outbound, and makes the "no Chinese read aloud" rule enforceable on the
server rather than trusted to the client.

Read-aloud returns the audio to the browser for immediate playback and is not
persisted. It is disclosed in the provider panel as outbound text. It is
deliberately kept outside the long-running operations tracker: it is a short,
idempotent, learner-initiated read with no saved result, and surfacing it as a
tracked operation would flood the operations strip. Concurrency is bounded
separately so a held key cannot open unbounded provider calls.

### Recording limits

The three-minute cap is enforced in three places that must agree, not just in
the browser timer:

- the browser stops the recorder at the limit and transcribes what it has;
- the browser refuses an upload above the byte limit with a clear message;
- the server keeps its existing base64 size validation and request-body cap as
  the authoritative bound.

The chosen byte budget must comfortably hold three minutes of the compressed
formats browsers actually produce (Opus in WebM/Ogg, AAC in MP4), and the
documented limit, the browser check and the server check must be derived from
one stated number rather than three independent constants.

### Retaining Answer Recordings

Recordings are stored as files in the Local Workspace beside the practice
database, never as base64 inside the JSON document (which is rewritten on every
transaction). The database stores only a reference: an identifier, the media
type, the byte size, the capture time, and the answer version it belongs to.

Lifecycle:

- Transcription writes the audio as a **pending** recording owned by the record
  it was made for, and returns its identifier with the transcript draft.
- Submitting that draft as an Answer Attempt **promotes** the pending recording
  to an Answer Recording attached to that attempt. The attempt records the input
  mode (voice) and whether the submitted transcript still matches the
  transcription verbatim, so an edited transcript can be labelled honestly
  without altering the audio.
- A pending recording that is superseded, discarded, abandoned, or left behind by
  a completed or deleted practice is removed. Startup sweeps pending recordings
  and any file with no database reference, so an interrupted process cannot leak
  audio. This replaces the current "delete every temporary audio file at startup"
  rule with "delete every file that no retained reference points to", which is
  what ADR 0019 requires.
- Deleting a Practice Record, deleting a Job Snapshot (and its records), and
  deleting the whole workspace all delete the referenced files. Deletion of files
  happens after the database transaction that removed the references commits, so
  a crash can leave an unreferenced file (swept at startup) but never a reference
  without a file.

Playback is served by a local endpoint that streams one recording by identifier
with a no-store cache policy, the correct media type, and the same local-host and
origin restrictions as the rest of the API. A missing file is reported as a
readable "recording unavailable" state rather than a broken player.

The transcription endpoint's existing preconditions are unchanged: it still
refuses to produce a draft for a completed practice or beyond the two-attempt
limit, and a failure still leaves the Practice Record byte-identical.

### Voice everywhere an answer is accepted

The recording panel is mounted by the answer editor rather than only by the
primary-answer editor, and the same mount is reused by the revision editor, the
Follow-up Question answer box, and the Focus Point Continuation editor. Each
mount targets the answer it belongs to, so a follow-up recording is attached to
the follow-up's attempt, not to the primary attempt. The follow-up answer path
gains the transcript-draft and recording-promotion handling the primary path
already has.

### Transcript handoff

The current forced "use voice / keep text" modal is replaced by:

- empty answer box → the transcript is placed in the box directly;
- non-empty answer box → the learner picks replace or append, with the existing
  text preserved either way;
- the transcript is written to the local draft as soon as it is accepted;
- the submit control is only disabled while a transcription is actually in
  flight, not while the learner is reading the result.

Transcript editing does not invalidate the recording; it only changes the
`transcriptEdited` flag shown beside the player.

### Disclosure

The provider panel and the recording panel name the transcription service and
the read-aloud service and state what is sent. The provider summary endpoint
reports read-aloud availability so the interface can hide the control rather than
offering a button that always fails. Keys are read from the server environment
at construction and held privately; no endpoint, log line, error message,
workspace field, or test fixture may contain one.

## Testing Decisions

Good tests here assert behaviour a Target Learner can observe: what the API
returns, what is stored, what is deleted, and what the page shows. They do not
assert internal call shapes. Two existing seams are used; no new seam is added.

### HTTP API seam (`test/*.test.js`, prior art `test/speech.test.js`)

The application is started in a temporary workspace with a stub speech provider,
exactly as `test/speech.test.js` already does. Cover:

- **Read aloud**: a reference to a stored question returns audio of the declared
  media type; the provider receives the stored English text and nothing else; a
  reference to Chinese-only content or to content that does not exist is
  rejected; a provider without `speak` makes the capability report unavailable
  and the endpoint refuse cleanly; a provider failure returns a retryable error
  and changes no stored data.
- **Recording retention**: transcribing writes exactly one pending recording;
  submitting the draft promotes it and the attempt gains a recording reference;
  the playback endpoint returns the original bytes with the original media type;
  the workspace JSON never contains the audio bytes.
- **Edited transcript**: submitting a transcript that differs from the
  transcription keeps the recording bytes unchanged and marks the attempt as
  edited.
- **Deletion**: deleting the record, deleting the snapshot, and deleting the
  whole workspace each leave no recording files behind and no dangling
  references; a second delete is safe.
- **Sweeping**: a pending recording that is never submitted is gone after a
  restart; a file with no reference is removed at startup; a referenced file
  survives a restart and is still playable.
- **Follow-ups and revisions**: a follow-up answer and a second attempt each get
  their own recording, and neither overwrites the other's.
- **Size and format**: an oversized upload and an unsupported media type are
  refused with no file written; the documented three-minute budget is asserted
  against the enforced limit so the two cannot drift.
- **Unchanged guarantees**: the existing `test/speech.test.js` assertions
  (transcript review before attempt, failure retry, text fallback, no pronunciation
  scoring) must keep passing; where retention changes an assertion about temporary
  audio, the replacement asserts the ADR 0019 rule rather than deleting the check.

### Browser DOM seam (`test/browser-smoke.js`)

The smoke test drives the real page with a stubbed `MediaRecorder`,
`navigator.mediaDevices.getUserMedia` and `HTMLMediaElement.play`, so recording
and playback are exercised without a physical microphone or speaker. Cover:

- read-aloud control present, not auto-playing, replayable, stoppable, and
  stopped by starting a recording;
- elapsed time appears while recording and the near-limit warning appears;
- the transcript lands in the answer box and can be submitted in one click;
- replace and append are both offered when text already exists, and neither
  loses the existing text;
- a transcription failure keeps the retry control and the recording;
- a submitted spoken answer shows a player in the Practice Record and in the
  answer-version history, and a typed answer shows none;
- the existing assertions (no horizontal overflow at phone width, single
  completion control, feedback focus, corrections paths) continue to pass.

### Not automated

Real-microphone acceptance — technical vocabulary, mixed Chinese and English, a
genuine three-minute answer, a declined microphone permission, and a real
transcription failure — is human verification with a real device and a configured
provider. A synthetic-microphone smoke test is explicitly *not* evidence of
transcription quality, and the verification document must say so.

## Out of Scope

- Real-time two-way conversational interviewing (the confirmed flow is
  record → stop → review → submit).
- Pronunciation, accent, fluency, prosody, emotion or personality scoring, and
  any audio-derived rating. Audio-based assessment is a separate future feature.
- Pause and resume during a recording; voice or accent selection menus.
- Phone-browser acceptance (desktop browser first; phone is a later round).
- Reading Traditional Chinese explanations aloud.
- Uploading or syncing recordings anywhere off this machine; any cloud storage of
  audio.
- Speaker diarisation, timestamps, word-level alignment, or transcript
  re-alignment after editing.
- Changing the Feedback Report contract, the four assessment dimensions, the
  Question Set contract, or the two-attempt limit.
- Re-transcribing older transcript-only Practice Records or fabricating audio for
  them.

## Further Notes

- ADR 0019 supersedes ADR 0013's delete-after-transcription default *only* for
  submitted-answer recordings. Every other data-minimization and disclosure rule
  in ADR 0013 still applies, and temporary or discarded audio must still be
  cleaned up promptly.
- The existing browser voice panel hard-codes the 90-second wording, the 6 MB
  message, and the "temporary audio is deleted after transcription" sentence.
  All three become wrong under this PRD and must be rewritten rather than left
  as stale reassurance.
- The demonstration speech provider returns a fixed sentence regardless of audio.
  Browser verification that uses it proves the workflow, never the transcription.
- `.env.example`, `README.md` and the provider settings panel must document the
  read-aloud model and reaffirm that the key is server-environment only.
