# Versioned evaluation and attributed validation

## Current contract 3.3 evaluation and checkpoints

`npm run evaluate` runs the twenty synthetic cases three times through the local API with the fake provider. It saves each accepted case/repeat to `evaluation/checkpoints/v3-3.json` with an atomic write before starting the next case. Reports go to `evaluation/results/v3-3.json`, `evaluation/v3-3/`, and `docs/portfolio/v3-3-evaluation-summary.md`. Codex and paid-provider runs use separate `codex-v3-3` and `live-v3-3` checkpoint/report names. Contracts 3.0–3.2 remain historical evidence and are never overwritten by this runner. Contract 3.3 keeps the independent 1–4 dimensions and contiguous exact-quote rule, and clarifies partial relevance, support for concrete steps, transcript-internal structure, and the English-expression 3/4 boundary. The validators and release gates remain strict.

For a separately authorized 3.3 live run, `--analysis-only` durably reserves at most five model analysis requests, freezes the five question sets, and writes a mode-specific blind packet (`v3-3/codex-label-blind-packet.json` or `v3-3/live-label-blind-packet.json`) before any feedback request. Draft and independently approve twenty case labels from that packet before resuming the same checkpoint without `--analysis-only` for sixty feedback requests. The runner rejects live feedback unless the frozen blind packet and narrow, independently AI-approved labels match, then records their checksums before the first feedback call and rejects later edits. Fake-provider `--analysis-only` uses `v3-3/label-blind-packet.json` and no external model requests; `--require-blind-approval` exercises the same pre-feedback gate with fake output. An invalid or interrupted request still consumes its reservation; the default cumulative 65-request limit does not reset between phases. `--analysis-only` cannot claim release approval.

If a run stops, invoke the same command with `--resume`, including the same provider and model options. The runner validates the entire checkpoint, request ledger and frozen analyses before any new provider call, skips only saved case/repeat combinations, and makes calls only for missing combinations. A complete matching checkpoint regenerates reports with zero model calls. Without `--resume`, existing evaluation state is an error; use `--checkpoint PATH` for a new independent run. `--output-root PATH` keeps the versioned reports, analyses, checkpoint, request ledger and portfolio summary under a separate directory, useful for isolated tests.

The checkpoint binds the full fixture suite, contract version, source checksum, provider mode and model configuration. Each entry binds the selected question, exact input/output checksums, feedback and bilingual audit. Its companion `*.json.attempts.json` ledger and `*.slots/` directory are bound to the same identity. For live modes, the runner durably reserves one numbered slot before every analysis or feedback invocation, including calls whose response later fails validation or whose process is interrupted. An unfinished slot still counts against the budget, but it cannot lock out resumption after a crash. The default cumulative limit is 65 requests across `--resume`; more than 65 requires both separate user authorization and `--max-total-model-requests N --accept-extra-model-usage`. Changed fixtures, source, settings, missing frozen analyses or ledger, duplicate entries or tampered entries stop resumption before calls. Do not delete invalid state to trigger a silent rerun; investigate it and select a new path only for an intentionally new evaluation. A failed call is not a completed entry and is not reused. Evaluation disables the app's validation retry, so one case attempt cannot silently use a second paid/subscription call.

These unkeyed checksums detect corruption and edits that do not recompute the checksums. They do not authenticate a file against someone who deliberately rewrites both the result and every checksum; the local workspace is the trust boundary.

Reports distinguish fresh feedback invocations (`providerCalls`), cumulative reserved **live** requests (`cumulativeModelRequests`), newly collected results, reused saved results and total collected evidence. Saved reads do not count as fresh calls; fake runs report zero model requests. The three-repeat stability gate still requires three distinct case/repeat results for every case and at least 90% stable dimensions. A fake run is pipeline evidence only; fresh live output and independent semantic/label review remain required for release.

The standalone bilingual audit reports `automaticPass: true` only when all sixty expected case/repeat entries appear exactly once and each automatic bilingual pair check passes. Empty, partial and duplicate coverage report false, even when their existing entries pass.

## Historical contract 2 workflow

The earlier contract 2 run produced `results/v2.json`, `v2/review-packet.json`, `v2/bilingual-audit.json`, and `docs/portfolio/evaluation-v2-summary.md`. Existing v1 reports and frozen analyses remain historical English-only evidence.

`npm run evaluate:release` performs the same checks but exits nonzero while release blockers remain. The ordinary evaluation exits nonzero for automatic failures or less than90% stability; a successful regression exit does not mean MVP release approval. Rating stability is the proportion of80 case/dimension units with a three-run range of at most1 (minimum72). The historical contract 2 runner required sixty fresh calls; contracts 3.2–3.3 instead validate sixty distinct case/repeat results and reports fresh calls separately from checkpoint reuse.

