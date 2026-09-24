---
status: completed
---

# Common Questions mechanism: a pinned self-introduction for every job

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

20–36

## Context

The self-introduction is the first **Common Question**: an app-authored question
shown with every job's Question Set, not generated from the Job Snapshot and not
a Job-grounded Interview Question. It must not touch the model contract, the
analysis validator, the evaluation checks or the "preserve existing questions
byte-for-byte" expansion contract, so it is injected when a Question Set is
served, never stored in it. Existing jobs get it without migration.

Research notes (2026-09-24): the served Question Set goes through the
question-set view; answer creation, follow-ups, mock sessions and focus-point
practice check that a question id exists in the **stored** Question Set; the
feedback path reads `capabilityIds` unconditionally, so it must be `[]`; mock
sessions pick the first question per category in array order.

This slice builds the mechanism (an ordered app-authored list with one item) so
that 0032 only adds items and a UI block.

## What to build

- An app-authored Common Questions list whose first item is the self-introduction:
  reserved id `self-introduction`, text `Tell me about yourself.`, `meaningZh`
  「請用一到兩分鐘介紹自己：你的背景、和這個職位相關的經驗，以及為什麼想應徵。」,
  category `role-fit`, an app-authored English and Chinese rationale,
  `capabilityIds: []`, no capability evidence, and a marker distinguishing it
  from job-grounded questions (e.g. `source: "common"`, `group: "self-introduction"`).
- The served Question Set of every job that has one shows the self-introduction
  first; a job without a Question Set shows none. Question expansion (+4) is
  unchanged.
- Every server check that a question id belongs to a job's Question Set also
  accepts the reserved ids when that job has a Question Set, so answering,
  revision, follow-ups, hints, the illustrative answer and feedback all work on it.
- Short mock sessions always open with the self-introduction; the other two are
  chosen from job-grounded questions only, with three distinct categories (no
  second role-fit question).
- "練這個重點" from a self-introduction Focus Point generates a new job-grounded
  role-fit question as usual.
- The workbench pins the self-introduction above the job-grounded questions with
  a 「固定題」 label; learner-facing counts show Common Questions and job-grounded
  questions separately (e.g. 「常見題 1｜職缺題目 8」); completion counts include it.
- Add **Common Question** to `CONTEXT.md`.

## Acceptance criteria

- [x] The served Question Set has the self-introduction first with the exact text, gloss, category, empty capability list and common-question marker.
- [x] A Question Set stored before this change serves it without any stored data being rewritten.
- [x] No Question Set → no Common Question; "add four more questions" still works and the job-grounded count is unchanged.
- [x] An Answer Attempt on `self-introduction` receives feedback through the fake provider; revision and a follow-up work.
- [x] A new short mock session starts with the self-introduction and its three questions have distinct categories.
- [x] Model-output validation and evaluation-check tests are unchanged and pass.
- [x] The UI pins and labels the card and shows separated counts; browser smoke asserts both.
- [x] `CONTEXT.md` defines Common Question (with an _Avoid_ line, e.g. "fixed JD question").
- [x] `npm test` and `npm run test:browser` pass.

## Files likely touched

- A new small common-questions module under `src/`, the question-set view in `src/domain.js`
- `src/server.js` (question-id membership checks for records, follow-ups, focus practice), `src/mock-sessions.js`
- `public/app.js`, possibly `public/styles.css`
- `CONTEXT.md`
- `test/questions.test.js`, `test/mock-sessions.test.js`, `test/practice.test.js`, `test/browser-smoke.js`

## How to verify

```sh
node --check public/app.js
npm test
npm run test:browser
```

## Blocked by

None — can start immediately.

## Comments

### 2026-09-24 — AI implementation and two verification rounds

- `code-mapper` traced the serving/practice boundaries; `backend-developer` and `frontend-developer` implemented separate ownership areas. Independent `test-automator` and `reviewer` passed round 2 (Standards PASS, Spec PASS).
- `node --check public/app.js`, `npm test` (211/211), `npm run test:browser`, and offline `npm run evaluate` passed. Offline evaluation: 60/60 results, zero failures, 80/80 stable dimensions, fake local provider only. Release remains blocked by separate semantic/label/persona/live-quality gates.
- Tests cover unchanged stored analysis bytes and legacy sets, no-set behavior, +4 grounded expansion, feedback/revision/follow-up/hints/illustration/read-aloud, failed feedback retry, mock opening and distinct categories, and Focus Point continuation to a grounded role-fit question. Independent own-server agent-browser check at 360 px verified fixed label/gloss, common-first order, separated 1/8 counts, and no overflow (document 345 <= 360 px).
- Round 1 caught evaluator misuse of the served view and a possible reserved-ID collision. Round 2 projects only job-grounded questions at the evaluator boundary, leaving strict model checks unchanged; new model ID collisions fail atomically with 502. Existing stored collisions fail explicitly with 409 and are not automatically migrated; recreating that job can rebuild its Question Set. No source data was rewritten.
- All test servers/workspaces/browser sessions were isolated; 4310 was never contacted. Static-file allowlist and model contract are unchanged. Incidental screenshots were restored. No additional out-of-scope issue was identified.
