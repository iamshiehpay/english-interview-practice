---
status: ready-for-human
---

# Codex evaluation run (v3) and independent AI bilingual semantic review

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

49, 50

## Context

Found while splitting issues (2026-09-24): human labels are keyed by each
review-packet item's `inputChecksum`, which includes the model-generated
question. `evaluation/v3/` has no frozen Codex analysis yet, and the current v3
review packet comes from the offline fake run, so a Codex run regenerates the
questions and changes every checksum. Therefore the Codex run comes **before**
labelling (0036); `next-steps-discussion.md` already records this correction.
`evaluation/review-report.js` rechecks saved reports, semantic reviews, human
labels and the creator ledger with **no model calls**, but it currently asserts
runner version 2.0.0 and may need v3 support.

## What to build

1. Make the offline review step validate v3 artifacts (runner 3.0.0, v3 file
   locations, contract 3.0.0) without weakening any check; keep it free of model
   calls; cover the change with a test on fixture artifacts. Run
   `npm run codex:verify` if any `src/codex-*.js` file changes.
2. After the creator explicitly authorises it in the session, run
   `npm run evaluate -- --codex --accept-subscription-usage` once (about 65
   subscription calls: five analyses, sixty feedback calls). This freezes the v3
   Codex analysis and produces the raw report, review packet and bilingual audit.
3. An independent AI reviewer (a separate agent from the one that ran the
   evaluation) compares all 60 English / Traditional Chinese outputs and writes
   the semantic-review artifact in the accepted shape (schema 2, contract 3.0.0,
   `reviewerType: "ai"`, reviewer, reviewedAt, one entry per case and repeat with
   exact `outputChecksum`, verdict and substantive rationale, contradictory pairs).
4. Run the offline review step and record the result.

## Acceptance criteria

- [ ] The offline review step accepts valid v3 artifacts, rejects tampered or stale ones, and makes no model calls (tested).
- [ ] The Codex run happened exactly once, after the creator's recorded authorisation, and its automated checks and three-repeat stability pass (or failures are recorded under Comments without re-running silently).
- [ ] The frozen v3 Codex analysis and the new review packet are committed.
- [ ] The semantic-review artifact covers all 60 outputs; any `inconsistent` verdict is reported, not overridden.
- [ ] The offline review step shows the semantic-review gate as PASS (human labels and creator gates may still be pending).
- [ ] The server on 4310 was not touched.

## Files likely touched

- `evaluation/review-report.js`, a test for it
- `evaluation/v3/` artifacts (frozen analysis, review packet, bilingual audit, semantic reviews), `evaluation/results/codex-v3.json`

## How to verify

```sh
npm test
node evaluation/review-report.js
```

## Blocked by

None — can start immediately (the Codex run itself waits for the creator's authorisation).

## Comments
