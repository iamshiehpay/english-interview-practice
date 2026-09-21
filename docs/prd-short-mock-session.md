---
status: ready-for-agent
---

# PRD — Three-question short mock session

Source of confirmed requirements: [`voice-practice-discussion.md`](./voice-practice-discussion.md),
section "後續三題短場模擬（獨立範圍）" (2026-09-21 batch acceptance), plus
[ADR 0002](./adr/0002-center-the-first-version-on-one-practice-loop.md),
[ADR 0006](./adr/0006-use-a-fixed-evidence-based-feedback-contract.md) and
[ADR 0017](./adr/0017-use-selected-resume-and-optional-revision.md).

The discussion explicitly records that details it did not specify are **not**
confirmed. Anything this PRD adds beyond the six accepted points is marked as an
implementation decision, and the open ones are listed under **Further Notes**.

## Problem Statement

The Practice Loop is deliberately slow: one question, deep feedback, a revision,
optional follow-ups, a Focus Point. That is right for learning a single answer
and wrong for the thing a Target Learner is actually afraid of — sitting through
a run of questions without stopping to be coached between them.

Today there is no way to practise continuity. The learner cannot:

- answer several questions back to back under the same Job Snapshot and resume
  version, the way a screening call runs;
- experience being unable to peek at an Illustrative Answer mid-question;
- skip a question they cannot answer and keep going, the way they would have to
  in a real call;
- get one honest overall read of a whole session rather than four separate
  per-question verdicts;
- pause a session and come back to it without either losing it or having it
  counted as something they finished.

The Practice Loop's own guarantees make it the wrong tool for this: it wants
feedback after every answer, it offers coaching in the middle, and completing it
means choosing a Focus Point.

## Solution

Add a **Short Mock Session**: three Job-grounded Interview Questions from one
Job Snapshot, answered in a row, assessed at the end.

**One job, one resume version, three question types.** A session is created from
a Job Snapshot whose Question Set already exists. It draws three questions
covering three different Question Categories, so a session is never three
variations of the same thing. The resume version frozen on the Job Snapshot is
the one used, exactly as the Practice Loop uses it.

**Three main questions, no follow-ups.** The first version is a fixed run of
three main questions. No Follow-up Questions are generated inside a session.

**No coaching during the run.** While the session is in progress the learner
cannot request an Illustrative Answer, English Assistance, a hint, or a
gap-framing. They can skip a question and move on. Assistance becomes available
after the session ends.

**Three minutes per question.** Each answer reuses the same recording and typing
affordances as the Practice Loop, including the three-minute recording cap.
There is no extra preparation countdown in this version.

**One overall read first, detail on demand.** When the session ends, the learner
is shown exactly one overall strength and one overall priority improvement for
the whole session, each grounded in a verbatim quotation from one of their own
answers. Per-question Feedback Reports are generated only when the learner opens
that question — the detail is available, not forced.

**Save and resume; unfinished is unfinished.** Progress is saved as the session
runs, so the learner can leave and come back to the next unanswered question. A
session that has not reached its end is shown as in progress and is never
displayed, counted or summarised as a completed session.

## User Stories

### Starting a session

1. As a Target Learner, I want to start a three-question mock session from a job
   I have already saved, so that the questions are grounded in that posting.
2. As a Target Learner, I want the session to use the resume version frozen on
   that Job Snapshot, so that the questions match the background I practised with.
3. As a Target Learner, I want the three questions to cover three different
   Question Categories, so that a session is not three versions of one question.
4. As a Target Learner, I want the session to prefer questions I have not
   practised yet, so that a session adds coverage rather than repeating me.
5. As a Target Learner, I want to be told up front that it is three questions,
   three minutes each, with feedback at the end, so that I know what I am
   committing to.
6. As a Target Learner, I want to be stopped from starting a session on a job
   with no Question Set, and told to generate questions first, so that the error
   is actionable.
7. As a Target Learner, I want to be prevented from having two unfinished
   sessions on the same job at once, so that "continue my session" is unambiguous.

