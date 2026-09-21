---
status: ready-for-human
---

# Run a three-question Short Mock Session

## Parent

[PRD — Three-question short mock session](../prd-short-mock-session.md)

## User stories covered

1–45

## What to build

A **Short Mock Session**: three Job-grounded Interview Questions from one Job
Snapshot, answered in a row with no feedback or coaching in between, assessed once
at the end.

A session is stored as its own collection alongside Practice Records — not as three
Practice Records — so the Practice Loop's invariants (feedback after every attempt,
completion requires a Focus Point, two-attempt limit, optional follow-ups) stay
correct for the Practice Loop and are not weakened for everyone. A session stores the
Job Snapshot it belongs to, the three question payloads copied at creation, one entry
per question holding either a transcript or a skip marker plus an optional Answer
Recording reference and optional Feedback Report, the status, the Session Summary and
timestamps.

Three questions are drawn from the snapshot's existing Question Set, one each from
three different Question Categories, preferring questions not yet practised in a
Practice Record or an earlier session and falling back to the least-practised one. No
model call is made to build a session. A snapshot whose Question Set does not span
three categories is refused with an actionable message rather than repeating a
category.

While a session runs, the learner answers by speaking or typing under the same
three-minute recording cap, submits and moves straight to the next question, and can
skip a question. There is no Feedback Report between questions, no Illustrative
Answer, no hint, no gap-framing and no English Assistance — requests against an
in-progress session's answers are refused, and the interface does not offer the
controls. A submitted session answer is immutable for that session and submission is
idempotent under a submission identifier; the current question is the first entry with
neither an answer nor a skip. Progress is saved as the session runs; the learner can
leave and resume at the next unanswered question, and an in-progress session is never
shown, counted or summarised as completed. Abandoning a session is deliberate and
warns that its answers go with it.

When the third entry is answered or skipped the session completes and a **Session
Summary** is produced: exactly one overall strength and one overall priority
improvement for the whole session, each with English text, a faithful Traditional
Chinese counterpart, and a quotation that must be a verbatim substring of one of the
learner's own session answers. The summary contract receives only the session's
questions and answers — no Feedback Reports, no resume, no coaching, no ratings — and
is validated for shape, bilingual presence and citation exactly as the feedback
validator is. A session where every question was skipped makes no model call and shows
an honest "nothing to assess" state. The summary runs through the long-running
operations tracker so it is cancellable, retryable and idempotent.

Per-question Feedback Reports use the existing feedback contract and validator
unchanged, are generated only when the learner opens that question, and are cached on
the session entry. A skipped question is never sent for feedback. After a session
completes, English Assistance and Key-Sentence Corrections apply to its answers
through the existing validated contracts.

Sessions appear in Records under their job, visually distinct from Practice Records,
with in-progress sessions offering "continue" and completed ones offering "view
summary". Deleting the job or the workspace removes sessions and their recordings.

`CONTEXT.md` gains the two terms **Short Mock Session（三題短場模擬）** and
**Session Summary（整場回饋）** as defined in the PRD.

## Acceptance criteria

- [x] A learner can start a session from a saved job whose Question Set exists, and
      is told up front it is three questions with feedback at the end.
- [x] The three questions come from three different Question Categories, prefer
      unpractised questions, and are copied into the session at creation.
- [x] A job with no Question Set, and a Question Set spanning fewer than three
      categories, are both refused with an actionable message.
- [x] A second unfinished session on the same job is refused.
- [x] The session records the resume version frozen on the Job Snapshot.
- [x] Progress through the three questions is shown, each question in English with
      its Traditional Chinese meaning.
- [x] The learner can answer by speaking or typing under the same three-minute
      recording cap, and can replay a session answer's recording.
- [x] No Feedback Report is shown between questions.
- [x] The learner can skip a question; a skipped question is recorded as skipped and
      never receives a fabricated assessment.
- [x] Illustrative Answer, hint, gap-framing, English Assistance and Key-Sentence
      Corrections are unavailable during a session, refused by the API, and the
      interface says they are available afterwards.
- [x] A submitted session answer cannot be replaced; a repeated submission with the
      same submission identifier is idempotent; answering out of order is refused.
- [x] Progress is saved as the session runs; the learner resumes at the next
      unanswered question after a reload.
- [x] An in-progress session is labelled in progress everywhere and is excluded from
      any count of completed practice.
- [x] Abandoning a session warns first and removes its answers and recordings.
- [x] Completing the session yields exactly one overall strength and one overall
      priority improvement, each quoting one of the learner's own session answers
      verbatim, in Traditional Chinese with the English quotation preserved.
- [x] A summary quoting text the learner never said is rejected as invalid provider
      output and the session stays retryable with its answers intact.
- [x] An all-skipped session completes with an honest "nothing to assess" state and
      makes no model call.
- [x] A summary covering one or two skipped questions still works.
- [x] Per-question feedback is generated only when opened, uses the four existing
      assessment dimensions, is cached, and is refused for a skipped question.
- [x] After completion, English Assistance and Key-Sentence Corrections work on
      session answers.
- [x] A provider failure or cancellation during the summary leaves every answer
      intact and the summary retryable.
- [x] Sessions are listed under their job, distinguishable from Practice Records, and
      never change, complete or overwrite a Practice Record.
- [x] A session never requires or produces a Focus Point and contributes nothing to
      the progress view.
- [x] Deleting the job and deleting all local data remove sessions and their
      recordings with no dangling references.
- [x] `CONTEXT.md` defines Short Mock Session and Session Summary.
- [x] API-level tests cover every rule above, including the isolation assertion that
      existing Practice Records are byte-identical after a full session.
- [x] Browser smoke walks one full session: start, answer, skip, reach the summary,
      open one question's feedback, confirm the skipped question shows as skipped,
      confirm assistance is absent during and present after, confirm resume after
      reload, and confirm no horizontal overflow at phone width.

## Blocked by

- [Issue 0017](./0017-answer-by-voice-in-every-answer-path.md)

## Verification

Implemented and verified through the API and browser seams.
[Evidence](../verification/0018.md). Whether a three-question run feels like a
screening call, and whether the Session Summary is useful coaching, are pending
learner acceptance.
