---
status: ready-for-agent
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

- [ ] The job-search view shows the exact copy above near the search request.
- [ ] The line uses existing secondary-text tokens and wraps cleanly at 360 px width without horizontal scroll.
- [ ] Browser smoke asserts the copy on the job-search view.
- [ ] `npm test` and `npm run test:browser` pass.

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
