# Issue 0035: independent artifact verification

Independent verifier: Codex AI `/root/attest0034` (not the agent that ran the
subscription evaluation). Checked 2026-09-24 after the additional authorized
attempt reached a terminal outcome. This audit uses saved artifacts and offline
code only; it made no model calls.

## Saved attempt and provenance

- The [attempt-2 record](0035-codex-evaluation-attempt-2.md) reports one launch,
  terminal shell exit `0` with `pipefail`, and a raw report timestamp of
  `2026-09-24T07:01:37.894Z`. The [unique log](0035-codex-evaluation-attempt-2.log)
  ends with `automatedPass: true`, stability `80/80`, and `releaseStatus:
  "BLOCKED"` for pending reviews. The saved log supports that terminal outcome;
  a file audit alone cannot prove the absence of an unlogged invocation.
- I rehashed every one of the seven files in the
  [first-failure archive manifest](0035-attempt-1-failed/manifest.json). All
  sizes and SHA-256 hashes match. The archive records that no frozen analysis
  existed in attempt 1. The original failed evidence remains distinct from the
  successful canonical files.
- The selected standalone Codex CLI 0.155.1 binary hashes to
  `8eaf1ad12fe6bf89b1710330f58900014322c7c5af677e43be116d8ac5fc0a9e`,
  matching the preflight record. The raw report identifies the Codex subscription
  provider, model `gpt-5.6-luna`, `xhigh` effort, `priority` service tier,
  ephemeral sessions, and the frozen-analysis policy.
- The [source capture](codex-v3-model-run-source.json) and raw report both carry
  ordered source checksum
  `9e88cabc5cdc4a81f9546ea9b8aa75d7af439e8c75bd8cc9858407899740d8d5`.
  I recomputed the current ordered hash and individual protected model-file
  hashes; all still match the capture.

## Artifact and offline checks

- The raw report has five analysis calls, sixty feedback calls, sixty unique
  case/repeat results, `automatedPass: true`, no failures, and rating stability
  `80/80`. The frozen analysis has five entries, review packet twenty unique
  cases, and bilingual audit sixty cases with automatic checks passing.
- `reviewArtifacts` accepted the saved artifacts through all automatic
  revalidation checks. Read-only mutations of cloned inputs were rejected for
  changed raw source checksum, protected model source, frozen analysis size,
  review-packet input checksum, bilingual-audit output checksum, and false
  provider identity. These probes did not alter canonical artifacts.
- `npm test`: **216/216 passed**, zero failures. The test runner bound its own
  ephemeral localhost listeners under the approved sandbox escalation.
- `node evaluation/review-report.js`: exit `1`, output bilingual gate
  `PENDING`, evaluation labels `PENDING`, creator `PASS`, release `BLOCKED`.
  This is the expected pre-semantic-review state. The script did not call a
  model. It wrote `evaluation/results/codex-v3-reviewed.json` as the offline
  report.

The independent reviewer is still assessing all sixty English / Traditional
Chinese outputs. I will rerun the offline report after that artifact is saved;
the current `PENDING` result is not counted as final 0035 acceptance.

## Final semantic artifact recheck

The independent reviewer's delivered `/private/tmp/0035-semantic-reviews.json`
and canonical `evaluation/v3/semantic-reviews.json` have the same SHA-256:
`55d63c80d2ea46d31288c9566816f965cce8625b3bcc6f3eafe9a185d61acc2c`.
The artifact declares schema 2, contract 3.0.0, `reviewerType: "ai"`, and
identifies independent reviewer `/root/review0031`, distinct from the run
agent. Its sixty unique reviews exactly cover and bind to the sixty raw
`caseId`/`repeat`/`outputChecksum` combinations. Every entry has a nonempty
rationale and a `contradictoryPairs` array. The reviewer recorded sixty
`consistent` verdicts and no `inconsistent` verdicts; this verifier checked
binding and completeness, while the separate reviewer owns the substantive
bilingual judgments.

After materialization, `node evaluation/review-report.js` exited **0**:
bilingual gate `PASS` with 60 reviewed outputs and zero errors, creator gate
`PASS` with five AI persona loops, evaluation labels `PENDING`, and overall
release `BLOCKED` only by missing labels. The offline report again revalidated
all sixty outputs and 80/80 rating stability. No model calls were made. This
satisfies issue 0035's artifact and semantic gate; issue 0036 owns the pending
AI-reviewed labels. The full test suite was already 216/216 before this
data-only addition, so it was not rerun.
