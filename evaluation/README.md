# Versioned evaluation and human validation

From the project directory run `npm run evaluate`. It makes sixty independent feedback calls through the real Local HTTP API in three fresh temporary workspaces. All adapters are explicitly fake, regardless of environment settings. No external requests, credentials or creator data are used. Contract2 output: `results/v2.json`, `v2/review-packet.json`, `v2/bilingual-audit.json`, and `docs/portfolio/evaluation-v2-summary.md`. Workspaces are removed in `finally`. Existing v1 reports and frozen analyses remain historical English-only evidence and are never overwritten or counted for contract2.

`npm run evaluate:release` performs the same checks but exits nonzero while release blockers remain. The ordinary evaluation exits nonzero for automatic failures or less than90% stability; a successful regression exit does not mean MVP release approval. Rating stability is the proportion of80 case/dimension units with a three-run range of at most1 (minimum72). Unique request IDs and a60-call assertion prevent cached success from pretending to be repeated inference.

The five original synthetic jobs and twenty synthetic transcripts in `v1/manifest.json` are AI-authored, not employer postings or personal learner data. Each category has five cases. Case tags expose adversarial and gap coverage. A case checksum includes exact JD, generated question, category and transcript. Existing API tests additionally cover invalid provider outputs, actual boundary rejection and operational failures.

## Human labels

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

This may consume up to65 model requests (five analyses and sixty fresh feedback calls) against your account limits. Never run it implicitly from CI. `--codex` and `--live` are mutually exclusive; neither is selected by environment variables. Add `--release` to enforce the human/creator/stability gates. Contract2 reports are separate under `results/codex-v2.json`, `v2/codex-review-packet.json`, `v2/codex-bilingual-audit.json`, `v2/codex-analysis.json`, and `docs/portfolio/codex-v2-evaluation-summary.md`. The report identifies the actual configured Codex model, CLI0.154.0 and medium reasoning; it does not claim direct API temperature settings. Question freezing, contract-bound checksums, independent bilingual review, human-label review and three independent repeats follow the same rules as the API mode. A subscription run still cannot complete human labels or five personal Practice Loops.

## Offline review of the bilingual Codex report

After the v2 live run and the independent AI review of all sixty bilingual outputs, run:

```sh
node evaluation/review-report.js
```

This command makes **no model calls**. It rechecks the saved raw report against the frozen analyses, fixture inputs, paired output checksums, all three repeats, the captured model-run source hashes, and the independent semantic-review artifact. It writes `results/codex-v2-reviewed.json` without changing the original raw report. Missing or inconsistent semantic review exits nonzero. The model contract, validators and provider source must still match the captured run; subsequent workflow-only changes are listed separately as source differences.

The independent AI semantic review is not human annotation. Human labels and the creator's five real Practice Loops remain separate release gates; the reviewed report remains `BLOCKED` until those real inputs exist. A successful offline bilingual review does not claim the MVP has been validated by its creator.
