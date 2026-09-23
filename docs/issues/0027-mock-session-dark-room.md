---
status: awaiting-human-validation
---

# Short Mock Session: dark interview room

## Parent

[PRD — Workbench UI redesign](../prd-ui-redesign.md)

## User stories covered

22, 23, 24, 25

## Context

Per the confirmed 2026-09-23 direction, the dark room (mockup direction D) is
scoped to the three-question Short Mock Session only
(`#mock-view`/`public/app.js`'s `startMockSession`/`showMockSession`/
`renderMockSummary`, roughly lines 994-1130). Every other view stays in the
light workbench theme from issues 0022-0026; this issue must not leak dark
styling outside `.room`-scoped markup.

The mock session's existing capabilities — the per-question stage, listening
mode (issue 0021's toggle, `public/voice.js`'s `listeningMode`
export/listener pattern), skipping, per-question feedback on demand, and the
Session Summary — are unchanged in behaviour. This issue restyles the
container they render into.

## What to build

- Scope the dark tokens (`--m-bg`, `--m-surface`, `--m-raised`, `--m-border`,
  `--m-text`, `--m-muted`, `--m-accent`, `--m-accent-soft`, `--m-rec`,
  `--m-rec-soft`) to a `.room` class wrapping `#mock-view`'s content only, as
  in the mockup's `:root .room{...}` block. Add `color-scheme: dark` on that
  scope.
- Rebuild the in-progress session screen as the mockup's `.stage` pattern:
  category chip, large question text, the listening-mode "顯示題目"/hidden
  state (reuse issue 0021's existing DOM/ARIA behaviour — hidden text removed
  from the accessibility tree, announced state change — inside the dark
  scope), a progress indicator (`N` of 3, dot/segment style), the
  waveform/timer/record-button console for the answer, and a skip control.
- Reuse the recording, transcription, and submission logic from
  `public/voice.js` unchanged; only its mounting container and visual theme
  change.
- Restyle the post-session Session Summary and per-question feedback view
  (`renderMockSummary`) to the dark room's surfaces, reusing the same
  strength/priority-improvement note pattern from issue 0024 (no per-item
  rating bars are needed here — the Session Summary has none today and this
  issue does not add any).
- Update the page's `theme-color` meta (or apply a scoped equivalent) only
  while `#mock-view` is active, then restore the light `--canvas` value on
  navigating away, so the browser chrome does not stay dark outside the mock
  session.
- Do not build the mockup's `.room[data-scheme="system"]` light variant — out
  of scope per the PRD.

## Acceptance criteria

- [x] The Short Mock Session screen (in-progress and post-session) renders
      with the dark tokens; every other view remains light and unaffected.
- [x] The category chip, question text, progress indicator, waveform, timer
      and record control are all present and match the mockup's stage
      layout.
- [x] Listening mode works identically inside the dark room to how it works
      in the light practice screen: off by default, toggle visible only when
      a speech provider can speak, hidden text removed from the accessibility
      tree, "顯示題目" always available while hidden, no auto-reveal on
      audio end, reveal immediately on read-aloud failure.
- [x] Skipping a question, submitting a recorded or typed answer, and
      advancing to the next question all work exactly as before.
- [x] The Session Summary (one strength, one priority improvement, each with
      a verbatim quote) and per-question on-demand feedback render correctly
      in the dark surfaces, including the honest "nothing to assess" state
      when every question was skipped.
- [x] Recording, timer cap (three minutes), and replay of a session answer's
      recording all work unchanged.
- [x] No dark styling leaks onto any other view when navigating away from
      the mock session.
