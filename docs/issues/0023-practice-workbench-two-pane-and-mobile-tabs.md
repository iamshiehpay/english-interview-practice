---
status: completed
---

# Practice screen: two-pane desktop workbench, mobile answer/feedback tabs, fixed 結束並保存

## Parent

[PRD — Workbench UI redesign](../prd-ui-redesign.md)

## User stories covered

9, 10, 11, 12, 13, 14

## Context

Today's single-question practice screen (`#practice-view` /
`public/app.js`'s `showQuestion`/`showRecord`/`showCoaching`/follow-up
render functions, roughly lines 364-935) renders question, answer editor,
feedback, follow-ups and corrections as one long scrolling column. At phone
width this produces the ~7300px-tall screen the 2026-09-23 audit measured,
with 「結束並保存」 at the very bottom
(`ui-direction-discussion.md`). This issue rebuilds the *layout* only: it
does not change what data is shown or how feedback is computed (that is
issue 0024's job — this issue can ship with feedback still rendered in its
current, non-annotated form inside the new right pane, and issue 0024
replaces that pane's *content*, not its position).

The job-context breadcrumb slot built in issue 0022 gets populated here with
the truncated job title (reuse `jobTitle(snapshot)` +
`truncate(text, max=60)` from `public/app.js:120,144,261`, the same helper
already used at `public/app.js:1012` for the practice job line, applied
consistently as the PRD requires).

## What to build

- **Desktop ≥1024px**: two-column grid inside `#practice-view` — left pane
  holds the question (English + expandable/visible Chinese meaning, matching
  current behaviour), the answer editor (text and/or voice, unchanged
  components from `public/voice.js`), and the submit control; right pane
  holds the feedback region with a sticky footer containing the primary
  completion action (`#complete-practice` / 結束並保存) and secondary actions
  (follow-up, revision). Feedback pane width: 440px ≥1280px, 400px between
  1024-1279px, per the PRD's responsive rules.
- **<1024px**: single column. Question fixed at the top. Below it, a two-tab
  switcher — 你的回答 / 回饋 (回饋 carries a count badge once feedback
  exists) — showing one pane at a time. 結束並保存 is fixed to the bottom of
  the viewport (`position: sticky` or `fixed` bottom bar) regardless of
  which tab is open or how far the learner has scrolled.
- Populate the breadcrumb/job-context bar (from issue 0022) with the
  truncated job title and a step indicator (題目／作答／回饋／追問可選)
  matching the mockup's `.steps`/`.step` pattern, collapsing to icon-only
  step markers <1280px.
- Preserve every existing element ID that `test/browser-smoke.js` and
  `docs/ui-ux-fixes-2026-09.md` list as load-bearing: `#complete-practice`,
  `#answer`, `#submit-answer`, `#draft-status`, `#next-question`,
  `#recommended-question`, `#practice-complete`, `#feedback-actions`,
  `#follow-up-actions`, `#follow-up-answer`, `#submit-follow-up`,
  `#follow-up-feedback-title`, `#rewrite-result`, `#ideas-result`, and the
  button texts `結束並保存` (inside `#follow-up-actions`), `自己再試一次`,
  `幫我講得更自然`, `讓面試官追問`, `繼續追問`. Where an ID must move to a
  different pane, keep the ID; only its container changes.
- Apply the monospace transcript typeface (`--font-mono`) to the answer
  editor / transcript display, per the PRD's confirmed default.
- Do not change the voice recording panel's own internal markup/behaviour
  (`public/voice.js`) beyond mounting it inside the new left pane.

## Acceptance criteria

- [x] At ≥1024px, the practice screen shows two columns: question+answer on
      the left, feedback (in its existing, pre-0024 form) on the right, with
      結束並保存 always visible without scrolling the right pane past its
      footer.
- [x] At 1024-1279px, the same two-column layout holds with a 400px feedback
      pane and the rail collapsed (from issue 0022); the answer column does
      not become unusably narrow.
- [x] At <1024px, 你的回答 and 回饋 render as two tabs; switching tabs shows
      exactly one pane; the 回饋 tab shows a numeric count once feedback
      exists.
- [x] At <1024px, 結束並保存 stays fixed at the bottom of the viewport while
      scrolling either tab's content.
- [x] The breadcrumb shows the truncated job title (using the existing
      `truncate()` helper) instead of an unbounded title.
- [x] A step indicator shows which of 題目／作答／回饋／追問（可選） the
      learner is on.
- [x] The transcript/answer text renders in the monospace font token.
- [x] Every ID and button text listed in `docs/ui-ux-fixes-2026-09.md`'s
      "Test constraints" section still exists with the same text/ID.
- [x] No horizontal overflow at 390px width.
- [x] A completed Practice Record, a follow-up in progress, and a revision in
      progress each render correctly in both the desktop two-pane and the
      mobile tab layouts (manually spot-check at least one of each).
- [x] `npm test` passes unmodified.
- [x] `npm run test:browser` passes; any selector change needed because a
      container moved is made in this issue.

## Files likely touched

- `public/index.html` (`#practice-view` structural markup)
- `public/app.js` (`showQuestion`, `showRecord`, `showCoaching`, follow-up
  render functions — restructuring their DOM output into the two-pane/tab
  shell; no change to what data they fetch or compute)
- `public/style.css` (workbench pane/tab/sticky-footer layout)
- `public/voice.js` (only if the recording panel's mount point needs a new
  parent selector)
- `test/browser-smoke.js` (selector updates for moved containers)

## How to verify

```
npm test
npm run test:browser
```

Manually walk one full practice (paste JD → answer → feedback → follow-up →
結束並保存) at 1440px, 1200px, and 390px widths, confirming the layout rules
above and that every acceptance-criteria button still works via mouse and
keyboard. Cross-check against `docs/creator-validation.zh-TW.md`'s
step-by-step instructions (section 3) to confirm the described flow still
reads correctly against the new layout.

## Blocked by

- [Issue 0022](./0022-design-tokens-and-app-shell.md)

## Comments

2026-09-23: Implemented and automatically verified; visual acceptance by the
creator is pending, hence `awaiting-human-validation`.

- **Workbench.** `showRecord` now renders one `.workbench` grid: `.wb-question`
  (category chip, English question, read-aloud, 中文題意), `.wb-answer`
  (your answer / editor / voice panel / comparison / follow-up question and
  answer) and `aside.wb-feedback` (`.fb-scroll` + `.fb-foot`). ≥1280px the
  feedback pane is 440px, 1024-1279px 400px (answer column ≈550px at 1024).
  The feedback list scrolls inside the pane (sticky under the topbar) and the
  footer is `position: sticky; bottom: 0`, so 結束並保存 stays on screen.
  In practice mode `main` goes full width beside the rail.
- **Mobile (<1024px).** The same DOM becomes question → sticky
  你的回答／回饋 tabs (`role="tablist"`, ←/→ keys, roving tabindex) → one
  pane. 回饋 shows a count badge (strength + priority + ratings of the shown
  feedback reports). `.fb-foot` is `position: fixed` at the viewport bottom
  and `.app-main` is padded by its measured height. Submitting an answer or a
  follow-up switches to 回饋 and focuses `#feedback-heading` /
  `#follow-up-feedback-title`; a new follow-up opens on 你的回答.
- **Where things went.** Footer: 自己再試一次 (`#revise-actions`),
  `#follow-up-actions` before the first follow-up (讓面試官追問) and after a
  follow-up's feedback (繼續追問 + 結束並保存), and `#complete-practice`;
  in a revision the footer holds 回到回饋，先不修改／保存草稿，稍後再練, and a
  completed record's footer holds `#completed-actions`. While answering a
  follow-up, `#follow-up-actions` stays under the answer box. Feedback
  pane: `#practice-complete`, `#feedback-heading` + existing
  `feedbackHtml`, `#corrections`, `#attempt-history`, follow-up feedback,
  `#feedback-actions` (幫我講得更自然) + `#rewrite-result`, and the focus
  box (`#focus`). During a revision the pane shows the previous feedback
  for reference. Feedback content itself is unchanged (issue 0024).
- **Duplicates removed.** The ghost 結束並保存 beside 送出並取得中文回饋 is
  gone (the footer's `#complete-practice` covers it), and after a
  follow-up's feedback `#complete-practice` is not rendered because
  `#follow-up-actions` carries 結束並保存. No label text changed; every ID
  in `docs/ui-ux-fixes-2026-09.md` "Test constraints" still exists.
- **Topbar.** `setJobContext(jobTitle(snapshot))` fills the breadcrumb with
  `truncate()`d text (60 chars; the full title is the tooltip) on the
  question, question-list and practice screens; the old in-page stepper and
  `.job-line` are gone from practice (the mock session keeps its own
  `.job-line` until issue 0027). New `#crumb-steps` shows
  題目／作答／回饋／追問（可選）, icon-only below 1280px; below 768px the
  crumb shows only the job title. `--topbar-offset` / `--foot-h` are
  measured with a `ResizeObserver` so sticky offsets survive the wrapping
  topbar.
- **Style.** Practice controls use 6-8px radii, 32px (40px mobile) buttons,
  no pills; the learner's answer (`#answer`, `#follow-up-answer`, transcript
  displays, the before/after comparison) uses `--font-mono`.
- **Runbook.** `docs/creator-validation.zh-TW.md` gains one paragraph on
  where the panes, tabs and 結束並保存 are. No existing label changed.
- **Verification.** `npm test` 180/180; `npm run test:browser` PASS with no
  smoke change (learner-flow screenshots restored; re-baselining is 0028).
  Walked answer → feedback → 幫我講得更自然 → revise → follow-up ×2 →
  結束並保存 with the fake provider at 1440, 1200, 1024 and 390: no
  horizontal overflow at 390, the footer's top edge sits at the viewport
  bottom in every state, the sticky tabs sit directly under the topbar, and
  Tab order runs rail → topbar → question → answer pane → feedback pane →
  footer. Screenshots in
  [`docs/verification/ui-redesign-0023/`](../verification/ui-redesign-0023/).
  Not walked by hand: the follow-up feedback retry state (covered by the
  smoke's pending/failure path).
