# PRD — Second-round Practice Loop improvements

## Problem Statement

After receiving feedback on a primary Job-grounded Interview Question, a Target Learner needs a controlled way to practise the natural next turn of an interview. The current Practice Loop only supports revising the same answer, so it cannot retain the context of a follow-up exchange or stop that exchange safely. The learner also needs focused English correction, a direct next practice from a Focus Point, a clearer job-centred record view, and assistance before submitting an Answer Attempt.

## Solution

Extend the local-first Practice Loop in small, independently verifiable slices. The first slice adds up to two learner-selected follow-up questions per primary question. Each formal follow-up answer receives Chinese feedback before the learner chooses to continue or end. The Coach preserves the primary answer that started the follow-up conversation; generated assistance is never recorded as an Answer Attempt or used as interview context.

Later slices add limited sentence-level English corrections, a same-JD focused practice entry point, and a job-centred record list. The existing warm, low-distraction headspace-meditation visual language, frozen Job Snapshot/resume version, answer history, drafts, cancellation, and retry protections remain intact.

## User Stories

1. As a Target Learner, I want to request an interview follow-up after feedback on my formal primary answer, so that I can practise a realistic next turn.
2. As a Target Learner, I want to answer each follow-up and see Chinese feedback before deciding whether to continue, so that I retain control of the Practice Loop.
3. As a Target Learner, I want at most two follow-ups and an early-end option, so that the interaction is bounded.
4. As a Target Learner, I want follow-ups grounded in the primary question, the saved formal answer, and prior completed follow-ups, so that they relate to what I said without treating AI assistance as my answer.
5. As a Target Learner, I want later edits to the primary answer not to rewrite an active follow-up context, so that my Practice Record remains truthful.
6. As a Target Learner, I want one or two necessary sentence corrections with Chinese explanations, so that I can improve English without invented experience or overwhelming edits.
7. As a Target Learner, I want to practise my Focus Point in a new same-JD scenario, so that the next action follows directly from prior coaching.
8. As a Target Learner, I want Records organised by job in a searchable, filterable single-column list, so that I can resume or review relevant Practice Records without losing prior data.
9. As a Target Learner, I want a pre-answer “不知道怎麼回答？” entry point for a question-specific hint, Chinese/mixed ideas translated to English, or an Experience Gap framework, so that assistance is available without becoming an Answer Attempt.

## Implementation Decisions

- The Local HTTP API remains the primary seam. Preserve primary `attempts` and same-question revision semantics; represent follow-ups separately from Answer Attempts.
- A follow-up context freezes the latest formal primary Answer Attempt and completed earlier follow-ups at the moment it is created. It never uses coaching output as learner speech.
- A record allows no more than two follow-ups. A new follow-up requires feedback on the preceding formal answer; the learner can complete the Practice Loop after any feedback state. Full capacity yields a concise closure instead of more generation.
- Follow-up provider operations participate in existing operation cancellation, retry, record deletion, snapshot deletion, and late-result isolation.
- Existing practice records are backward compatible: missing follow-up fields mean no follow-ups. Existing primary completion counts remain unchanged; follow-ups never increase the completed-primary count.
- The visual implementation extends the existing warm peach/cream palette, rounded cards and pill controls. It preserves routes, accessibility, keyboard focus, persistent-state keys, data selectors, mobile single-column flow, and the current primary revision path.
- Phrase correction, focused practice, record reorganisation, and unified pre-answer assistance are separate vertical slices after the follow-up slice. Short simulation and real voice are explicitly excluded.

## Testing Decisions

- API tests cover eligibility, the two-follow-up bound, frozen source context, feedback-before-continuation, early completion, idempotency, provider failure/retry, cancellation, deletion, and restart persistence using isolated workspaces and fake providers.
- Browser smoke coverage exercises the visible primary answer → Chinese feedback → ask follow-up → answer → Chinese feedback → continue/end flow and checks the mobile viewport for overflow and reachable controls.
- Tests assert observable records and API responses, never model prompt internals. Existing primary revision tests remain the compatibility baseline.
- Automated checks do not replace human learner validation or live-model quality evaluation.

## Out of Scope

- Three-question short simulations, real-voice interaction, unbounded conversational interviews, automated claims about learner experience, and automatic submission of AI-generated English.

## Further Notes

- Source decisions: `docs/learner-flow-discussion.md` (final second-round section), `CONTEXT.md`, ADR 0017, and `docs/verification/learner-flow-v3.md`.
- This PRD is published locally through the configured Markdown tracker. `docs/issues/0008` remains awaiting human validation and is not closed by this work.
