---
status: awaiting-human-validation
---

# Verification: browser smoke sync, new screenshots, creator-validation label sync

## Parent

[PRD — Workbench UI redesign](../prd-ui-redesign.md)

## User stories covered

(Closes out the PRD's Testing/Verification Decisions; no new user-facing
story of its own.)

## Context

Issues 0022-0027 land the redesign incrementally, each keeping `npm test`
and `npm run test:browser` green as they go. This issue is the final sweep:
confirm the whole app is consistent end to end, replace every stale
pre-redesign screenshot, and sync the two documents that hard-code
screen-region descriptions and selectors:

- `test/browser-smoke.js` — full pass to confirm nothing across the six
  preceding issues interacts badly in combination (e.g. a selector two
  issues both touched).
- `docs/creator-validation.zh-TW.md` — the runbook the creator uses to
  validate the product; it already references 我的進步 (line 172/174) as if
  it were reachable, and describes screen regions ("頁面最上方那條系統
  列（logo 列下方那一行）", settings sections, etc.) that must still match
  the redesigned layout.
- `docs/verification/` — `docs/verification/ui-redesign/*.png` and any other
  screenshot referenced from a `docs/verification/*.md` file predate this
  redesign and must be replaced or clearly marked superseded.

## What to build

- Run `npm run test:browser` end to end against the fully redesigned app (all
  of 0022-0027 landed) and fix any interaction issue found only when all
  views are combined.
- Re-read `docs/creator-validation.zh-TW.md` in full and update every passage
  that:
  - describes a nav path (confirm 我的進步 instructions now match a real,
    working click path — no more DOM workaround needed);
  - describes a screen region by position ("最上方", "最底部", etc.) that the
    two-pane/mobile-tab layout moved;
  - describes the 練習紀錄 job card title (confirm the truncation fix is
    reflected if the runbook says anything about it).
  Do not change any *behavioural* instruction (what to type, what to click,
  what result to expect) — only wording tied to the old visual layout.
- Take a fresh set of screenshots (desktop 1440px, mobile 390px, at minimum:
  home, practice two-pane with feedback, mobile answer/feedback tabs, dark
  mock session, and 練習紀錄 with a truncated title visible) using the same
  isolated-workspace/fake-provider approach `docs/verification/ui-redesign/`
  used previously, and save them under a new `docs/verification/` subfolder
  (e.g. `docs/verification/ui-redesign-2026-09/`).
- Write `docs/verification/0022.md` through `docs/verification/0027.md` (or
  one combined `docs/verification/ui-redesign-2026-09.md` covering all six,
  following this repo's existing per-issue verification-doc convention,
  whichever the implementing agent finds cleaner given how the issues were
  actually landed) recording: what was tested, `npm test`/`npm run
  test:browser` results, and links to the new screenshots. Mark the old
  `docs/verification/ui-redesign.md` and its `ui-redesign/` screenshots as
  superseded by adding a one-line note at the top pointing to the new
  evidence, without deleting the historical record (the tracker convention
  is to append, not rewrite history).
- Update each of issues 0022-0027's own `status` front matter to
  `awaiting-human-validation` (or `completed`, matching how 0017/0021 were
  closed out) once their acceptance criteria are all checked, and update
  `docs/issues/README.md`'s status column for each.

## Acceptance criteria

- [x] `npm test` passes with the fully redesigned app.
- [x] `npm run test:browser` passes end to end, exercising: home, a full
      practice loop (desktop and mobile-tab layouts), annotated feedback
      (including a hover/focus-link check), a follow-up, 練習紀錄 with a
      truncated job title, 我的進步 reached via the nav, the dark mock
      session (including listening mode and a skip), and no horizontal
      overflow anywhere at 390px.
- [x] `docs/creator-validation.zh-TW.md` no longer describes any screen
      region or nav path that does not match the redesigned app; the 我的
      進步 step is confirmed reachable exactly as the runbook instructs, with
      no workaround needed.
- [x] New 1440px and 390px screenshots exist for at least: home, practice
      (desktop two-pane), practice (mobile tabs), dark mock session, and
      練習紀錄 with a visibly truncated title.
- [x] `docs/verification/ui-redesign.md` (the 2026-09-18 evidence) is marked
      superseded rather than deleted or silently left to look current.
- [x] Each of issues 0022-0027 has its acceptance criteria fully checked and
      its status updated; `docs/issues/README.md`'s table reflects the final
      statuses.
- [x] A final read of `public/index.html`, `public/style.css`, `public/app.js`
      and `public/voice.js` confirms no leftover reference to the old token
      names (`--ink`, `--paper`, `--mist`, `--teal`, `--coral`, `--yellow`)
      remains anywhere.

## Files likely touched

- `test/browser-smoke.js`
- `docs/creator-validation.zh-TW.md`
- `docs/verification/ui-redesign.md` (superseded-note)
- `docs/verification/0022.md` … `docs/verification/0027.md` (or one combined
  doc) and their screenshot assets
- `docs/issues/README.md` (status column)

## How to verify

```
npm test
npm run test:browser
```

Manually walk `docs/creator-validation.zh-TW.md` section 3 (the five
practices) against the redesigned app end to end, confirming every
instruction still matches what is on screen, before marking this issue done.

## Blocked by

- [Issue 0022](./0022-design-tokens-and-app-shell.md)
- [Issue 0023](./0023-practice-workbench-two-pane-and-mobile-tabs.md)
- [Issue 0024](./0024-annotated-feedback.md)
- [Issue 0025](./0025-home-redesign.md)
- [Issue 0026](./0026-remaining-views.md)
- [Issue 0027](./0027-mock-session-dark-room.md)

## Comments

2026-09-24: Implemented and automatically verified; visual acceptance by the
creator is pending, hence `awaiting-human-validation`. Full record:
[`docs/verification/ui-redesign-v2.md`](../verification/ui-redesign-v2.md).

- **Evidence doc.** One combined doc (`ui-redesign-v2.md`, like
  `learner-flow-v3.md`) instead of per-issue files, since 0022-0027 each
  recorded their own verification in their issue comments and screenshot
  folders. `ui-redesign.md` has a superseded note at the top.
- **Fix: tags inside a word.** A quote that stops mid-word ("…I would aim to l"
  of "learn", from the fake Session Summary) drew its tags between "l" and
  "earn", and up to eight piled up there. The highlight still covers exactly
  the quote; the tags move to the end of that word (`tagPosition()` in
  `public/annotate.js`: letters, digits and an apostrophe between letters form
  the word; Han/kana are not pushed along) and stay non-breaking with it and
  any punctuation after it (0026's glue rule). More than three tags at one spot
  collapse to the first two + `+N` (`collapseTags()`); the group is
  `role="img"` with an accessible name and tooltip listing every note. Rating
  tags outside a mark follow their `.tags` group's linked state. Four new tests
  in `test/annotate.test.js`.
- **Fix: 顯示題目 focus (from 0021).** `voice.js` moved focus to the revealed
  question heading (`tabindex="-1"`) instead of `blur()`ing to `body`; checked
  on the question screen, the practice screen and the mock room.
- **Smoke.** Added: home in the light scheme; `.room` only inside `#mock-view`,
  dark, theme-color switched, and reverting to `#FAFAFA` with no `room-mode`
  after leaving; `#mock-record` renamed on start; listening mode + reveal
  focus in the room; 我的進步 from the rail with counts matching
  `/api/progress`; a 98-character renamed job truncated on its 練習紀錄 card;
  no overflow at 390 on home and in the room. Full-page screenshots lay the
  sticky shell and feedback pane out statically through a constructed
  stylesheet adopted only for the capture (the CSP blocks an injected
  `<style>`), and `docs/verification/learner-flow/` was re-baselined on purpose
  (home, feedback, mobile, new mock).
- **Legacy tokens.** The alias declarations (`--ink`, `--paper`, `--mist`,
  `--teal`, `--coral`, `--yellow`, `--sky`, `--line`, `--mint`, `--shadow`)
  are gone from `:root` and `.room`; every use names its workbench token.
  Re-running the smoke gave byte-identical screenshots.
- **Real model.** Codex on a temporary workspace, 3 Codex operations (analysis,
  feedback first attempt, corrections) on JD 02 with a 156-word typed answer:
  all 8 quotes linked verbatim, no unlinked-quote warnings, no mid-word quote,
  sentence text equals the transcript, no overflow at 390. Screenshots in
  [`docs/verification/ui-redesign-0028/`](../verification/ui-redesign-0028/).
- **Runbook.** Walked with the fake provider; wording fixed for: mock session
  entry (練習紀錄 card, dark room, not part of validation), 設定 at the bottom
  of the rail / icon rail, depth select inside 調整題目深度, operations strip rows
  (取得回饋 · 進行中 / 已取消, ✕ 清除), retry / answer history / Focus Point box
  / 結束並保存 in the feedback pane and its footer, 我的進步 counts, tag
  placement and `+N`. Added the measured JD 02 generation time (~2 min 45 s).
  Rules sections and behavioural instructions unchanged.
- **Screenshots AC.** Fresh 1440/390 shots across this round: home
  (`ui-redesign-0025/`, `learner-flow/home.png`), practice two-pane
  (`learner-flow/feedback.png`, `ui-redesign-0028/02`), practice mobile tabs
  (`learner-flow/mobile.png`, `ui-redesign-0028/04`, `05`), dark mock
  (`ui-redesign-0027/`, `learner-flow/mock.png`), 練習紀錄 with a truncated
  title (`ui-redesign-0026/history-1440.png`, `history-390.png`).
- **0022-0027.** Their acceptance criteria are all checked (0025's boxes had
  been left unticked although its comment records each check; ticked here).
  They stay `awaiting-human-validation` until the creator accepts them.
- **Verification.** `npm test` 191/191; `npm run test:browser` PASS.
- **Open.** Real-microphone waveform and real audio playback unverified;
  Safari/Firefox untested; the real-model pass did not cover follow-ups, a
  revision or the mock session. JD 02 pasted without its header gets the job
  title 「[Job Overview]」 until renamed. Once during the real-model run the page
  was found back on home after generation finished (analysis succeeded; likely
  the browser tool reloading after a daemon error; not reproduced).
