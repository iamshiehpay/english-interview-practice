---
status: ready-for-agent
---

# Retain Answer Recordings locally and replay them from a Practice Record

## Parent

[PRD — Voice practice](../prd-voice-practice.md)

## Related

Implements [ADR 0019](../adr/0019-retain-local-answer-recordings-for-playback.md),
which supersedes ADR 0013's delete-after-transcription default for submitted-answer
recordings only.

## User stories covered

37–47, 51

## What to build

Keep the audio of a submitted spoken answer in the Local Workspace, attached to
the specific answer version it belongs to, and let the learner play it back.

Recordings are stored as files beside the practice database, never as base64
inside the JSON document. The database holds only a reference: an identifier, the
media type, the byte size, the capture time, and the answer version it belongs to.

Lifecycle:

- Transcription writes the audio as a **pending** recording owned by the record it
  was made for, and returns its identifier alongside the transcript draft.
- Submitting that draft as an Answer Attempt **promotes** the pending recording to
  an Answer Recording attached to that attempt. The attempt records the input mode
  and whether the submitted transcript still matches the transcription verbatim, so
  an edited transcript can be labelled honestly without altering the audio.
- A pending recording that is superseded, discarded, abandoned, or left behind by a
  completed or deleted practice is removed. Startup sweeps pending recordings and
  any file with no database reference, replacing today's "delete every temporary
  audio file at startup" rule with "delete every file no retained reference points
  to".
- Deleting a Practice Record, deleting a Job Snapshot with its records, and deleting
  the whole workspace all delete the referenced files. Files are deleted after the
  transaction that removed the references commits, so a crash can leave an
  unreferenced file (swept at startup) but never a reference without a file.

Playback is served by a local endpoint streaming one recording by identifier with a
no-store cache policy, the correct media type, and the same local-host and origin
restrictions as the rest of the API. A missing file renders a readable "recording
unavailable" state, not a broken player.

In the interface, a Practice Record with a spoken answer shows a player beside that
answer and in the answer-version history; a typed answer and an older
transcript-only record show no player and open normally. Where the learner edited
the transcript after recording, the player is labelled so the audio is never
presented as matching the edited text. The settings panel shows roughly how much
recording audio is stored locally.

## Acceptance criteria

- [ ] Submitting a spoken answer retains its recording in the Local Workspace and
      attaches it to that specific answer version.
- [ ] The workspace JSON never contains audio bytes.
- [ ] The learner can replay a submitted answer's recording from the Practice
      Record and from the answer-version history.
- [ ] A second attempt's recording and the first attempt's recording are separate
      and neither overwrites the other.
- [ ] Editing the transcript before submitting leaves the recording bytes unchanged
      and marks the attempt as edited; the player is labelled accordingly.
- [ ] A typed answer and an older transcript-only Practice Record open normally with
      no player and no fabricated audio.
- [ ] Deleting a Practice Record deletes its recordings; deleting a Job Snapshot
      deletes the recordings of all its records; deleting all local data removes
      every recording. A repeated delete is safe.
- [ ] A pending recording that is never submitted is gone after a restart.
- [ ] A recording file with no database reference is removed at startup; a
      referenced file survives a restart and is still playable.
- [ ] No reference without a file can be observed after a completed delete.
- [ ] The playback endpoint returns the original bytes and media type, refuses
      cross-origin and non-local requests, and reports a missing recording as an
      unavailable state.
- [ ] The settings panel shows the approximate local size of retained recordings.
- [ ] Recordings are never uploaded or synced anywhere; the only outbound audio
      remains the transcription request.
- [ ] API-level tests cover every lifecycle and deletion rule above, the sweep on
      restart, and the absence of audio bytes in the workspace JSON.
- [ ] Browser smoke covers: a player appearing for a submitted spoken answer, in
      both the record and the version history, and no player for a typed answer.

## Blocked by

- [Issue 0015](./0015-record-a-three-minute-answer.md)
