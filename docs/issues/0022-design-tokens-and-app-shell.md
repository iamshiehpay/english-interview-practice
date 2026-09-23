---
status: ready-for-agent
---

# Design tokens and app shell (left rail with 我的進步, top job-context bar, fonts, CSP)

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

`src/server.js:750` sends a CSP with no `font-src` and `style-src 'self'`,
which blocks the Google Fonts `<link>` the mockup uses. The PRD's decision
(see `docs/prd-ui-redesign.md`, "Fonts and Content-Security-Policy") is to
keep the Google Fonts link and widen the CSP by exactly `style-src
https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`,
alongside a system-font fallback that is already present in the token
definitions.

## What to build

- Copy the design tokens from
  `docs/design/mockups/workbench-annotated-feedback/index.html`'s `:root`
  block into `public/style.css` (or a new `public/tokens.css` imported by it —
  either is fine as long as there is exactly one source of truth), replacing
  the existing `--ink`/`--paper`/`--mist`/`--teal`/etc. tokens. Keep the same
  custom-property names as the mockup so later issues can be copy-pasted
  faithfully.
- Add the Google Fonts `<link rel="preconnect">`/`<link rel="stylesheet">`
  tags to `public/index.html` exactly as in the mockup (Inter, JetBrains
  Mono, Noto Sans TC weights the mockup loads), and update `--font-ui`,
  `--font-zh`, `--font-mono` to the mockup's stacks (each already ends in a
  system-font fallback chain).
- Update `src/server.js`'s CSP header (around line 750) to add
  `style-src 'self' https://fonts.googleapis.com;` and `font-src 'self'
  https://fonts.gstatic.com;`, changing no other directive.
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

- [ ] `public/style.css` defines the full token set from the mockup's `:root`
      (neutrals, accent, semantic feedback colours, font stacks, type scale,
      radii, spacing, shadow) under the same custom-property names.
- [ ] The Google Fonts link loads Inter, JetBrains Mono and Noto Sans TC; if
      the request is blocked (simulate by disabling the stylesheet in
      devtools or removing network access), the page still renders legibly in
      the system-font fallback with no invisible text.
- [ ] `src/server.js`'s CSP header includes `style-src 'self'
      https://fonts.googleapis.com` and `font-src 'self'
      https://fonts.gstatic.com`, and no other directive is loosened.
- [ ] The main navigation shows 開始練習／找職缺／練習紀錄／我的進步／我的履歷／
      設定, each reachable by mouse click and by keyboard (Tab + Enter).
- [ ] Clicking 我的進步 (or its mobile-menu equivalent) navigates to
      `#progress-view` and calls `renderProgress()`, exactly as
      `data-view="history"` already calls `renderHistory()`.
- [ ] The rail collapses to icon-only between 1024px and 1279px width (all six
      destinations still present and operable) and is replaced by a compact
      menu at <1024px (all six destinations still present and operable).
- [ ] No view shows horizontal overflow at 390px width.
- [ ] Existing `data-view` values (`home`, `discovery`, `history`, `evidence`,
      `settings`) are unchanged; every existing `nav [data-view="..."]`
      selector in `test/browser-smoke.js` still matches, or is updated in
      this issue if the wrapping element changed.
- [ ] `npm test` passes unmodified (this issue makes no server-behaviour
      change beyond the CSP header, which no existing test asserts against a
      stricter value — confirm this before finishing).
- [ ] `npm run test:browser` passes, updated if any selector this issue
      touches requires it.

## Files likely touched

- `public/style.css` (tokens; rail/breadcrumb/nav layout)
- `public/index.html` (nav markup, font links, theme-color)
- `public/app.js` (nav wiring only — `navigate()`, `markView()`, the
  `data-view` query, and whatever minimal glue makes `progress` navigable;
  not the view-render bodies)
- `src/server.js` (CSP header, ~line 750)
- `test/browser-smoke.js` (only if a nav selector's DOM path changes)
- `README.md` / `.env.example` (one line noting the new outbound font
  request, if either file documents outbound network behaviour today)

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
confirm in devtools' Network tab that `fonts.googleapis.com` and
`fonts.gstatic.com` requests succeed under the new CSP (previously they would
have been blocked and reported in the console).

## Blocked by

None — this is the first slice.