### Answering

8. As a Target Learner, I want to see which question I am on out of three, so
   that I can pace myself.
9. As a Target Learner, I want each question shown in English with its Chinese
   meaning, so that the session reads like the rest of the product.
10. As a Target Learner, I want to answer by speaking or by typing, so that the
    session matches how I practise.
11. As a Target Learner, I want the same three-minute recording limit as the
    Practice Loop, so that one rule governs recording everywhere.
12. As a Target Learner, I want to submit my answer and go straight to the next
    question, so that the run feels continuous.
13. As a Target Learner, I do not want a Feedback Report between questions, so
    that the session tests continuity rather than coaching.
14. As a Target Learner, I want to skip a question I cannot answer and keep
    going, so that one hard question does not end the session.
15. As a Target Learner, I want a skipped question shown as skipped rather than
    as a bad answer, so that the record is honest.
16. As a Target Learner, I do not want an Illustrative Answer, a hint, a
    gap-framing or English Assistance while the session is running, so that the
    session measures what I can produce unaided.
17. As a Target Learner, I want to be told that assistance is available after the
    session, so that its absence reads as deliberate rather than missing.
18. As a Target Learner, I want an answer I have submitted inside a session to be
    immutable for that session, so that the session reflects what I actually said.
19. As a Target Learner, I do not want a preparation countdown in this version,
    so that the flow stays simple.

### Pausing and resuming

20. As a Target Learner, I want my progress saved as I answer, so that closing the
    tab does not lose the session.
21. As a Target Learner, I want to return to an unfinished session at the next
    unanswered question, so that resuming is one click.
22. As a Target Learner, I want an unfinished session shown as in progress
    everywhere, so that it is never mistaken for a result.
23. As a Target Learner, I want an unfinished session excluded from anything that
    counts completed practice, so that my progress view stays truthful.
24. As a Target Learner, I want to abandon an unfinished session deliberately, so
    that a session I no longer want does not follow me around.
25. As a Target Learner, I want abandoning a session to warn me that its answers
    go with it, so that I do not delete work by accident.

### Finishing and reviewing

26. As a Target Learner, I want the session to end after the third question is
    answered or skipped, so that the end is unambiguous.
27. As a Target Learner, I want one overall strength for the whole session, so
    that I leave with something concrete I did well.
28. As a Target Learner, I want one overall priority improvement for the whole
    session, so that I have a single next thing to work on.
29. As a Target Learner, I want both grounded in a verbatim quotation from one of
    my own answers, so that the summary is evidence, not flattery.
30. As a Target Learner, I want the summary written in Traditional Chinese with
    the English quotation preserved, so that it reads like the rest of the
    feedback.
31. As a Target Learner, I want to open any one question to see its full Feedback
    Report, so that detail is there when I want it.
32. As a Target Learner, I want per-question feedback fetched only when I open it,
    so that finishing a session is not a long wait.
33. As a Target Learner, I want a skipped question to show as skipped with no
    invented assessment, so that no rating is fabricated for silence.
34. As a Target Learner, I want the summary to work when I skipped one or two
    questions, so that a partial run still teaches me something.
35. As a Target Learner who skipped every question, I want an honest "nothing to
    assess" result rather than a made-up summary, so that the product does not
    pretend.
36. As a Target Learner, I want to replay my recording for a session answer, so
    that I can hear how the run actually sounded.
37. As a Target Learner, I want the per-question feedback to use the same four
    assessment dimensions I already know, so that I can compare it with my
    Practice Loop feedback.
38. As a Target Learner, I want to request English Assistance or Key-Sentence
    Corrections on a session answer once the session is over, so that the
    after-session coaching is real.

### Living alongside the Practice Loop

39. As a Target Learner, I want my sessions listed under the job they belong to,
    so that Records stays organised by job.
40. As a Target Learner, I want a session distinguishable from a Practice Record
    at a glance, so that I do not confuse a mock run with a deep practice.
