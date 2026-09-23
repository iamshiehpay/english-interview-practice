---
status: ready-for-agent
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

- [ ] At ≥1024px, the practice screen shows two columns: question+answer on
      the left, feedback (in its existing, pre-0024 form) on the right, with
      結束並保存 always visible without scrolling the right pane past its
      footer.
- [ ] At 1024-1279px, the same two-column layout holds with a 400px feedback
      pane and the rail collapsed (from issue 0022); the answer column does
      not become unusably narrow.
- [ ] At <1024px, 你的回答 and 回饋 render as two tabs; switching tabs shows
      exactly one pane; the 回饋 tab shows a numeric count once feedback
      exists.
- [ ] At <1024px, 結束並保存 stays fixed at the bottom of the viewport while
      scrolling either tab's content.
- [ ] The breadcrumb shows the truncated job title (using the existing
      `truncate()` helper) instead of an unbounded title.
- [ ] A step indicator shows which of 題目／作答／回饋／追問（可選） the
      learner is on.
- [ ] The transcript/answer text renders in the monospace font token.
- [ ] Every ID and button text listed in `docs/ui-ux-fixes-2026-09.md`'s
      "Test constraints" section still exists with the same text/ID.
- [ ] No horizontal overflow at 390px width.
- [ ] A completed Practice Record, a follow-up in progress, and a revision in
      progress each render correctly in both the desktop two-pane and the
      mobile tab layouts (manually spot-check at least one of each).
- [ ] `npm test` passes unmodified.
- [ ] `npm run test:browser` passes; any selector change needed because a
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
