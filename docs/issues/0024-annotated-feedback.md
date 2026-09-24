---
status: completed
---

# Annotated feedback: transcript marks, linked notes, rating bars, inline correction diff

## Parent

[PRD — Workbench UI redesign](../prd-ui-redesign.md)

## User stories covered

15, 16, 17, 18, 19, 20, 21

## Context

Today's feedback rendering (`public/app.js`'s `feedbackHtml`/`finding`
helpers around lines 423 and 1058, and the correction rendering near the
coaching functions) repeats the learner's own sentence inside a
`<blockquote>「你的原句」` for the strength, the priority improvement, each of
the four ratings, and each Key-Sentence Correction — the exact "重複貼出"
problem the 2026-09-23 audit flagged. This issue replaces that pattern with
the mockup's annotated-editor pattern: the transcript renders once, and every
feedback item becomes a reference into it.

This issue depends on issue 0023's two-pane/tab shell existing (it replaces
that shell's *feedback pane content*, and its *answer pane's* transcript
rendering, with the annotated version). It does not change
`src/model-contracts.js`, `validateFeedback`, or any other server-side
contract — `strength.quote`, `priorityImprovement.quote`, each
`ratings.*.quote`, and each correction's `original` are exact verbatim
substrings of the transcript today (ADR 0006/0016) and remain so; this issue
only changes how those existing, already-validated quotes are matched back
onto the transcript and displayed.

## What to build

- **Transcript segmentation.** Given the transcript string and the set of
  quotes to annotate (strength quote, priority-improvement quote, each rating
  quote, each correction's `original`), locate every quote as an exact
  substring (matching how the model-contract already guarantees they occur)
  and split the transcript into segments at every quote boundary, per the
  PRD's confirmed overlap rule: a segment inside more than one quote's span
  carries every matching id in `data-notes` (space-separated) and the union
  of those annotations' visual styles. A quote that cannot be located (e.g. an
  older single-language record, or any edge case) degrades to plain
  unannotated text for that item rather than throwing — never hide the rest
  of the transcript because one quote failed to match.
- **Marks.** Render each segment as `<mark class="mk mk-ok|mk-warn|mk-rate">`
  per the Design System table (solid/`--ok`, wavy/`--warn`, dotted/`--accent`)
  with the corresponding text tag (優／改／切据構英 — using 切／據／構／英 for
  the four rating dimensions). A rate-kind tag is visually present only when
  its mark is active/hovered/focused, per the mockup; ok/warn tags are always
  visible.
- **Linked notes pane.** The right pane (or 回饋 tab) lists the strength note,
  the priority-improvement note, and the four expandable rating rows (see
  below), each with a "↳ 第 N 句" jump control. Hovering or focusing either a
  transcript mark or its matching note highlights both; this must work via
  keyboard focus, not only `:hover`, and must be announced sensibly to
  assistive technology (e.g. `aria-describedby` linking a mark to its note, or
  an equivalent accessible-name approach — pick one and apply it
  consistently).
- **Rating bars.** Each of the four dimensions (relevance／support／structure／
  englishExpression, existing Chinese labels unchanged) renders as a 1-4
  segment bar using only `--accent` (the PRD's confirmed single-colour
  default — no red/yellow/green), expandable to show the existing Chinese
  reason text and its transcript-linked quote mark.
- **Inline correction diff.** Each Key-Sentence Correction renders as the
  original sentence with an inline word/phrase-level diff against the
  rewrite (`<del>`/`<ins>` styling per the Design System tokens) instead of
  today's two separate "你的原句" / "建議表達" blocks, followed by the
  existing `reasonZh` text. A simple word-boundary diff is sufficient; it
  does not need to be a general-purpose diff library (zero dependencies) —
  a minimal LCS-based word diff in `public/app.js` is enough.
