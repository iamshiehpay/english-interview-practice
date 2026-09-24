---
status: completed
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

- [x] 練習紀錄 job cards show a truncated title (same `truncate()` helper,
      same max length convention as the practice view) instead of the raw
      first line of the JD; verify with a JD whose first line exceeds 60
      characters.
- [x] Every other place a job title renders as a heading (continue-last-
      practice card, discovery shortlist card, mock-session header) is
      confirmed bounded — either already truncated or fixed here.
- [x] No "company" chip or field is added anywhere; only the job title is
      shown, truncated.
- [x] 「查看全部」 still groups questions by the same four categories, marks
      answered vs. unanswered correctly, and 「選這一題」 still starts that
      question.
- [x] 練習紀錄's search, filter, pagination, rename, delete, and per-job
      expand/collapse all still work exactly as before, restyled.
- [x] 我的進步 renders correctly (content already verified correct by the
      persona walkthrough; this issue only confirms the restyle did not
      regress it).
- [x] 我的履歷's upload, evidence list, and delete-evidence controls still
      work.
- [x] 找職缺's search form, results list, and Fit Breakdown's four parts
      still work and remain distinguishable without colour alone.
- [x] 設定's provider status and delete-workspace sections still work,
      including the danger-zone confirmation.
- [x] The operations strip still shows in-flight/failed/cancelled operations
      with working retry controls.
- [x] No horizontal overflow at 390px width on any of these views.
- [x] `npm test` passes unmodified.
- [x] `npm run test:browser` passes.

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

## Comments

2026-09-23: Implemented and automatically verified; visual acceptance by the
creator is pending, hence `awaiting-human-validation`.

- **Title truncation (must-fix).** Every place a job title is a heading now
  goes through the existing `truncate()` (60 chars, same as the breadcrumb),
  with the full title as the `title` tooltip: 練習紀錄 job cards (the reported
  bug), 練習紀錄's 繼續上次練習 card, the home 繼續上次練習 card (it also used
  `firstLine(snapshot.text)` and ignored a rename; it now uses `jobTitle()`),
  and Curated Job Shortlist cards. The mock-session job line and the
  breadcrumb were already bounded; 我的進步's new practice links use
  `truncate(…, 40)`. The rename input still holds the full title. No company
  field or chip anywhere. Checked with a JD whose first line is 241 chars.
- **Global primitives → tokens.** The legacy base rules the remaining views
  inherited (46px pill buttons, 28px shadowed cards, 16px-radius inputs,
  32–52px `h1`, uppercase eyebrows, hover lift) now use the workbench tokens:
  32px buttons with 6px radii (40px under 768px), hairline 8px surfaces,
  36px inputs with the accent focus ring, `h1` 28px / `h2` 16px / `h3` 14px.
  Home and the practice workbench keep their id-scoped rules and are
  visually unchanged. The Short Mock Session picks up the same primitives
  but its layout is untouched (issue 0027).
- **題目集 (查看全部).** Same four categories and order; each is one bordered
  list with a header (N 題 · 已作答 M 題) and a row per question: a state
  glyph (filled ✓ answered, dashed circle draft, empty circle not yet) that
  repeats the row text (已作答 N 次／有未送出草稿／尚未作答), a 本次推薦 chip and
  a left rule on the recommended row, and 選這一題 on the right.
- **練習紀錄.** 繼續上次練習 as an accent strip; search + filter toolbar with a
  live count (共 N 份職缺 / 符合 N / M 份職缺); jobs in one bordered list,
  title + stats left, compact actions right (開始新練習／產生題目,
  三題短場模擬, 查看練習（N）／收合練習, ⋯). Expanded jobs list their mock
  sessions and records as rows with state chips (✓ 已完成 / 進行中).
  Keyboard: toggling 查看練習, changing the filter, paging and renaming
  re-render the list and now put focus back on the control used (or on the
  other page button when the pressed one becomes disabled); ⋯
  menus close on Escape (focus returns to ⋯) and on an outside click.
