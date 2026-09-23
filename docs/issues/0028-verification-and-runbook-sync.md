---
status: ready-for-agent
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

- [ ] `npm test` passes with the fully redesigned app.
- [ ] `npm run test:browser` passes end to end, exercising: home, a full
      practice loop (desktop and mobile-tab layouts), annotated feedback
      (including a hover/focus-link check), a follow-up, 練習紀錄 with a
      truncated job title, 我的進步 reached via the nav, the dark mock
      session (including listening mode and a skip), and no horizontal
      overflow anywhere at 390px.
- [ ] `docs/creator-validation.zh-TW.md` no longer describes any screen
      region or nav path that does not match the redesigned app; the 我的
      進步 step is confirmed reachable exactly as the runbook instructs, with
      no workaround needed.
- [ ] New 1440px and 390px screenshots exist for at least: home, practice
      (desktop two-pane), practice (mobile tabs), dark mock session, and
      練習紀錄 with a visibly truncated title.
- [ ] `docs/verification/ui-redesign.md` (the 2026-09-18 evidence) is marked
      superseded rather than deleted or silently left to look current.
- [ ] Each of issues 0022-0027 has its acceptance criteria fully checked and
      its status updated; `docs/issues/README.md`'s table reflects the final
      statuses.
- [ ] A final read of `public/index.html`, `public/style.css`, `public/app.js`
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