- **Home preview sync.** Update the static feedback preview added in issue
  0025 (or, if 0025 has not landed yet, leave a clear `TODO` referencing this
  issue) to use the same annotated markup, per the PRD's decision (5) that
  the two must not drift apart. If 0025 ships after this issue, do the sync
  here is not possible — coordinate ordering with whoever picks up 0025 next,
  or land the home preview update as a small follow-up inside 0025 itself
  (0025's issue file already accounts for this).
- Apply the same annotated pattern everywhere feedback is shown: the live
  Practice Loop feedback pane, a stored Practice Record's feedback
  (`showRecord`), and a Follow-up Question's feedback. The Session Summary
  (mock session) reuses the strength/priority-improvement note pattern but
  has no per-item rating bars — keep it to the note+quote pattern only.

## Acceptance criteria

- [x] The transcript is rendered exactly once per Answer Attempt; no feedback
      item duplicates the learner's sentence into a separate quote block.
- [x] Strength and priority-improvement quotes are marked on the transcript
      with distinct, non-colour-only styles (solid vs. wavy underline) and
      their own text tags (優／改), visible without hovering.
- [x] Each of the four rating quotes is marked with a dotted underline and
      shows its dimension tag (切／據／構／英) when active/hovered/focused.
- [x] Hovering or keyboard-focusing a transcript mark highlights its matching
      note in the feedback pane, and vice versa; this is verified by keyboard
      navigation alone (no mouse).
- [x] A sentence quoted by two different feedback items (e.g. a rating quote
      that overlaps the priority-improvement quote) shows both annotations
      correctly — neither annotation silently disappears or overwrites the
      other. (Construct at least one fixture/manual case with an overlap to
      verify this, since the deterministic fake provider's sample data may
      not naturally produce one.)
- [x] A quote that cannot be located in the transcript degrades to plain text
      for that one item without breaking the rest of the transcript or
      throwing a JS error.
- [x] The four rating bars use only the accent colour; no rating renders in
      red/yellow/green.
- [x] Each Key-Sentence Correction shows an inline diff (deletions and
      insertions marked by style, not colour alone) instead of two separate
      quote blocks, followed by its existing `reasonZh` text.
- [x] The annotated pattern is used consistently in the live Practice Loop
      feedback, a stored Practice Record's feedback view, and Follow-up
      Question feedback.
- [x] No change to `src/model-contracts.js`, `validateFeedback`, or any
      server-side validation — confirm by diffing `src/` against the previous
      commit before finishing.
- [x] `npm test` passes unmodified.
- [x] `npm run test:browser` passes, extended to hover/focus a transcript
      mark and assert its note becomes active (or the reverse).

## Files likely touched

- `public/app.js` (`feedbackHtml`, `finding`, correction rendering, plus a
  new transcript-segmentation/annotation-matching helper)
- `public/style.css` (mark/tag/rate-bar/diff styles from the Design System
  table)
- `public/index.html` (only if new containers are needed inside the feedback
  pane)
- `test/browser-smoke.js` (hover/focus-link assertions)

## How to verify

```
npm test
npm run test:browser
```

Manually run a practice through to feedback with both the fake provider and
(if configured) a real provider, and inspect: no duplicated quote blocks;
each mark's tag; hover/focus linking in both directions; a correction's
inline diff; and that an older, single-language Practice Record (if one
exists in a test workspace) still renders without throwing.

## Blocked by

- [Issue 0023](./0023-practice-workbench-two-pane-and-mobile-tabs.md)

## Comments

2026-09-23: Implemented and automatically verified; visual acceptance by the
creator is pending, hence `awaiting-human-validation`.

- **Where the logic lives.** Segmentation and the word diff are a small pure
  module, `public/annotate.js` (imported by `app.js` as an ES module and added
  to the static allowlist in `src/server.js`; that one line is the only `src/`
  change — no contract, schema, prompt or validator changed). It is covered by
  `test/annotate.test.js` (6 tests) plus a static-asset test.
- **Segmentation rule.** Every quote (strength, priority improvement, the four
  rating quotes, each correction's `original`) is found by exact substring; a
  quote that occurs more than once is anchored at its **first occurrence**.
  The transcript is split into sentences (at `. ! ?` followed by whitespace, and
  at line breaks; they partition the text exactly) and every sentence is cut at
  every quote boundary. A segment inside several quotes carries all their ids
  in `data-notes` and all their styles (`mk-ok` solid underline + fill,
  `mk-warn` wavy, `mk-rate` dotted, `mk-fix` ± tag only); each quote's tag sits
  on its last segment, and rate tags (切／據／構／英) show only while the mark is
  active or focused. Whitespace between sentences is never a mark. Tags and
  sentence numbers are CSS-generated, so the transcript's text (copy,
  `textContent`) is exactly what the learner said.
- **Missing quote.** A quote that cannot be located keeps its note without the
  "↳ 第 N 句" control, shows the quote as plain English text under the note
  (so the evidence is not lost) and logs one `console.warn`; the rest of the
  transcript is annotated normally. Verified with a fixture that mixes
  overlapping, partially overlapping, cross-sentence and missing quotes.
- **Linking.** Marks are `role="button" tabindex="0"` with
  `aria-describedby` pointing at their notes' Chinese text. Hover or focus on
  either side highlights both (state is recomputed from what is hovered and
  what is focused). Enter/click on a mark moves focus to its note (switching to
  回饋 on a phone, opening a rating row); the note's "↳ 第 N 句" button moves
  focus to the mark (switching to 你的回答, opening a collapsed answer) and its
  tooltip carries the exact quote.
- **Ratings.** Four `details.rating.rate` rows: tag, the existing Chinese
  label, a level word (尚未做到／部分做到／大致做到／充分做到, from the mockup),
  a 1–4 bar in `--accent` only (empty segments outlined for contrast) and n/4;
  expanding shows `reasonZh` and the jump control. English reasons stay hidden
  as before — the owner removed the 英文說明 entries (learner-flow-discussion,
  and the smoke asserts they stay gone); the data is unchanged.
- **Corrections.** Each correction is an inline word diff directly under its
  sentence in the answer (`<del>` strikethrough + colour, `<ins>` underline +
  colour; screen readers get the rewrite as one sentence), then the read-aloud
  control and `reasonZh`. The feedback pane keeps a compact "±
  關鍵句修正 N · ↳ 第 N 句" note; a correction whose sentence cannot be located
  shows its diff in that note instead. A rewrite identical to the original
  shows no diff body. Corrections that load after render re-draw the
  transcript in place.
- **Everywhere feedback is shown.** Live and stored Practice Record feedback,
  the revision screen (the priority improvement links into a collapsible
  「查看上一次的回答與回饋標記」 instead of repeating the quote), the before/after
  comparison (one elided word diff instead of two excerpts; heading
  「關鍵句前後對照」 kept), the focus-progress box, the answer-version history
  (older versions annotated; the latest no longer repeats its transcript, only
  its player, since it is already on screen),
  current and previous Follow-up Question feedback, and a Short Mock Session's
  per-question feedback (its transcript inside 「查看你的回答」 is annotated). The
  Session Summary keeps its note+quote cards (issue 0027 restyles it). The
  Illustrative Answer and English Assistance are not annotated.
- **回饋 badge.** Now the number of notes shown for the current answer(s): per
  Feedback Report strength + priority + four ratings, plus each loaded
  Key-Sentence Correction, for the main answer and the current follow-up;
  notes inside the collapsed history are not counted. It updates when
  corrections load and the tab's accessible name reads 「回饋（N 則）」.
- **Home preview.** Issue 0025 has not landed; it should render its sample
  through `annotatedTranscriptHtml`/`feedbackHtml` (or at least these class
  names: `transcript annotated`, `srow`, `mk mk-*`, `tag tag-*`, `note`,
  `rate`, `bar`, `diff`).
- **Smoke / runbook.** `test/browser-smoke.js`: the correction check now
  verifies the stored `original` is verbatim and that each correction note
  links to a transcript mark (the old `.correction-card blockquote` is gone);
  the rating-dedupe check became "quotes are marked, no quote blocks in the
  feedback section, each rating has a bar and a reference" plus a keyboard
  check (reference → mark focused and its note active; Enter on the mark →
  its note focused); the mock per-question wait uses `.note` instead of
  `.feedback-feature`. `docs/creator-validation.zh-TW.md` explains how to read
  the marks and replaces the two 「你的原句」 checks. No ID or button label
  changed.
- **Verification.** `npm test` 187/187; `npm run test:browser` PASS
  (learner-flow screenshots restored; re-baselining is 0028). Walked answer →
  feedback → corrections → 自己再試一次 → revision feedback + comparison →
  follow-up feedback at 1440 and 390 with the fake provider, with a fetch
  fixture for overlapping/missing quotes and a real word-level correction;
  keyboard-only pass over marks, notes and rating rows; no duplicate ids, every
  `aria-describedby` resolves, no horizontal overflow at 390. Screenshots in
  [`docs/verification/ui-redesign-0024/`](../verification/ui-redesign-0024/).
  Contrast: line colours use `--ok`/`--warn`/`--accent` (4.8:1, 5.3:1, 5.4:1
  on their fills) rather than the lighter `-line` tokens.