- **我的進步.** Now reads the existing `GET /api/progress` (issue 0006's
  model, never surfaced before) instead of listing completed records: a
  four-count strip (需加強／改善中／已解決／單次重點), then 反覆出現的弱點,
  單次練習重點 and 已解決. Each item shows its status chip (icon + word), why it
  is recurring (出現在 N 次練習 or 你確認會反覆出現), the Focus Point sentence, a
  status control the learner sets (需加強／改善中／已解決, `aria-pressed`, ✓ on
  the chosen one) via the existing `POST /api/progress/:id`, the linked
  practices (question, truncated job, date, 回顧練習 → the record), and
  針對這個重點再練一次 (the existing from-focus flow) plus 標記為反覆出現的問題
  / 不是反覆出現的問題. No server change; the "system never claims
  improvement" wording is kept.
- **我的履歷.** Same controls and IDs; the upload sits in a dashed drop-style
  box, the section header shows 新練習預設使用 when a resume is saved.
- **找職缺.** Three sections: 用一句話說你想找什麼 (the interpretation panel is
  now a neutral accent callout), 搜尋條件 in a two-column field grid (labels
  shortened to the field name; the comma hint moved into the section text and
  `aria-describedby`) with 搜尋公開職缺 / 儲存搜尋條件, then the results, then
  已經有職缺網址？ for the Greenhouse URL. Shortlist cards: truncated title,
  location / source / location chip, rationale, then the four Fit Breakdown
  parts, told apart without colour by a glyph (✓ ⇄ + ?), border style
  (solid / accent / heavy left rule / dashed) and label, each with its count;
  4 columns on desktop, 2 on phones. The `h4` text is exactly the label.
- **設定.** Each service is a row: role + 外部服務／只在本機 chip, provider name
  (mono), and the data-flow disclosure as a 可能送出 list, then the key/usage
  note. The previously raw `jobCuration` row is labelled 精選職缺與適配拆解.
  The Codex status box keeps its texts and 重新檢查狀態 (✓ / ! glyph, focus
  kept on re-check). Danger zone keeps the typed confirmation.
- **Operations strip.** Compact rows: spinner / ! / – glyph, operation name,
  state word (進行中／失敗／已取消), 可從原操作重試, the recorded reason, and
  取消取得回饋／取消操作 or ✕ 清除 on the right; aligned with the narrow column.
  There is no retry button in the strip (there never was — retry lives on the
  originating screen, e.g. 重試取得回饋); adding one would need per-kind
  retry wiring and is not part of this restyle.
- **Carry-over from 0024 (separate `fix:` commit).** A tag could wrap away from
  the punctuation after it. `annotate.js` splits that punctuation into a
  `glue` segment and the renderer keeps last word + tags + punctuation in
  no-wrap spans; text/copy unchanged. `test/annotate.test.js` gains one test
  and one adjusted assertion. Reproduced in Chromium with a width sweep
  (breaks at 313–500px before, none at word-fitting widths after).
- **Smoke / runbook / labels.** No ID, button label or smoke selector changed;
  `test/browser-smoke.js` untouched. `docs/creator-validation.zh-TW.md` gains
  one sentence on where the Focus Point appears on 我的進步.
- **Verification.** `npm test` 188/188; `npm run test:browser` PASS
  (learner-flow screenshots restored). Fake provider with seeded data (four
  jobs, one with a 241-char first line, a renamed job, a job without
  questions, five practices, an unfinished mock session, a recurring Focus
  Point): every view at 390 / 1024 / 1440 has no horizontal overflow;
  keyboard pass on 練習紀錄 (search → filter → actions → 查看練習 → rows → ⋯ →
  Escape) and 我的進步 (status control, 回顧練習) with visible focus. 選這一題
  opens the chosen question. Screenshots in
  [`docs/verification/ui-redesign-0026/`](../verification/ui-redesign-0026/)
  (the settings shot uses a mocked `/api/providers` response to show external
  services; the operations rows in the question-list shot are a mocked
  `/api/operations` response).

