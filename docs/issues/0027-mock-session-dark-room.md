---
status: ready-for-agent
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

- [ ] The Short Mock Session screen (in-progress and post-session) renders
      with the dark tokens; every other view remains light and unaffected.
- [ ] The category chip, question text, progress indicator, waveform, timer
      and record control are all present and match the mockup's stage
      layout.
- [ ] Listening mode works identically inside the dark room to how it works
      in the light practice screen: off by default, toggle visible only when
      a speech provider can speak, hidden text removed from the accessibility
      tree, "顯示題目" always available while hidden, no auto-reveal on
      audio end, reveal immediately on read-aloud failure.
- [ ] Skipping a question, submitting a recorded or typed answer, and
      advancing to the next question all work exactly as before.
- [ ] The Session Summary (one strength, one priority improvement, each with
      a verbatim quote) and per-question on-demand feedback render correctly
      in the dark surfaces, including the honest "nothing to assess" state
      when every question was skipped.
- [ ] Recording, timer cap (three minutes), and replay of a session answer's
      recording all work unchanged.
- [ ] No dark styling leaks onto any other view when navigating away from
      the mock session.
- [ ] No horizontal overflow at 390px width inside the mock session.
- [ ] `npm test` passes unmodified.
- [ ] `npm run test:browser` passes, including the existing full-session walk
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
