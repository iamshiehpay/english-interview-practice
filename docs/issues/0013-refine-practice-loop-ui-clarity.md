---
status: ready-for-human
---

<!-- Verified 2026-09-20: the header single-line fix, single completion control,
provider evidence trim, calmer question typography, scroll-to-feedback, compact
deduplicated scorecard, and styled resume upload were confirmed present in the
code and re-exercised by test/browser-smoke.js after 0010–0012 were integrated in
the same warm visual language. Human learner acceptance is still pending; see
docs/verification/second-round-0010-0013.md. -->


# Refine Practice Loop interface clarity and fix header layout defects

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## Related

- Implementation plan: [UI/UX Fixes — 2026-09](../ui-ux-fixes-2026-09.md)
- Builds on the delivery UI from issues 0001, 0009 (optional follow-ups),
  0010 (key-sentence corrections).

## Problem Statement

A Target Learner practising through the text Practice Loop meets several
interface problems that make the deliberately-slow "one question at a time"
experience feel cluttered and, in one case, visibly broken:

- On a desktop viewport the "view the original posting" toggle beside the Job
  Snapshot renders as vertical stacked characters (one glyph per line), because
  the derived job title can be the entire posting when the description was
  pasted as a single block.
- After a Feedback Report appears, the learner faces five actions spread across
  three identically-styled cards, including two separate buttons that both end
  the Practice Loop. There is no clear primary next step.
- With the deterministic demonstration provider, each Job-grounded Interview
  Question, its Chinese meaning, and every Feedback Report quotation are flooded
  with the full posting text, and the question is set in a hero-sized font, so a
  single question fills the viewport.
- Submitting an Answer Attempt returns the learner to the top of the page (the
  large question), so they must scroll past it to read their Feedback Report.
- The Practice Resume upload uses an unstyled native file control that clashes
  with the rest of the interface.

## Solution

Tighten the Practice Loop presentation so the interface matches the product's
"one question, calm focus" intent, and fix the header defect:

- Show the Job Snapshot as one compact, collapsible line — a short title plus a
  "view original posting" toggle that can never collapse into vertical text.
- Collapse the post-feedback screen into a single "what next" section with one
  completion action (selecting a Focus Point ends the Practice Loop) and clearly
  secondary optional branches (ask a Follow-up Question, try again, or request
  English Assistance).
- Make the deterministic demonstration provider cite a short, realistic excerpt
  of the posting rather than the whole thing, and set the question in a calmer
  size, so the demonstration reads like the configured-provider product.
- After a Feedback Report is generated, move focus to the feedback heading.
- Present the Practice Resume upload with a styled control and a filename
  readout.

## User Stories

1. As a Target Learner, I want the "view original posting" toggle to read as a
   normal horizontal control, so that the practice screen never looks broken.
2. As a Target Learner, I want the Job Snapshot shown as one short line with the
   full posting tucked behind a toggle, so that the question — not the posting —
   is the focus.
3. As a Target Learner, I want the full posting text to appear only once (behind
   the toggle), so that I am not reading the same block twice on one screen.
4. As a Target Learner practising on a phone, I want the header to never cause
   horizontal scrolling, so that the layout stays clean at small widths.
5. As a Target Learner, after reading my Feedback Report I want a single obvious
   way to end the Practice Loop, so that I am not confused by two buttons that do
   the same thing.
6. As a Target Learner, I want to end the Practice Loop by confirming or editing
   my Focus Point in one place, so that completion and Focus Point selection feel
   like one action.
7. As a Target Learner, I want "ask a Follow-up Question", "try again", and
   "help me say it more naturally" grouped as clearly optional, so that ending is
   distinguishable from continuing.
8. As a Target Learner, I want the post-feedback actions to share one visual
   hierarchy rather than three competing cards, so that I can see the primary
   next step at a glance.
9. As a Target Learner, I want a Job-grounded Interview Question to read as a
   focused question rather than a wall of posting text, so that I can concentrate
   on answering it.
10. As a Target Learner, I want the Chinese meaning of a question to be concise,
    so that it clarifies rather than repeats the posting.
11. As a Target Learner, I want Feedback Report quotations to be short excerpts of
    my own words, so that the report is easy to scan.
12. As a Target Learner, I want the question typography to be prominent but not
    overwhelming, so that a normal-length question fits comfortably on screen.
13. As a Target Learner, after I submit an Answer Attempt I want the page to take
    me to my Feedback Report, so that I do not have to scroll past the question to
    find it.
14. As a Target Learner reopening a saved Practice Record, I want it to open at
    the top as before, so that automatic scrolling only happens for fresh
    feedback.
15. As a Target Learner using a screen reader, I want focus moved to the feedback
    heading when feedback arrives, so that I am told my report is ready.
16. As a Target Learner reviewing the four assessment dimensions, I want a compact
    scorecard, so that I can read all four at a glance.
17. As a Target Learner, I do not want the same sentence quoted repeatedly across
    dimensions, so that the assessment detail stays concise.
18. As a Target Learner uploading a Practice Resume, I want a styled upload button
    and a visible filename, so that the upload matches the rest of the interface.
19. As a Target Learner, I want all existing flows — resume opt-out, draft
    recovery, feedback retry, optional revision, English Assistance, follow-ups,
    completion — to keep working unchanged, so that no capability is lost.