- [x] No horizontal overflow at 390px width inside the mock session.
- [x] `npm test` passes unmodified.
- [x] `npm run test:browser` passes, including the existing full-session walk
      (start → answer → skip → summary → open one question's feedback) and
      the listening-mode assertions, both now exercised against the dark
      markup.

## Files likely touched

- `public/app.js` (`startMockSession`, `showMockSession`, `renderMockSummary`
  — structural markup only, no logic change)
- `public/index.html` (`#mock-view` container, theme-color handling)
- `public/style.css` (`.room` scope and its component styles)
- `public/voice.js` (only if the listening-mode mount point needs a new
  selector inside the dark scope)

## How to verify

```
npm test
npm run test:browser
```

Manually run one full Short Mock Session (three questions, including at
least one skip) with the fake provider, and one with listening mode enabled,
confirming the acceptance criteria above at 1440px and 390px. Confirm the
browser's own chrome/theme-color reverts to light after leaving the session.

## Blocked by

- [Issue 0022](./0022-design-tokens-and-app-shell.md)
- [Issue 0024](./0024-annotated-feedback.md) (reuses its note pattern for the
  Session Summary)

## Comments

2026-09-24: Implemented and automatically verified; visual acceptance by the
creator is pending, hence `awaiting-human-validation`.

- **Scope.** Every mock screen (question, waiting for the summary, Session
  Summary) renders inside one `div.room` in `#mock`. `.room` holds the
  mockup's `--m-*` tokens and `color-scheme: dark`, and re-points the
  workbench token names (`--surface`, `--text`, `--accent`, `--ok`, …, the
  legacy aliases and `--hair`, which must be re-declared because a custom
  property that uses `var()` resolves where it is declared) at the room
  palette, so shared buttons, inputs, chips, notes, marks, rating bars and
  the voice panel go dark without copies. Room-only values the mockup does not
  define: `--m-border-strong #62626E` (input/control outline, 3.05:1 on
  `--m-surface`, 3.27:1 on `--m-bg`), `--m-text-2 #C4C4CC`, and dark
  `--ok #4ADE80` / `--warn #F5B453` / `--del #F97066` with 16% fills. The
  rail and topbar stay light; `body.room-mode` only makes `main` full width.
  `markView` sets `theme-color` to `#0B0B0E` for the mock view and back to
  the shipped `#FAFAFA` for every other view (checked by navigating away:
  `#FAFAFA`, no `room-mode`, no dark surface). No `data-scheme="system"`
  variant.
- **Question screen.** Room top strip: 三題短場模擬, one progress segment
  per question (done / outlined when skipped / accent for the current one)
  beside `.mock-progress` 「第 N / 3 題」, and 先離開，稍後繼續. The job moved
  to the topbar breadcrumb (`setJobContext`), as on the practice screen; the
  old `.job-line` is gone. Stage: category chip + 第 N 題, the question at
  32px (22px on phones), the read-aloud tools, 中文題意 (now collapsed by
  default, as in the mockup). Listening mode is issue 0021's code unchanged
  (the checkbox is drawn as a switch); while the question is hidden a dashed
  stand-in says so (`aria-hidden`, since the read-aloud status and 顯示題目
  already carry it). Checked in the room: off → on, play hides question and
  meaning, no reveal when audio ends, 顯示題目 reveals, a failed `/api/speech`
  reveals with 「朗讀失敗，已顯示題目」. The mock read-aloud slot is now
  `#mock-read-aloud`: the old `#question-read-aloud` duplicated the practice
  screen's id, so after any practice the mock's controls were mounted into
  the hidden practice view.
- **Console and recorder.** Waveform, `00:00 / 03:00` timer, one round
  record control (`#mock-record`, visible label = accessible name:
  開始錄音 → 停止並轉成文字 → 正在轉成文字… / 重新錄音), a state hint, the
  「整場結束後才會給回饋」 rule, the answer box (`#mock-answer`, mono), then
  跳過這一題 and 送出，下一題. The control drives voice.js's own recorder:
  voice.js's start/stop buttons (now classed `voice-start`/`voice-stop`/
  `voice-retry`, the only voice.js change) and its clock stay in the DOM,
  hidden in the room, and a MutationObserver mirrors their state, so the
  three-minute cap, transcription, retry, preview and 捨棄錄音，改用文字 are
  exactly those of every other answer path. It uses `aria-disabled` while
  busy, so focus stays on it through start → stop → transcribe. Announcements:
  voice.js's own status (正在錄音… / 正在轉成文字… / 已轉成文字 / limit reached)
  plus a visually hidden status that says 「快到 3 分鐘上限了…」 once; the timer
  itself is not live. The waveform draws the input level voice.js already
  measures (its `progress.voice-level`), sampled every ~80ms — no new audio
  analysis; where no level can be measured it only "breathes" in one phase,
  never a fake waveform. Below the console, 「用語音回答」 keeps the microphone,
  level note, local preview, status, retry, discard and the data-flow
  disclosure. After 捨棄錄音，改用文字 the room hides waveform/timer/record and
  says 已改用打字作答.
