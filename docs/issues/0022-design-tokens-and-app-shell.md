---
status: awaiting-human-validation
---

# Design tokens and app shell (left rail with 我的進步, top job-context bar, self-hosted fonts)

## Parent

[PRD — Workbench UI redesign](../prd-ui-redesign.md)

## User stories covered

5, 6, 7, 8, 26, 27

## Context

This is the foundation slice: it lands the workbench design tokens and
reshapes the app-level chrome (`public/index.html`'s `<header>`/`<nav>` and
`public/app.js`'s view-switching) into the mockup's left-rail + top
breadcrumb pattern, without yet touching the per-view content (that is
issues 0023-0027). It also fixes the one navigation defect the PRD calls out
explicitly: 「我的進步」 has no entry point anywhere today.

Today `public/index.html`'s `<nav>` has five buttons
(開始練習／找職缺／練習紀錄／我的履歷／設定), each `data-view="..."`, wired
by `public/app.js:230,253` (`document.querySelectorAll('[data-view]')`). The
`#progress-view` section and its `renderProgress()` function
(`public/app.js:248,1278`; `public/index.html:67-71`) already work — they are
simply unreachable by any element with `data-view="progress"`. The confirmed
mockup's own illustrative rail (`index.html:769-780`) does not include a
「我的進步」 entry either; this issue deliberately adds one beyond what the
mockup shows, because the PRD requires it independently of the mockup.

> **Owner decision 2026-09-23 (overrides the original font/CSP plan below):**
> do **not** load Google Fonts and do **not** widen the CSP. A Google Fonts
> request on every page load would contact a third party regardless of
> practice activity, conflicting with ADR 0013 (local-first, minimal data
> sharing). Instead, self-host Latin-subset `woff2` files for Inter and
> JetBrains Mono under `public/fonts/` (with their OFL licence texts), declare
> them with `@font-face` + `font-display: swap`, and use the system CJK stack
> for Chinese. See `docs/prd-ui-redesign.md`, "Fonts and
> Content-Security-Policy".

`src/server.js:750` sends a CSP with no `font-src`, so fonts fall back to
`default-src 'self'`, which already permits same-origin font files. The only
server change is serving the font files with `Content-Type: font/woff2`.

## What to build

- Copy the design tokens from
  `docs/design/mockups/workbench-annotated-feedback/index.html`'s `:root`
  block into `public/style.css` (or a new `public/tokens.css` imported by it —
  either is fine as long as there is exactly one source of truth), replacing
  the existing `--ink`/`--paper`/`--mist`/`--teal`/etc. tokens. Keep the same
  custom-property names as the mockup so later issues can be copy-pasted
  faithfully.
- Self-host Inter (400/500/600/700) and JetBrains Mono (400/500) as
  Latin-subset `woff2` files in `public/fonts/` with their OFL licence texts;
  declare them with `@font-face` and `font-display: swap`; set `--font-ui`,
  `--font-zh`, `--font-mono` to stacks that put the system CJK fonts
  (`"PingFang TC"`, `"Noto Sans TC"`, `"Microsoft JhengHei"`) right after the
  Latin face. No Google Fonts `<link>`. *(2026-09-23 decision; replaces the
  Google Fonts link.)*
- Serve the font files from `src/server.js`'s static handler with
  `Content-Type: font/woff2`; leave the CSP header unchanged. *(2026-09-23
  decision; replaces widening `style-src`/`font-src`.)*
- Rebuild the header/nav markup in `public/index.html` into the rail pattern:
  brand mark, primary 開始練習 entry, then 找職缺／練習紀錄／我的進步（NEW）／
  我的履歷 as `data-view` items, 設定 pinned at the bottom. Keep every
  existing `data-view` value unchanged (`home`, `discovery`, `history`,
  `evidence`, `settings`) and add `data-view="progress"` to the new button.
  Keep the wrapping landmark as `<nav aria-label="主要導覽">` (or update every
  `nav [data-view="..."]` selector in `test/browser-smoke.js` in this same
  issue if the landmark tag changes) so existing automation keeps matching
  unless deliberately updated here.
- Add the responsive rail behaviour: full rail (with labels) ≥1280px,
  icon-only rail 1024-1279px, replaced by a compact menu control <1024px, per
  the mockup's breakpoints.
- Add a top job-context bar (breadcrumb) area above the main content that
  practice-related views (issue 0023) will populate with the truncated job
  title; this issue only needs to build the shell/slot and confirm it renders
  emptily outside a job context (e.g. on 找職缺／設定).
- Update `<meta name="theme-color">` in `public/index.html` to the new
  `--canvas` value; the dark mock room's own theme-color handling is issue
  0027's concern.
- Do not touch `public/app.js`'s view-render functions themselves (home,
  practice, history, etc.) beyond what is needed to keep `navigate()` working
  against the new nav markup — that is the later issues' job.

## Acceptance criteria

- [x] `public/style.css` defines the full token set from the mockup's `:root`
      (neutrals, accent, semantic feedback colours, font stacks, type scale,
      radii, spacing, shadow) under the same custom-property names.
- [x] Self-hosted Inter and JetBrains Mono load from `/fonts/*.woff2`
      (served as `font/woff2`); if the font requests are blocked, the page
      still renders legibly in the system-font fallback with no invisible
      text. Chinese uses the system CJK stack. *(2026-09-23 decision.)*
- [x] `src/server.js`'s CSP header is unchanged and the page makes no
      third-party request. *(2026-09-23 decision; replaces widening the CSP.)*
