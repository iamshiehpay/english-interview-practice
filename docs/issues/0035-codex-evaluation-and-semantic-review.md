---
status: needs-info
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
2. Run (pre-authorised by the creator on 2026-09-24 for exactly one run)
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

- [x] The offline review step accepts valid v3 artifacts, rejects tampered or stale ones, and makes no model calls (tested).
- [x] The Codex run happened exactly once under the pre-authorisation, and its automated checks and three-repeat stability pass (or failures are recorded under Comments without re-running silently).
- [ ] The frozen v3 Codex analysis and the new review packet are committed.
- [ ] The semantic-review artifact covers all 60 outputs; any `inconsistent` verdict is reported, not overridden.
- [ ] The offline review step shows the semantic-review gate as PASS (human labels and creator gates may still be pending).
- [x] The server on 4310 was not touched.

## Files likely touched

- `evaluation/review-report.js`, a test for it
- `evaluation/v3/` artifacts (frozen analysis, review packet, bilingual audit, semantic reviews), `evaluation/results/codex-v3.json`

## How to verify

```sh
npm test
node evaluation/review-report.js
```

## Blocked by

None — can start immediately.

## Comments

### 2026-09-24 — Single authorized run failed before inference; never retried

- Step 1 implemented by `backend-developer`, independently verified by `test-automator` (7/7 focused tests, 216/216 full suite) and `reviewer` (Standards PASS, step-1 Spec PASS). A preflight metadata gap was fixed before execution: the reader now verifies the Codex provider/model/effort/tier, CLI version, ephemeral session and frozen-analysis policy, alongside strict v3 artifact/hash checks.
- The pre-authorized command `npm run evaluate -- --codex --accept-subscription-usage` was launched exactly once after source capture. [Attempt record](../verification/0035-codex-evaluation-attempt.md), [log](../verification/0035-codex-evaluation.log), and [source manifest](../verification/codex-v3-model-run-source.json) preserve the attempt. Source checksum `9e88cabc5cdc4a81f9546ea9b8aa75d7af439e8c75bd8cc9858407899740d8d5` matches the raw report.
- Outcome: installed CLI 0.156.1 failed the reviewed-macOS-binary hash guard (reviewed builds cover 0.154.0/0.155.1). All 15 local analysis attempts returned HTTP 503 before RPC construction; zero feedback calls, zero outputs, zero frozen analyses. `automatedPass:false`, stability 0/0, 16 recorded failures. The logging pipeline's `tee` exit 0 is not an evaluation success. No automatic rerun occurred and none is authorized by the original one-shot allowance.
- No 60-output semantic review can honestly be written from this run. `node evaluation/review-report.js` fails on the missing frozen analysis, as expected. The raw failed report and empty packet/audit are retained strictly as failure evidence, not accepted evaluation artifacts. No AI or human approval is fabricated.
- The app on 4310 was not contacted or controlled; the runner used isolated temporary workspaces and ephemeral test servers. Binary rejection before RPC supports that no model inference request was reached.
- Follow-ups: [0038](./0038-review-codex-cli-01561-compatibility.md) for reviewed executable compatibility, and [0039](./0039-reject-empty-bilingual-audit-pass.md) for the misleading `automaticPass:true` on the empty bilingual audit. Raw release checks fail correctly; neither follow-up is fixed in passing.

### Final disposition — needs-info

- The first preflight review failed provider-metadata coverage, which was fixed and independently passed. The subsequent whole-issue check failed on the terminal one-shot runtime outcome. After debugger root-cause review and the original developer's final no-retry audit, the third independent verification/review confirmed Standards PASS but overall Spec FAIL: criteria 1, 2 (recorded-failure alternative), and 6 supported; criteria 3–5 unmet.
- Commit the new offline checker and explicitly failed artifacts for traceability, not as a successful Codex dataset. Resolving compatibility alone cannot create missing outputs or authorize another run. Fresh explicit authorization is required after reviewed compatibility is available. No semantic reviewer or label approver has approved any nonexistent output.