## Implementation Decisions

Scope is the local browser interface (`public/app.js`, `public/style.css`) and
the deterministic demonstration language provider (`src/providers.js`). No HTTP
API contract, domain model, or persisted schema changes. `CONTEXT.md` is
unchanged — these are presentation concerns, not new domain language.

- **Job Snapshot header.** Replace the bold full-first-line + toggle with a
  single compact line: a short title (the posting's first line truncated with an
  ellipsis) followed by the "view original posting" toggle. The toggle is laid
  out so it cannot shrink (fixed basis, no wrap); the title truncates instead of
  pushing the toggle to zero width. The full posting remains available only
  inside the toggle.
- **Post-feedback actions (single completion).** Completing a Practice Loop is
  selecting a Focus Point; there is exactly one completion control. Remove the
  duplicate "end directly" button that appears before any Follow-up Question has
  started. Keep the single completion control (the Focus Point editor plus its
  button) as the primary action; keep the separate completion control that lives
  inside the follow-up action group during the follow-up flow, with its existing
  gating (it stays disabled/absent while a follow-up's feedback is pending).
  Group the optional branches — ask a Follow-up Question, try again, request
  English Assistance — under one heading, styled as secondary. Existing button
  labels and their container elements are preserved; only the redundant button is
  removed and the surrounding grouping/styling changes.
- **Question and quotation length (demonstration provider).** The demonstration
  provider derives each capability's cited evidence from the posting. Trim that
  evidence to a short excerpt (a single sentence, bounded length, ending on a
  word or punctuation boundary) that remains a verbatim substring of the Job
  Snapshot text and is non-empty, so it still satisfies grounding and citation
  validation. This shortens the Job-grounded Interview Question text, its Chinese
  meaning, and the transcript-derived quotations across every screen. Question
  typography is reduced from hero size to a calmer prominent size.
- **Scroll to feedback.** When a Feedback Report is freshly generated, move the
  viewport and keyboard focus to the feedback heading (made focusable). Reopening
  an existing Practice Record does not auto-scroll. This is driven by an explicit
  signal passed from the submit/feedback path into the record renderer, mirroring
  the existing follow-up feedback focus behaviour.
- **Feedback scorecard.** Render the four assessment dimensions as a compact
  scorecard (dimension, level out of four, one-line reason). Show a dimension's
  quotation only when it differs from the strength/priority quotations already
  shown and from earlier dimensions; deduplicate identical quotations. The shared
  feedback renderer must keep working for its other callers (follow-up feedback,
  attempt history, legacy monolingual records that lack Chinese fields).
- **Practice Resume upload.** Visually hide the native file input (retain the
  element and its change handler) and drive it from a styled label-button plus an
  inline filename readout.
- **Deferred:** the top navigation is unchanged this round; it fits at desktop
  and phone widths today and is recorded as a future consideration only.

## Testing Decisions

Good tests here assert external behaviour a Target Learner can observe, not
implementation details or pixel geometry. Use the two existing seams; add no new
seam.

- **HTTP API seam (`test/*.test.js`, prior art `test/practice.test.js`,
  `test/questions.test.js`).** For the demonstration provider trim: assert that a
  generated question's cited evidence is bounded in length and remains a verbatim
  substring of the Job Snapshot text (grounding still holds), and that analysis
  still produces a valid bilingual Question Set. Existing validator-mutation tests
  must continue to pass unchanged.
- **Browser DOM seam (`test/browser-smoke.js`).** Extend the existing smoke to
  assert: after primary feedback and before any follow-up, only one completion
  affordance is present (the redundant "end directly" button is gone); when
  feedback is freshly generated the feedback heading receives focus; a repeated
  quotation is not shown twice within the assessment dimensions. Preserve the
  existing assertions, including no horizontal overflow at phone width and the
  Practice Resume upload interactions on the retained file input.
- **Manual/visual verification (not automated).** Exact single-line header
  rendering, question font size, upload-button appearance, and card styling are
  verified by re-walking the browser flow, since pixel layout is not a stable
  automated assertion.

Run `node --test test/<file>.test.js` per file during development and the full
`npm test` suite plus `npm run test:browser` once at the end.

## Out of Scope

- Top navigation redesign / hamburger menu (deferred; recorded only).
- Any change to configured external providers (OpenAI, Codex) or the speech
  provider; only the deterministic demonstration language provider is touched.
- HTTP API contracts, domain model, persisted workspace schema, and `CONTEXT.md`.
- Voice practice UI, job discovery, candidate evidence, and progress views beyond
  the shared feedback renderer they reuse.
- The follow-up completion control and its pending-feedback gating (kept as-is).

## Further Notes

- The browser smoke test hard-codes selectors and button text in the areas being
  changed (`#complete-practice`, `#resume-file`, `#answer`, `#submit-answer`,
  `#follow-up-actions`, and the labels `結束並保存`, `自己再試一次`,
  `幫我講得更自然`, `讓面試官追問`, `繼續追問`). These must survive verbatim, so
  the post-feedback rework is regrouping + styling + removing one button, not
  renaming.
- The default provider's ratings remain a fixed demonstration and are not
  meaningful coaching; this ticket only changes how much posting text they echo,
  not their synthetic nature.