41. As a Target Learner, I do not want a session to change, complete or overwrite
    any existing Practice Record, so that my earlier work is safe.
42. As a Target Learner, I do not want a session to demand a Focus Point, so that
    it is not forced into the Practice Loop's completion rule.
43. As a Target Learner deleting a job, I want its sessions and their recordings
    deleted too, so that deletion stays complete.
44. As a Target Learner deleting all local data, I want every session removed, so
    that the workspace promise still holds.
45. As a Target Learner, I want a session to survive a service failure with my
    answers intact and a retry available, so that a provider outage costs me the
    summary, not the session.

## Implementation Decisions

### Domain language

Two additions to `CONTEXT.md`:

- **Short Mock Session（三題短場模擬）** — a single-sitting run of three
  Job-grounded Interview Questions from one Job Snapshot and its frozen resume
  version, answered without intervening feedback or coaching, assessed once at
  the end. It is not a Practice Loop and never produces a Focus Point.
  _Avoid_: Practice Loop, real interview, timed exam.
- **Session Summary（整場回饋）** — the single overall strength and single
  overall priority improvement produced for one completed Short Mock Session,
  each quoting one of the learner's own session answers verbatim. It does not
  replace per-question Feedback Reports and produces no score.
  _Avoid_: Overall score, interview verdict, pass/fail.

### A session is its own record, not three Practice Records

A Short Mock Session is stored as its own collection alongside Practice Records,
not as three linked Practice Records. The Practice Loop's invariants — feedback
follows every attempt, completion requires a Focus Point, at most two attempts,
optional follow-ups — are correct for the Practice Loop and wrong for a session.
Reusing the Practice Record shape would mean either weakening those invariants
for everyone or writing records that violate them. A separate collection keeps
both honest, and the existing Practice Records stay untouched, as
`docs/agents/domain.md` requires.

A session stores: the Job Snapshot it belongs to, the frozen question payloads
(copied at creation, exactly as a Practice Record copies its question), one entry
per question holding the answer transcript or a skip marker plus an optional
Answer Recording reference and its own optional Feedback Report, the status, the
Session Summary, and timestamps.

### Question selection

Three questions are chosen from the Job Snapshot's existing Question Set, one
each from three different Question Categories, preferring questions the learner
has not yet practised in either a Practice Record or an earlier session, and
falling back to the least-practised question when a category has nothing unused.
No new model call is made to build a session. If the Question Set does not span
three categories the session is refused with an actionable message rather than
silently repeating a category.

### No coaching while running

The coaching and corrections paths are gated on session state: while a session is
in progress, requests for assistance against that session's answers are refused,
and the interface does not offer the controls. Once a session is completed, the
existing coaching and Key-Sentence Correction capabilities apply to its answers
through the same validated contracts used by the Practice Loop.

### Answers are submitted once

Submitting an answer for a session question is idempotent under a submission
identifier, the way the Practice Loop's attempts already are, and a submitted
session answer cannot be replaced. Skipping is explicit and also final for the
session. The current question is always the first entry with neither an answer
nor a skip.

### Session Summary contract

A new model contract produces the Session Summary from the session's questions
and answers only: no Feedback Reports, no resume, no coaching, no ratings. It
returns exactly one strength and one priority improvement, each with English
text, a faithful Traditional Chinese counterpart, and a quotation that must be a
verbatim substring of one of the supplied session answers. Validation mirrors the
existing feedback validation: shape, bilingual presence, and citation against the
actual transcripts, rejecting anything else as invalid provider output.

A session where every question was skipped produces no model call and a fixed,
honest "nothing to assess" state.

The summary call runs through the existing long-running operations tracker, like
analysis and feedback, so it is cancellable, retryable, idempotent per request
identifier, and visible in the operations strip. A failed summary leaves the
session's answers intact and retryable.

### Per-question feedback on demand

Per-question Feedback Reports use the existing feedback contract and validator
unchanged, are generated only when requested, and are cached on the session entry
so reopening a question does not call the provider again. A skipped question is
never sent for feedback.