- **Session Summary (dark).** The issue asks for the post-session screen in
  the dark surfaces, so it stays in the room. ≥1024px: 整場回饋 (sticky) on
  the left, 逐題 on the right; stacked below. The two findings use the 0024
  note pattern (`note note-ok/warn`, 優／改 tag) and keep the
  `.feedback-feature .feedback-card` classes the smoke counts. Because
  `validateMockSummary` guarantees each quote is a verbatim substring of one
  session answer, each note shows its quote and a 「↳ 第 N 題・第 M 句」
  control; the quote is also marked in that question's annotated answer
  (new `extraNotes` on `registerAnnotation`), linked both ways by the 0024
  hover/focus/Enter behaviour (the jump opens 查看你的回答). A quote is
  anchored at the first answer containing it. Per-question answers render
  with `annotatedTranscriptHtml` (with legend) and feedback with
  `feedbackHtml`; skipped questions are dashed 已跳過 cards; the all-skipped
  「沒有可以評的內容」 state renders in the room.
- **Contrast (WCAG AA).** `--m-text` 15.7:1 on `--m-surface`; `--m-muted`
  7.3 / 6.8 / 6.3:1 on bg / surface / raised; `--m-accent` 7.3:1 on surface
  and 5.9:1 on `--m-accent-soft` (chips); `--m-text-2` 10.6:1; ok / warn /
  del text 10.5 / 10.1 / 6.6:1 on surface; `--m-text` on the 16% fills
  ≥11.9:1; record dot `--m-rec` 4.9:1 on surface; focus ring (2px
  `--m-accent`) 7.8:1 on bg; placeholder uses `--m-muted`. Hairlines
  (`--m-border`, 1.3:1) are decorative only.
- **Keyboard.** Tab order in the room: 先離開 → 朗讀題目 → speed → listening
  switch → 中文題意 → record → answer box → 跳過 → 送出 → 捨棄錄音; all with a
  visible `--m-accent` ring (the record control rings its circle). Enter
  starts and stops recording with focus kept on the control. Summary: refs,
  marks, notes and rating rows as in 0024.
- **Unchanged contracts.** No ID, button label or smoke selector changed;
  `test/browser-smoke.js` and `docs/creator-validation.zh-TW.md` untouched.
  No backend change.
- **Verification.** `npm test` 188/188; `npm run test:browser` PASS
  (learner-flow screenshots restored). With the fake providers on a temp
  workspace, walked start → Q1 typed → Q2 recorded (synthetic microphone) →
  Q3 skipped → summary → 看這一題的回饋 → summary quote jump, plus an
  all-skipped session and discard-to-text, at 1440 and 390, listening mode on
  and off; no horizontal overflow at 390. Near-limit was checked by shifting
  the clock (announced once at 02:36). Not verified: a real microphone's
  level waveform (headless audio reports level 0, so the bars stay flat) and
  real audio playback. Screenshots in
  [`docs/verification/ui-redesign-0027/`](../verification/ui-redesign-0027/).
- **Left for 0028.** Browser smoke still drives the room through the same
  selectors; it could add dark-room assertions (`.room` scoped, theme-color
  reverts, `#mock-record` label changes). The learner-flow screenshots have
  no mock shot yet. The runbook does not describe the mock screen.
