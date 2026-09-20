# Second-round Practice Loop — verification (issues 0010–0013)

Date: 2026-09-20. Scope: implementation and verification of issues 0010, 0011,
0012, and the residual/integration of 0013, delivered together on top of the
pre-implementation Git baseline `18975d4` (working tree clean at the baseline).

All automated verification uses isolated temporary workspaces and the
deterministic demonstration language provider. No real learner resume, answer,
Practice Record, credential, or token is read, logged, or committed. Automated
checks do not substitute for human learner acceptance or live-model quality
evaluation (see `learner-flow-v3.md` and `docs/issues/0008`).

## Git baseline

- Pre-implementation baseline: `18975d4` (`docs: include Taiwan foreign-company and remote roles`), branch `ui-ux-practice-loop-refinements`, clean tree.
- All 0010–0013 work is one change set on top of that baseline. The repository has no configured remote; changes are local only.

## What was already implemented before this change set

Per the handoff, most of 0013 was already present in the code and was verified
intact rather than rebuilt: single-line Job Snapshot header (ellipsis, no
vertical text), a single completion control (no duplicate `直接結束並保存`),
the deterministic provider's short evidence citation (`citation()` in
`src/providers.js`), calmer question typography (`.question-text`
`clamp(22px,2.6vw,28px)`), scroll/focus to the feedback heading on fresh
feedback, the compact deduplicated four-dimension scorecard, and the styled
Practice Resume upload. These were re-exercised by the browser smoke after the
new features were integrated in the same warm visual language.

## Automated verification results

- `npm test` — PASS, **108/108** (`node --test test/*.test.js`).
  - New: `test/corrections.test.js` (8), `test/focus-practice.test.js` (5), `test/records-by-job.test.js` (3). Baseline 92 remain green.
- `npm run test:browser` — PASS (deterministic provider, isolated workspace).
  - Desktop viewport 1440×900 and mobile viewport 390×844; screenshots written to `docs/verification/learner-flow/`.
- `node --check` — PASS for `public/app.js`, `src/server.js`, `src/domain.js`, `src/providers.js`, `src/cloud.js`, `src/codex-language.js`.

## 0010 — Evidence-safe key-sentence corrections

- New seam: `POST /api/records/:id/corrections` with `{attemptId}` (primary or
  follow-up attempt); result stored at `record.corrections[attemptId]`, separate
  from Answer Attempts. Runs through the existing operation framework
  (kind `corrections`): cancellation, idempotency, and retry-after-failure apply,
  with a replay path.
- Evidence safety (`validateCorrections`, `src/domain.js`): 0–2 items; each
  `original` must be a verbatim substring of the learner transcript; `rewrite`
  must be English and may only contain numbers already present in `original`
  (no invented metrics); `reasonZh` must be Traditional Chinese. Invalid output
  is rejected (502) with no partial write.
- Payload minimization: the provider receives only the question and the learner's
  own transcript — never feedback, ratings, or coaching. Confirmed at the server
  seam and at the external adapter (`OpenAILanguageModel.corrections` sends only
  `{question:{text}, transcript}`); Codex and Claude adapters mirror this.
- Old records: corrections are generated only on a fresh-feedback auto-request or
  an explicit button; reopening a saved record never generates them, so historical
  records stay readable and are not silently re-evaluated.
- UI: `correctionsHtml` renders 0–2 cards (original / suggested rewrite / Chinese
  reason) or a no-change note; a failed request offers a retry button.
- Covered paths: normal (≥1 correction quoting the learner), no-change (empty),
  retry after provider failure, evidence-safety rejections, follow-up-answer
  corrections, and old-record readability — API tests plus browser smoke
  (normal + evidence-safe substring on the reopened record; retry + no-change via
  stubbed responses on the JD-only record).

## 0011 — Focus Point practice in the same job

- New seam: `POST /api/records/from-focus` with `{recordId}`. Requires a completed
  source record with a Focus Point. Creates a new record under the **same** Job
  Snapshot (same frozen resume version), choosing an unpractised question in the
  source question's category (a fresh same-JD scenario) without any new model
  generation. Records `focusOrigin` (source record id, source question, Focus
  Point) for attribution.
- The source record and its answers/resume version are never modified.
- UI: "針對這個重點再練一次" on a completed record; a `延續練習重點` banner on the
  new record; on completion a `.focus-progress` panel shows the source Focus Point
  beside the new priority and its supporting quote and explicitly states the
  system will not claim improvement (no fabricated progress).
- Covered by API tests (creation, same-job, source preservation, gating,
  completion outcome, same-category scenario selection) and the browser smoke.

## 0012 — Records reorganized by job

- The Records surface is now a single warm column of jobs. Most recent unfinished
  practice is surfaced first as a continue card. Jobs sort by recent activity and
  show a brief title, recent activity, and completed-primary count only.
- Search (`#job-search`), filter (all / active / completed), and pagination
  (6 jobs/page) are provided. Inline rename uses a new
  `POST /api/snapshots/:id/title` route (trim, ≤120 chars, empty clears). Job and
  record deletion live in a `⋯` more-menu (inline, no blocking prompt for rename).
  Every job — including one with no completed practice — keeps a
  "開始新練習 / 產生題目" entry.
- Job detail lists each Practice Record; opening one reuses `showRecord`, which
  preserves historical questions, one answer version at a time, feedback, and
  follow-up grouping.
- Deleting one job leaves other jobs and their records intact (API test).
- Desktop and mobile browser checks confirm a reachable single column with no
  horizontal overflow.

## 0013 — Practice Loop UI clarity (integration)

- Verified the pre-existing fixes remain intact (list above) and integrated the
  0010/0011/0012 additions in the same warm peach/cream, rounded-card, pill-button
  language. The browser smoke still asserts: exactly one completion control before
  any follow-up, the removed duplicate end button, feedback-heading focus on fresh
  feedback, four assessment dimensions with deduplicated citations, the styled
  resume upload, and no mobile horizontal overflow. Hard-coded smoke selectors and
  button texts (`#complete-practice`, `#resume-file`, `#answer`, `#submit-answer`,
  `#follow-up-actions`, `結束並保存`, `自己再試一次`, `幫我講得更自然`,
  `讓面試官追問`, `繼續追問`) survive verbatim.

## Regression and edge-case confirmations

- Resume save clears the input textarea while retaining the saved resume; the home
  page still defaults to the saved resume (browser smoke).
- Failed/cancelled operations (including the new `corrections` kind, labelled
  `整理關鍵句修正`) can be dismissed with the ✕ 清除 action via the unchanged
  `DELETE /api/operations/:id` route.
- Empty data, provider failure + retry, cancellation, idempotency, and legacy
  records without the new fields remain covered by the existing suite (unchanged)
  and the new tests.
- Backward compatibility: records without `corrections` / `focusOrigin` and
  snapshots without `title` render correctly; primary completed-practice counts are
  unchanged; follow-ups and corrections never increase the completed-primary count.

## Residual limits / not done

- No human learner acceptance and no live-model quality evaluation were performed;
  the MVP release gate (human labels and five real creator practice loops) remains
  open per `docs/issues/0008` and `learner-flow-v3.md`. This work is engineering-
  ready (`ready-for-human`), not an MVP release sign-off.
- The demonstration provider's corrections are illustrative (rewrite equals the
  quoted original with a fixed note); substantive corrections require a configured
  model provider.
- Follow-up corrections auto-surface only on freshly generated follow-up feedback;
  on a reopened record they are one tap away (button), by design, to avoid
  re-evaluating historical answers.
