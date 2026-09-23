---
status: awaiting-human-validation
---

# Home redesign: five-second hero, flow strip, static feedback preview

## Parent

[PRD — Workbench UI redesign](../prd-ui-redesign.md)

## User stories covered

1, 2, 3, 4

## Context

Today's `#home-view` (`public/app.js`'s `renderHome`, around line 270) is
mainly a single JD textarea; a first-time visitor cannot tell what the
product does before pasting something. The mockup's home view
(`index.html:895-920`) adds a hero (eyebrow, heading, lead paragraph), a
four-step flow strip (貼上職缺／依職缺出題／開口回答／逐句回饋), and a static
feedback-preview panel showing what a Feedback Report looks like — all next
to the existing JD input, not replacing it.

The mockup's JD box also shows a "貼上 JD / 104 網址" segmented input-mode
toggle. Per the PRD (`Out of Scope`), this is dropped: the real app has no
URL-fetch capability, and a button that cannot do anything is not shipped.
Only the existing "貼上 JD" text path is offered.

## What to build

- Add the hero block above or beside the existing JD form: eyebrow text,
  an `<h1>`, a lead paragraph, and the four-step flow strip, matching the
  mockup's copy and tone (adapt wording only if it does not fit the real
  product's copy voice — the structure and step count are the requirement,
  not verbatim text).
- Keep the existing `#jd` textarea, its label, its placeholder, and its
  existing behaviour (`#capture` button, resume-choice, difficulty details,
  `#provider-gate`, `#generation-disclosure`) unchanged — restyle only.
- Do not add the mockup's "104 網址" segmented toggle; the JD box offers only
  the current single text-input mode.
- Add a static feedback-preview panel using a **fixed sample object** baked
  into `public/app.js` (or a small JSON literal near `renderHome`): one
  sample question, one short transcript excerpt, one strength note, one
  priority-improvement note, and the four rating bars, rendered with the
  same annotated-feedback markup/CSS classes issue 0024 introduces (reuse
  those classes rather than inventing a second feedback-rendering path).
  Clearly label the panel as an example (e.g. "回饋會長這樣" + a "範例" tag)
  so it is never mistaken for the learner's own data. It must make no
  network request.
- Preserve the existing "continue last practice" card
  (`#resume-practice`/`#home-progress`) and its logic exactly; restyle it
  into the new layout without changing when it appears or what it shows.
- If issue 0024 has already landed, reuse its transcript-mark/rating-bar
  classes directly for the preview. If issue 0024 has not yet landed when
  this issue is implemented, build the preview against the *planned* class
  names from the Design System table so 0024 does not need to touch this
  file again — coordinate with whichever issue lands second to confirm the
  class names actually match.

## Acceptance criteria

- [ ] The home page shows an eyebrow, a heading, a lead paragraph, and a
      four-step flow strip above/beside the JD form, in the new tokens.
- [ ] A visitor can identify what the product does (paste a job description →
      get job-grounded questions → answer by voice or text → get
      transcript-grounded Chinese feedback) without scrolling, at both
      1440px and 390px.
- [ ] The existing `#jd` textarea, its label/placeholder text, `#capture`,
      resume-choice, difficulty details, and `#generation-disclosure` are
      present and functionally unchanged.
- [ ] No "104 網址" or any other job-input mode beyond pasted JD text is
      shown.
- [ ] A static feedback-preview panel is visible, clearly labelled as a
      fixed example, shows the annotated-mark pattern (or, if this issue
      lands before 0024, the planned mark classes), and makes zero network
      requests (confirm via devtools Network tab with the panel visible).
- [ ] The "continue last practice" card still appears exactly when it did
      before (an unfinished Practice Record or session exists) and still
      links to the correct resume target.
- [ ] No horizontal overflow at 390px width.
- [ ] `npm test` passes unmodified.
- [ ] `npm run test:browser` passes; the existing home-page flow assertions
      (`fill('#jd', …); click('#capture'); …`) still work unmodified since no
      ID referenced by them changed.

## Files likely touched

