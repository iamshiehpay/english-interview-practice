---
status: ready-for-agent
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

- [ ] The transcript is rendered exactly once per Answer Attempt; no feedback
      item duplicates the learner's sentence into a separate quote block.
- [ ] Strength and priority-improvement quotes are marked on the transcript
      with distinct, non-colour-only styles (solid vs. wavy underline) and
      their own text tags (優／改), visible without hovering.
- [ ] Each of the four rating quotes is marked with a dotted underline and
      shows its dimension tag (切／據／構／英) when active/hovered/focused.
- [ ] Hovering or keyboard-focusing a transcript mark highlights its matching
      note in the feedback pane, and vice versa; this is verified by keyboard
      navigation alone (no mouse).
- [ ] A sentence quoted by two different feedback items (e.g. a rating quote
      that overlaps the priority-improvement quote) shows both annotations
      correctly — neither annotation silently disappears or overwrites the
      other. (Construct at least one fixture/manual case with an overlap to
      verify this, since the deterministic fake provider's sample data may
      not naturally produce one.)
- [ ] A quote that cannot be located in the transcript degrades to plain text
      for that one item without breaking the rest of the transcript or
      throwing a JS error.
- [ ] The four rating bars use only the accent colour; no rating renders in
      red/yellow/green.
- [ ] Each Key-Sentence Correction shows an inline diff (deletions and
      insertions marked by style, not colour alone) instead of two separate
      quote blocks, followed by its existing `reasonZh` text.
- [ ] The annotated pattern is used consistently in the live Practice Loop
      feedback, a stored Practice Record's feedback view, and Follow-up
      Question feedback.
- [ ] No change to `src/model-contracts.js`, `validateFeedback`, or any
      server-side validation — confirm by diffing `src/` against the previous
      commit before finishing.
- [ ] `npm test` passes unmodified.
- [ ] `npm run test:browser` passes, extended to hover/focus a transcript
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
