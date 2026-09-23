---
status: ready-for-agent
---

# Remaining views: 題目集／練習紀錄（標題截短）／我的進步／我的履歷／找職缺／設定／操作列

## Parent

[PRD — Workbench UI redesign](../prd-ui-redesign.md)

## User stories covered

(No new stories beyond the PRD's general navigation/consistency goals; this
issue exists to close the gap so no view is left in the old visual language.)

## Context

Issues 0022-0025 restyle the app shell, the practice workbench, feedback, and
home. This issue restyles everything else to the same tokens so the app does
not end up half-migrated: the question-list view (「查看全部」/
`showQuestionList`), 練習紀錄 (`renderHistory`/`renderJobDetail`), 我的進步
(`renderProgress`), 我的履歷 (`renderEvidence`), 找職缺
(`renderDiscovery`/`renderShortlist`), 設定 (`renderSettings`), and the
operations strip (`showOperations`).

This issue also fixes the second explicit "must fix": the 練習紀錄 job card
title bug. `public/app.js:1250` renders
`` `<h3>${escape(job.title)}</h3>` `` where `job.title` comes from
`jobTitle(snapshot)` (`public/app.js:1144`,
`snapshot?.title || firstLine(snapshot?.text)`), with no truncation — unlike
`public/app.js:1012`'s practice-view job line, which already wraps the same
call in `truncate()`. Per the PRD's **Further Notes**, there is no structured
"company" field anywhere in the data model (confirmed: no `company` in
`src/*.js` or `public/app.js`; the mockup's company text is fabricated sample
data), so the fix is to truncate the title consistently — not to add a
company chip that has no real data behind it.

## What to build

- Apply `truncate()` (the existing helper, `public/app.js:261`, already used
  at line 1012) to `job.title` at `public/app.js:1250` and to every other
  untruncated `jobTitle(snapshot)` usage that renders as a heading (check
  lines 1202 and 1361 area too — the "continue last practice" card and the
  discovery shortlist card — for the same unbounded-length risk, and
  truncate any that are not already bounded).
- Restyle `showQuestionList` (「查看全部」, `public/app.js:394`), preserving
  its existing grouping by Question Category, card structure, and the
  「選這一題」 control text, in the new tokens/type scale/spacing.
- Restyle `renderHistory`/`renderJobDetail` (list, filter, search, pager,
  per-job expansion, rename flow) in the new tokens, keeping every existing
  control and its text (`重新命名`, `查看練習（N）`/`收合練習`, `上一頁`/
  `下一頁`, etc.) unchanged.
- Restyle `renderProgress` in the new tokens; content/logic unchanged (it is
  now reachable via issue 0022's nav fix — this issue only restyles what is
  already there).
- Restyle `renderEvidence` (resume upload, evidence list) in the new tokens;
  behaviour unchanged.
- Restyle `renderDiscovery`/`renderShortlist` (job search profile form, fit
  breakdown cards) in the new tokens; behaviour unchanged. Ensure the fit
  breakdown's four parts (matched／transferable／gaps／unknown) remain
  visually distinct without relying on colour alone, consistent with the
  PRD's accessibility rule, even though this content is not "feedback
  annotation" in the issue 0024 sense.
- Restyle `renderSettings` (provider status, delete-workspace) in the new
  tokens; behaviour unchanged.
- Restyle the operations strip (`showOperations`, `#operations`) in the new
  tokens; behaviour unchanged.
- Keep all of these views inside the narrow single-column pattern the
  mockup implies for non-practice pages (they are not two-pane workbenches).

## Acceptance criteria

- [ ] 練習紀錄 job cards show a truncated title (same `truncate()` helper,
      same max length convention as the practice view) instead of the raw
      first line of the JD; verify with a JD whose first line exceeds 60
      characters.
- [ ] Every other place a job title renders as a heading (continue-last-
      practice card, discovery shortlist card, mock-session header) is
      confirmed bounded — either already truncated or fixed here.
- [ ] No "company" chip or field is added anywhere; only the job title is
      shown, truncated.
- [ ] 「查看全部」 still groups questions by the same four categories, marks
      answered vs. unanswered correctly, and 「選這一題」 still starts that
      question.
- [ ] 練習紀錄's search, filter, pagination, rename, delete, and per-job
      expand/collapse all still work exactly as before, restyled.
- [ ] 我的進步 renders correctly (content already verified correct by the
      persona walkthrough; this issue only confirms the restyle did not
      regress it).
- [ ] 我的履歷's upload, evidence list, and delete-evidence controls still
      work.
- [ ] 找職缺's search form, results list, and Fit Breakdown's four parts
      still work and remain distinguishable without colour alone.
- [ ] 設定's provider status and delete-workspace sections still work,
      including the danger-zone confirmation.
- [ ] The operations strip still shows in-flight/failed/cancelled operations
      with working retry controls.
- [ ] No horizontal overflow at 390px width on any of these views.
- [ ] `npm test` passes unmodified.
- [ ] `npm run test:browser` passes.

## Files likely touched

- `public/app.js` (`showQuestionList`, `renderHistory`, `renderJobDetail`,
  `renderProgress`, `renderEvidence`, `renderDiscovery`, `renderShortlist`,
  `renderSettings`, `showOperations`, and the `truncate()` call sites)
- `public/index.html` (view containers' structural markup, as needed)
- `public/style.css` (narrow single-column view styles)

## How to verify

```
npm test
npm run test:browser
```

Manually visit each of the seven views listed above, using a JD whose first
line is long (to exercise the title-truncation fix), and confirm every
existing control still works. Cross-check
`docs/creator-validation.zh-TW.md` section 3's references to 練習紀錄 and
設定 screen regions still match what is on screen.

## Blocked by

- [Issue 0022](./0022-design-tokens-and-app-shell.md)
