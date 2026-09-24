# Contract 3.2 Codex evaluation — authorized run

## Preflight

- User authorized at most 65 new Codex subscription model requests for the synthetic contract 3.2 evaluation. One run is planned: five JD analyses and sixty feedback calls, with no automatic validation retry. Any invalid response consumes its reserved request; no extra request is authorized.
- Source commit: `a3496acd9a8ebcc0cbb33fda7feb7e0bf12f25bd`; working tree clean at 2026-09-24 10:19 UTC. Ordered 26-file runner source checksum: `7966e8cb97de7090dccf77ea322502f75cb8f56b20b85dce328171c4aedeb316`.
- Selected reviewed Codex CLI: `/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex`, SHA-256 `8eaf1ad12fe6bf89b1710330f58900014322c7c5af677e43be116d8ac5fc0a9e`. The dedicated `.coach-codex` profile reported `ready: true`, model `gpt-5.6-luna`, `xhigh` effort and Fast/priority tier. Status checking made no model turn.
- The new `evaluation/checkpoints/codex-v3-2.json`, companion attempt ledger and `evaluation/v3-2/` did not exist at preflight. The runner uses synthetic fixtures, temporary workspaces and ephemeral loopback ports. It does not use port 4310 or real practice data.
- One planned command, with a unique terminal log: `COACH_CODEX_BIN=/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex npm run evaluate -- --codex --accept-subscription-usage`. A failed run is not permission to exceed the 65-request budget.

## Execution

The one planned command finished at 2026-09-24 10:43:47 UTC with exit code 0. The durable ledger records exactly 65 reservations: five analyses and sixty feedback calls. All sixty case/repeat results passed strict validation and were checkpointed; there were no runner failures or validation retries. The source checksum in the raw report equals the preflight checksum. Automatic constraints passed, bilingual automatic coverage is 60/60, and 79/80 dimension stability units were within one level (98.75%, above the 90% minimum). Raw `releaseStatus` is **BLOCKED** pending independent semantic review, approved label comparison and creator/persona validation.

Before any model feedback was inspected for labels, two blind raters drafted twenty contract-3.2 labels from the frozen question/transcript packet. An independent reviewer approved all twenty drafts at 10:35:53 UTC, before the raw report was generated. The blind packet exactly matches the runner's later review packet in case IDs, input checksums, questions, jobs and transcripts. Drafts and approval are frozen separately under `evaluation/v3-2/`.

The original checkpoint, attempt ledger and all 65 slot files, report, frozen analyses, review packet, automatic bilingual audit, summary and terminal log were copied byte-for-byte into [the attempt-1 archive](0041-v3-2-attempt-1/manifest.json); the manifest records size and SHA-256 for all 73 copied files. This happened before offline label comparisons or final approval artifacts.

Provisional comparison against the blind-approved drafts finds **25 passing and 35 failing outputs** among sixty. Failure instances include relevance (11), support (9), structure (19), and English expression (4); an output can fail several dimensions. These original ranges were not changed after the comparison. Three independent reviewers then examined all eight English/Traditional-Chinese pairs in each of the sixty outputs; the combined review reports 60 consistent and zero inconsistent verdicts, with exact output-checksum bindings. Final AI label provenance and gates are recorded in the [offline review handoff](0041-v3-2-review-handoff.md). Release remains blocked by 35 label mismatches and the creator/persona gate. No further subscription request is authorized under this run.