- `public/app.js` (`renderHome`, plus the new static preview data/renderer)
- `public/index.html` (`#home-view` structural markup)
- `public/style.css` (hero/flow-strip/preview layout)

## How to verify

```
npm test
npm run test:browser
```

Load the home page cold (empty workspace) and confirm the five-second
legibility goal by inspection; confirm the preview panel triggers no network
request; confirm the existing "貼 JD → 產生題目" flow still works end to end.

## Blocked by

- [Issue 0022](./0022-design-tokens-and-app-shell.md)

Not blocked by 0024, but coordinate class names with it (see **What to
build**) since both touch the feedback-preview markup.

## Comments

2026-09-23: Implemented and automatically verified; visual acceptance by the
creator is pending, hence `awaiting-human-validation`.

- **Layout.** `#home-view` is now `#resume-practice` (unchanged logic, still
  first) → `.home-grid`: left `.home-main` = `.home-hero` (eyebrow, `<h1
  id="home-title">`, lead, `ol.flow` with 貼上職缺／依職缺出題／開口回答／逐句回饋)
  + the JD form; right `figure.home-preview`. Two columns at ≥1024px (flow
  strip 4×1 at ≥1280px, 2×2 below), one column below 1024px with the preview
  after the form. `#home-progress` stays under the grid.
- **JD form.** Same controls, IDs, label, placeholder and order (`#jd`,
  `#resume-choice`, difficulty `<details>`, `#generation-disclosure`,
  `#provider-gate`, `#capture`); restyled with the tokens (hairline card,
  mono textarea, 6px buttons, full-width `#capture`). The form's decorative
  eyebrow 「開始新練習」 was dropped (the hero has its own); `#start-title`
  「你想準備哪個職缺？」 stays. Copy adapted from the mockup: step 1 says
  「貼上職缺描述全文」 (no 104 URL) and step 3 「錄音或打字都可以」. No 104-URL
  toggle, no other input mode.
- **Preview.** `homePreviewSample` in `public/app.js` (a fictional backend
  question, a three-sentence transcript, strength, priority improvement and
  four ratings) is registered with `registerAnnotation('home-sample', …)` and
  rendered once by `renderHomePreview()` through `annotatedTranscriptHtml`
  (with the legend) and `feedbackHtml` — the same markup and classes as the
  practice screen, so it follows 0024's layout automatically. One rating
  (論據與例子) is shown expanded. It makes no request (only the app's usual
  `/api/providers`, `/api/health`, `/api/workspace`, `/api/operations` were
  loaded). The panel is labelled 「回饋會長這樣」 + a 「範例」 chip + 「固定的示範內容，
  不是你的練習資料。」; its body is `inert`, so none of its marks/notes/rating
  rows take focus or clicks, and screen readers get a text summary via the
  figure's `aria-describedby`.
- **用範例職缺試試 not added.** Neither the PRD nor this issue asks for it and
  `examples/` holds no fictional JD (only a fictional resume).
- **Smoke / runbook.** Because the preview puts four `.ratings .rating` rows
  in the DOM, the two practice rating checks in `test/browser-smoke.js` are
  scoped to `#practice-view`; one assertion was added on the home page (four
  flow steps, an inert labelled preview with marks and rating bars). No ID or
  label changed. `docs/creator-validation.zh-TW.md` gains one paragraph on
  where things are on the home page and that the 範例 panel is not the
  learner's data.
- **Verification.** `npm test` 187/187; `npm run test:browser` PASS
  (learner-flow screenshots restored; re-baselining is 0028). Fake provider,
  empty workspace: at 1440×900 `#capture` ends at y≈809 (above the fold); at
  1024 and 390 no horizontal overflow; at 390×844 hero and flow strip are
  visible without scrolling and `#capture` is one short scroll away. With an
  unfinished record the 繼續上次練習 card appears first and 繼續練習 reopens it
  (at 1440 `#capture` then sits just below the fold). Keyboard: topbar →
  `#jd` → 調整題目深度 → `#capture`, nothing in the preview is reachable.
  Screenshots in
  [`docs/verification/ui-redesign-0025/`](../verification/ui-redesign-0025/).