### Recordings

Session answers reuse the Answer Recording mechanism introduced by the voice
practice work: the recording is retained locally, attached to that session
answer, replayable, and deleted with the session, with the job, and with the
workspace.

### Presentation

Sessions appear in Records under their job, visually distinguished from Practice
Records, with in-progress sessions offering "continue" and completed sessions
offering "view summary". The progress view and any count of completed practice
continue to count Practice Records; sessions are counted separately and only when
completed.

## Testing Decisions

Good tests assert what a learner can observe: which question comes next, what is
stored, what is refused, and what the page shows. The two existing seams are
used; no new seam is added.

### HTTP API seam (`test/*.test.js`, prior art `test/practice.test.js`, `test/follow-ups.test.js`)

- **Creation**: a session draws three questions from three different Question
  Categories; a Job Snapshot without a Question Set is refused; a second
  unfinished session on the same job is refused; the frozen resume version on the
  snapshot is the one recorded.
- **Running**: the current question advances on answer and on skip; a submitted
  answer cannot be replaced; a repeated submission with the same submission
  identifier is idempotent; answering out of order is refused.
- **Coaching gate**: assistance and corrections against an in-progress session
  are refused; after completion they succeed through the existing validated
  contracts.
- **Completion**: the session completes after the third entry is answered or
  skipped; the Session Summary quotation is a verbatim substring of one of the
  session's own answers; a summary that quotes text the learner never said is
  rejected as invalid provider output; an all-skipped session completes with the
  honest empty state and no provider call.
- **Per-question feedback**: requesting feedback for one question returns a valid
  Feedback Report, caches it, and does not generate the others; requesting
  feedback for a skipped question is refused.
- **Failure**: a provider failure during summary leaves every answer intact and
  the session retryable; a cancelled summary operation does the same.
- **Deletion**: deleting the job and deleting the workspace remove the session and
  its recordings; no dangling recording references remain.
- **Isolation**: creating, running and completing a session leaves every existing
  Practice Record byte-identical, and completed-practice counts are unchanged.

### Browser DOM seam (`test/browser-smoke.js`)

Walk one full session with the deterministic provider: start from a job, see
"1 / 3", answer, see "2 / 3", skip the third, reach the summary showing exactly
one strength and one priority improvement, open one question to load its Feedback
Report, confirm the skipped question shows as skipped with no rating, confirm no
assistance controls appeared during the run and that they appear after, and
confirm there is no horizontal overflow at phone width. Also confirm an
unfinished session resumes at the right question after a page reload and is
labelled in progress.

### Not automated

Whether three questions in a row actually feels like a screening call, and
whether the Session Summary is useful coaching rather than a platitude, are human
judgements. The verification document records them as pending learner acceptance
rather than claiming them.

## Out of Scope

- Follow-up Questions inside a session (explicitly deferred to a later version).
- A preparation countdown, per-question timers other than the shared three-minute
  recording cap, or any wall-clock pressure.
- Configurable session length, difficulty, or question selection by the learner.
- Interviewer persona, spoken interviewer turns, or conversational back-and-forth.
- Scores, grades, pass/fail verdicts, or cross-session trend claims.
- Revisions or second attempts inside a session.
- Focus Points, Recurring Weakness tracking, or Focus Point Continuation from a
  session. A session produces a Session Summary and nothing else.
- Exporting or sharing a session.

## Further Notes

- The discussion confirmed six points and said explicitly that other details are
  not confirmed. Question selection, the refusal rules, the separate storage
  collection, the summary contract and the on-demand per-question feedback are
  implementation decisions made here, not learner decisions; they are recorded so
  the learner can overrule them.
- Whether a session should eventually feed Recurring Weakness tracking is left
  open. Until decided, sessions contribute no evidence to the progress view.
- This PRD depends on the Answer Recording mechanism from the voice practice PRD;
  session recordings should not be built a second time.