- [x] The main navigation shows 開始練習／找職缺／練習紀錄／我的進步／我的履歷／
      設定, each reachable by mouse click and by keyboard (Tab + Enter).
- [x] Clicking 我的進步 (or its mobile-menu equivalent) navigates to
      `#progress-view` and calls `renderProgress()`, exactly as
      `data-view="history"` already calls `renderHistory()`.
- [x] The rail collapses to icon-only between 1024px and 1279px width (all six
      destinations still present and operable) and is replaced by a compact
      menu at <1024px (all six destinations still present and operable).
- [x] No view shows horizontal overflow at 390px width.
- [x] Existing `data-view` values (`home`, `discovery`, `history`, `evidence`,
      `settings`) are unchanged; every existing `nav [data-view="..."]`
      selector in `test/browser-smoke.js` still matches, or is updated in
      this issue if the wrapping element changed.
- [x] `npm test` passes unmodified (this issue makes no server-behaviour
      change beyond serving the font files).
- [x] `npm run test:browser` passes, updated if any selector this issue
      touches requires it.

## Files likely touched

- `public/style.css` (tokens; rail/breadcrumb/nav layout)
- `public/index.html` (nav markup, theme-color)
- `public/fonts/` (self-hosted Latin woff2 + OFL licence texts)
- `public/app.js` (nav wiring only — `navigate()`, `markView()`, the
  `data-view` query, and whatever minimal glue makes `progress` navigable;
  not the view-render bodies)
- `src/server.js` (static handler: serve `/fonts/*.woff2` as `font/woff2`; CSP unchanged)
- `test/browser-smoke.js` (only if a nav selector's DOM path changes)

## How to verify

```
npm test
npm run test:browser
node -e "new URL('http://localhost'); "  # sanity: no syntax errors after edits
```

Manually load the app, resize the window through 1440 → 1200 → 900 → 390px,
and confirm the rail/menu behaviour and that 我的進步 is reachable and
renders the same content the persona walkthrough already verified as correct
(`docs/verification/persona-walkthrough-2026-09-23.md`, finding 1). Also
confirm in devtools' Network tab that the only font requests are
same-origin `/fonts/*.woff2` and that no third-party origin is contacted.

## Blocked by

None — this is the first slice.

## Comments

2026-09-23: Implemented and automatically verified; visual acceptance by the
creator is pending, hence `awaiting-human-validation`.

- **Tokens.** `public/style.css` `:root` now holds the mockup's full token set
  under the same names (plus `--rail-w`/`--topbar-h`). The old
  `--ink`/`--paper`/`--mist`/`--teal`/… names remain only as aliases of the
  new tokens so views not yet restyled follow the new palette; the warm
  hard-coded hex values in view rules were mapped to tokens. Per-view layout
  (card radii, spacing, type scale) is untouched and left to 0023-0027.
- **Fonts (2026-09-23 decision).** `public/fonts/` holds Inter 400/500/600/700
  and JetBrains Mono 400/500 Latin woff2 (`@fontsource/*` 5.3.0, ~140 KB
  total) plus `LICENSE-Inter.txt` / `LICENSE-JetBrainsMono.txt` (SIL OFL 1.1).
  `@font-face` uses `font-display: swap` and a Latin `unicode-range`. No
  Google Fonts link; the CSP is byte-for-byte unchanged. With every font
  request aborted the page still renders in the system fallback.
- **Server.** The static handler serves an explicit allowlist of the six font
  files as `font/woff2` (nothing else under `public/fonts/` is reachable).
  New `test/static-assets.test.js` asserts the MIME type, the unchanged CSP
  and that `index.html`/`style.css` reference no `http(s)://` origin.
- **Shell.** `<header class="site-header">` + `.system-strip` were replaced by
  `<aside class="rail">` (brand button + `<nav id="primary-nav"
  aria-label="主要導覽">`) and a sticky `<header class="topbar">` holding the
  menu button, a `<nav class="crumb" aria-label="目前位置">` breadcrumb
  (`#crumb-view` + an empty, hidden `#crumb-job` slot that
  `setJobContext(title)` fills — issue 0023 wires it) and the service status
  (`#provider`) + 資料傳送說明. The rail's primary entry uses class
  `nav-primary` (not the mockup's `primary`) to avoid the global
  `button.primary` style. 我的進步 (`data-view="progress"`) is new.
- **Responsive.** ≥1280px full 224px rail; 1024-1279px 56px icon rail (labels
  visually hidden, still in the accessibility tree, plus `title` tooltips);
  <1024px the rail becomes an off-canvas drawer opened by `#menu-toggle`
  (`aria-expanded`, scrim click and Escape close it, choosing a destination
  closes it); <768px the service status wraps to a second topbar line.
- **Unchanged contracts.** All `data-view` values and every
  `nav [data-view="..."]` selector in `test/browser-smoke.js` still match
  (the rail's `<nav>` is first in the DOM); no smoke change was needed.
  `docs/creator-validation.zh-TW.md` now describes the service status as
  "頂列右側" instead of the removed "系統列" and notes where the rail/menu is.
- **Verification.** `npm test` 180/180 pass; `npm run test:browser` PASS.
  Screenshots at 1440/1200/390 (home, 我的進步, mobile drawer) in
  [`docs/verification/ui-redesign-0022/`](../verification/ui-redesign-0022/).
  Keyboard: Tab from the top of the page reaches 我的進步 and Enter opens
  `#progress-view` with the breadcrumb reading 我的進步. No horizontal
  overflow on any rail destination at 390px.