The five original synthetic jobs and twenty synthetic transcripts in `v1/manifest.json` are AI-authored, not employer postings or personal learner data. Each category has five cases. Case tags expose adversarial and gap coverage. A case checksum includes exact JD, generated question, category and transcript. Existing API tests additionally cover invalid provider outputs, actual boundary rejection and operational failures.

## Human labels

For the v1.0.0 gate under [ADR 0020](../docs/adr/0020-validate-v1-with-ai-persona-loops.md), the current Codex packet is `v3/codex-review-packet.json`. Its twenty labels are drafted by a rater persona and individually approved by an independent AI reviewer. The artifact keeps the historical file name `v3/human-labels.json`, but must disclose `labelProvenance.mode: "persona-drafted-ai-approved"` and set `reviewerType: "ai"` on every approved label. The reviewer identity and time belong to each approval. This is AI-reviewed evidence, not human judgement. Real human labels remain post-v1.0.0 work.

The v3 check still requires the exact `caseId` and `inputChecksum`, four inclusive 1–4 rating ranges, a substantive rationale, verbatim transcript evidence quotes, required and forbidden findings, and bilingual semantic approval. Every approved range and finding is checked against **all three** saved feedback repeats. Required and forbidden findings are case-sensitive literal substrings of the four English and Chinese rating reasons plus the strength and priority-improvement text; evidence quotes are excluded from that search. Empty finding arrays are valid when no stable literal rule is justified. These literal checks do not replace independent semantic review of English and Traditional Chinese output.

The [post-run review of 35 contract-3.2 rating mismatches](../docs/verification/0041-prospective-rater-calibration.md) clarifies boundaries for prospective blind rater labels only. It does not revise the frozen 3.2 ranges or make that release gate pass. The saved 3.2 comparison remains 25/60 passing under the current 3.3 source, as checked by the offline historical-gate regression test.

The validator reports label mode `human`, `ai`, or `mixed`. Explicit `reviewerType` values may be `"human"` or `"ai"`; a typed artifact cannot mix typed and untyped entries. A persona-drafted AI artifact accepts only `"ai"`. Historical untyped schema 1 and schema 2 approvals remain human labels when their existing contract checks pass.

The following instructions describe the historical contract 2 human-label workflow:

Read each case's JD, question and transcript in `v2/review-packet.json`. Copy its `humanLabelTemplate` to `v2/human-labels.json` under `labels`, then personally supply:

- `status: "approved"`, your `reviewer` name, and an ISO8601 `reviewedAt` timestamp.
- Four inclusive `[minimum, maximum]` ranges between1 and4 under `ranges`.
- A substantive `rationale`, with one or more exact transcript `evidenceQuotes`.
- `requiredFindings` and `forbiddenFindings` arrays of literal coaching phrases (empty arrays are allowed if no literal rule is suitable).
- `bilingualSemanticConsistency: "approved"` only after personally comparing every English/Traditional Chinese pair and confirming the same assessment, advice and degree of certainty.

Keep `caseId` and `inputChecksum` unchanged. The checksum includes model contract version2, so every v1 label is stale by construction. Proposed machine guidance is not human approval. Review all twenty cases; do not simply accept fixed demo ratings. A meaningful human label can make the fake provider fail, which is an honest result. These labels test literal findings and ranges; human semantic assessment still matters. Model-judge results remain separately attributed and cannot override deterministic failures.

## Bilingual semantic review

`v2/bilingual-audit.json` contains every paired English/Traditional Chinese question meaning, rationale, rating reason, strength and priority improvement, bound to the exact case checksum. Automatic checks only establish that both sides exist, the Chinese side contains Han script and the two values are not identical. They do not establish equivalent meaning.

An independent AI reviewer may copy results into `v2/semantic-reviews.json`, with one entry for every case and repeat: exact `caseId`, `repeat` and `outputChecksum`, `verdict` (`consistent` or `inconsistent`), a substantive `rationale`, and `contradictoryPairs` containing pair names from the audit. All sixty generated feedback reports are therefore reviewed rather than only the first repeat. The artifact also requires `reviewerType: "ai"`, reviewer identity and timestamp. Any missing, stale or inconsistent review blocks release. This review is supporting evidence only; it never completes `human-labels.json` or the creator real-use gate.

## Creator real-use ledger

The creator must personally complete five loops across at least two snapshots and two categories, including a gap and an induced failure followed by recovery. Use their own answers. Do not copy evaluation records or browser smoke into this ledger. For contract2 validation, add each completed loop to `v2/creator-validation.json`:

```json
{
  "recordId": "actual completed record ID",
  "snapshotId": "actual snapshot ID",
  "category": "role-fit",
  "completedAt": "actual ISO8601 completion timestamp",
  "completed": true,
  "synthetic": false,
  "inputMode": "text",
  "experienceGap": false,
  "inducedFailure": null
}
```

