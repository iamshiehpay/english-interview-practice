---
status: completed
---

# Job-search page states that only Greenhouse is searched

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

1, 2, 3, 4

## Context

In-app job discovery only searches public Greenhouse job boards. 104 is reachable
only through the developer's job104 MCP, and in-app scraping is ruled out (site
structure changes, terms of service, ADR 0013). Learners currently cannot tell
that 104, LinkedIn or Cake postings will never appear.

## What to build

One secondary-text line on the job-search view, near the search request, reading
exactly 「目前只搜尋 Greenhouse；104、LinkedIn、Cake 的職缺請直接貼上 JD。」, styled
with the existing design tokens and readable at phone width. No other behaviour
changes.

## Acceptance criteria

- [x] The job-search view shows the exact copy above near the search request.
- [x] The line uses existing secondary-text tokens and wraps cleanly at 360 px width without horizontal scroll.
- [x] Browser smoke asserts the copy on the job-search view.
- [x] `npm test` and `npm run test:browser` pass.

## Files likely touched

- `public/app.js` (job-search view), possibly `public/styles.css`
- `test/browser-smoke.js`

## How to verify

```sh
node --check public/app.js
npm test
npm run test:browser
```

## Blocked by

None — can start immediately.

## Comments

### 2026-09-24 — AI implementation and independent verification

- Implemented by `frontend-developer`; independently verified by `test-automator` and reviewed by `reviewer` using code-review (Standards PASS, Spec PASS; no findings).
- `node --check public/app.js`, `npm test` (202/202), and `npm run test:browser` passed. Initial sandbox loopback binding failed with `listen EPERM`; the authorized isolated rerun passed. The developer first observed the new copy assertion fail before adding the note.
- Independent agent-browser check on a temporary workspace and own server at 360 px: exact copy, matching existing secondary text colour, two readable lines, note client/scroll widths 279/279 px, document width 345 <= 360 px. Own browser session and server were closed; 4310 was never contacted.
- Scope is static disclosure only; live Greenhouse availability was not tested and is outside this change. No new out-of-scope defect was found.
