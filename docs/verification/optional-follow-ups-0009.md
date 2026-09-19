# Optional follow-ups — verification (issue 0009)

Date: 2026-09-19

## Scope

One primary Job-grounded Interview Question can have up to two learner-selected follow-ups. Each formal follow-up answer receives Traditional Chinese feedback before the learner can continue or end. This verification uses isolated local test workspaces and the deterministic demonstration provider; it does not modify real learner records or assess real-model quality.

For repeatable local startup and the manual acceptance path, see [Start and manually test optional follow-ups](../../README.md#start-and-manually-test-optional-follow-ups).

## Automated verification

- `npm test` — PASS, 84/84.
- `npm run test:browser` — PASS.
- `node --check public/app.js` and `node --check src/server.js` — PASS.

The focused regressions cover:

- primary `attempts` remain initial answer/revision history while `followUps` are separate;
- a maximum of two follow-ups, feedback-before-continuation, and early ending before submission or after feedback;
- frozen first-primary context across a later primary revision;
- provider payload minimization: only question text and learner-authored formal transcripts leave the application, never feedback, coaching, ratings, rationale, or assistance;
- submission idempotency, retry, cancellation, deletion, post-completion late-write rejection, restart persistence, and legacy records without `followUps`;
- Chinese follow-up feedback, two-follow-up UI flow, one-follow-up early completion, assistance staying outside Answer Attempts, pending-feedback completion controls being unavailable, and mobile overflow checks.

## Browser acceptance

Using a fresh temporary workspace at `http://127.0.0.1:4311` with the fake provider:

1. Pasted a synthetic JD, generated questions, and submitted a synthetic primary answer.
2. Confirmed Chinese primary feedback presented both “讓面試官追問” and direct completion choices.
3. Generated a first follow-up, submitted a synthetic answer, and confirmed the English question, Chinese meaning, Chinese feedback, continue control, and end control after feedback.
4. At a 390 × 844 mobile viewport, verified `scrollWidth` 375 was not greater than `innerWidth` 390 and visually inspected the single-column follow-up/feedback flow.

The accessibility-driver's ordinary click command did not dispatch page actions in this local session; direct DOM click dispatch was used only to advance the same temporary test page. The rendered states, responsive layout, and all product-network requests still ran in the browser.

## Review

Two independent read-only reviews were performed against the known changed-file list because this project has no Git repository or fixed diff baseline.

- Standards review initially flagged feedback in follow-up provider input; resolved by allowlisting questions and learner-authored transcripts in server, OpenAI, and Codex adapters with regression tests.
- Spec review initially flagged a completion race and later follow-ups switching to a revised primary answer; resolved by server and UI guards plus frozen-first-primary tests.
- The final browser regression caught an in-flight UI control race; follow-up submission now immediately removes both local and global completion controls until feedback resolves.

No release-gate claim follows from these automated checks. The existing v3 human-label and five-real-learner-practice gate remains blocked as documented in `learner-flow-v3.md`.

## Follow-on handoff

- `0010`: key-sentence corrections, blocked no longer; retain the fact-preserving provider boundary established here.
- `0011`: Focus Point practice in the same Job Snapshot, after `0010`.
- `0012`: job-centred Records reorganisation can start now; derive record list state from follow-up state rather than only the primary `record.status` (a non-blocking standards-review observation).
- Follow-up drafts are intentionally not durable yet. Primary written drafts remain unchanged. If durable in-progress follow-up text becomes required, add a dedicated API/state slice rather than reusing primary drafts.