For the failure loop, use `"inducedFailure": {"type": "describe the observed failure", "recovered": true}` and retain a short outcome note. A cancelled operation followed by a successful retry is an appropriate failure if personally observed. Use a genuine Experience Gap in at least one loop. Add `creator` and `attestedAt` to the top-level ledger only after personally checking the records. Retrieve IDs from your local API `/api/workspace`; do not publish private transcripts or credentials. The validator checks the attested ledger's structure and coverage; human attestation and inspection of actual records remain necessary, since it intentionally does not access the creator's workspace.

## Live provider gate

No paid/live evaluation is run automatically. After configuring `OPENAI_API_KEY` locally, explicitly opt in:

```sh
npm run evaluate -- --live --accept-provider-cost
```

This sends only these synthetic JDs/transcripts to OpenAI: up to five analysis requests plus sixty feedback requests, with no automatic retries. Charges depend on the chosen model and token usage. `COACH_MODEL` defaults to `gpt-4.1-mini`. The initial analysis for each JD is frozen across three repeats so every selected question/transcript is identical; feedback is always a fresh model invocation. Invalid analysis or feedback remains a reported critical failure. No speech or job-source calls are made.

Contract2 live reports are separate: `results/live-v2.json`, `v2/live-review-packet.json`, `v2/live-bilingual-audit.json`, and `docs/portfolio/live-v2-evaluation-summary.md`. The first valid analyses are frozen in `v2/live-analysis.json` and carry the exact contract version. Missing or changed contract/model/JD metadata requires `--refresh-analysis`; old v1 frozen analyses are never reused. Review the new question-specific labels and paired-language audit, then rerun with `--release` to enforce all gates. A successful live regression or AI semantic review alone is not human approval. The creator ledger must also be complete.

Do not place keys in fixtures/reports or paste them in conversation. Until a live run and human semantic review are recorded, fixed fake ratings cannot establish substantive rating stability.

## Codex / ChatGPT subscription evaluation

After completing the dedicated login and synthetic isolation check, opt into subscription usage explicitly:

```sh
npm run evaluate -- --codex --accept-subscription-usage
```

This may consume up to65 model requests (five analyses and sixty fresh feedback calls) against your account limits. Never run it implicitly from CI. `--codex` and `--live` are mutually exclusive; neither is selected by environment variables. Add `--release` to enforce the attributed label, creator and stability gates. Contract 3 reports are written separately to `results/codex-v3.json`, `v3/codex-review-packet.json`, `v3/codex-bilingual-audit.json`, `v3/codex-analysis.json` and `docs/portfolio/codex-v3-evaluation-summary.md`; the earlier contract 2 run remains under `results/codex-v2.json` and `v2/codex-*.json`. The runner uses the same Codex defaults as the app (`gpt-5.6-luna`, `xhigh` reasoning effort, `priority` service tier; override with `COACH_CODEX_MODEL`, `COACH_CODEX_EFFORT`, `COACH_CODEX_SERVICE_TIER`, where an empty service tier disables it) and a 180-second operation timeout. The frozen analysis records the model, reasoning effort and service tier; if any of them differs, or a legacy file lacks them, the run stops until you pass `--refresh-analysis`. The report identifies the actual configured Codex model, reasoning effort and service tier, and the CLI version reported by `codex --version`; it does not claim direct API temperature settings. Question freezing, contract-bound checksums, independent bilingual review, attributed label review and three independent repeats follow the same rules as the API mode. A subscription run alone cannot approve labels or attest Practice Loops.

## Offline review of the bilingual Codex report

For contract 3.3, capture the versioned source immediately before an authorized live run with `node evaluation/review-report.js --capture-source`. After the run, independent review of all sixty bilingual outputs, the frozen blind-label approval and persona attestation, run:

```sh
node evaluation/review-report.js
```

This command makes **no model calls**. It rechecks the saved raw report against the frozen analyses, fixture inputs, saved review packet, paired output checksums, all three repeats, the captured model-run source hashes, the independent semantic-review artifact, approved labels and the creator ledger. It writes `results/codex-v3-3-reviewed.json` without changing the original raw report; `--v3` selects the historical contract-3.0 paths. The offline label gate applies the same range and literal-finding comparisons to all sixty saved outputs as the runner. Label mismatches block release through the separate label gate; they do not rewrite a passing raw automatic-constraint result as a failure. Missing, stale or inconsistent semantic or label evidence exits nonzero. The model contract, validators and provider source must still match the captured run; subsequent workflow-only changes are listed separately as source differences. Contract 3.3 additionally verifies the pre-feedback blind packet and label-freeze checksums before comparing labels. Its durable report must account for at least five analysis and sixty feedback requests, including retries, within the recorded authorized cap; fresh per-process call counts remain separate for resumed runs.

The independent AI semantic review and AI-approved case labels are separate gates. With all automatic, semantic, label and AI-persona gates passing, the release status is `AI-validated`, never human-validated. Real creator use, real speech and human-reviewed labels remain post-v1.0.0 validation under ADR 0020.
