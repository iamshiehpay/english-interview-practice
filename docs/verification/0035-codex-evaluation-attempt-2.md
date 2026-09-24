# Issue 0035 — additional authorized Codex v3 evaluation attempt

## Pre-run record

- Status at 2026-09-24 06:39:06 UTC: prepared to launch the one additional run expressly authorized in issue 0035; outcome not yet known. No evaluation process was active at preflight.
- Command to execute once: `COACH_CODEX_BIN=/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex npm run evaluate -- --codex --accept-subscription-usage`. A failure does not authorize a retry.
- The selected executable reported `codex-cli 0.155.1` and SHA-256 `8eaf1ad12fe6bf89b1710330f58900014322c7c5af677e43be116d8ac5fc0a9e`, matching the checked-in reviewed hash and supported version. The dedicated `.coach-codex` profile directory exists; no token contents were read or printed.
- The complete first failed run is preserved under [`0035-attempt-1-failed/manifest.json`](0035-attempt-1-failed/manifest.json): seven original files with original paths, sizes and SHA-256 hashes, independently re-read after copying. The archived files and manifest are read-only. Prior canonical outputs and source capture were cleared only after archive verification; the first attempt record and original log remain in `docs/verification/`.
- A new exclusive source capture was created at [`codex-v3-model-run-source.json`](codex-v3-model-run-source.json). Ordered runner source checksum: `9e88cabc5cdc4a81f9546ea9b8aa75d7af439e8c75bd8cc9858407899740d8d5`, unchanged from the first attempt; no model-source file changed.
- Output log path reserved for this attempt: `docs/verification/0035-codex-evaluation-attempt-2.log`. The runner uses isolated temporary workspaces and ephemeral loopback servers; the learner's port 4310 and real `.workspace/` are outside its path.

## Execution and outcome

- Launched once at approximately 2026-09-24 06:39:46 UTC. Process tool session handle: `42427`.
- Status at 2026-09-24 06:39:59 UTC: running; npm printed `node evaluation/run.js --codex --accept-subscription-usage`. Output is being preserved in the unique attempt-2 log above. `pipefail` is enabled so the observed terminal shell code will reflect npm failure if the runner fails.
- Terminal raw report generated at 2026-09-24 07:01:37 UTC; the `pipefail` logging shell exited `0` and the saved report has `automatedPass: true`, `failures: []`, and rating stability `80/80` (`pass: true`).
- The report records five successful analysis calls and sixty independent feedback calls, producing sixty results across twenty cases and three repeats. The frozen analysis has five entries, the review packet twenty cases, and the bilingual audit sixty cases with `automaticPass: true`.
- The report identifies Codex CLI 0.155.1, model `gpt-5.6-luna`, `xhigh` effort, `priority` service tier, and ephemeral sessions. Its source checksum exactly matches the exclusive pre-run capture above.
- Canonical artifacts: [raw report](../../evaluation/results/codex-v3.json), [frozen analysis](../../evaluation/v3/codex-analysis.json), [review packet](../../evaluation/v3/codex-review-packet.json), [bilingual audit](../../evaluation/v3/codex-bilingual-audit.json), and [summary](../portfolio/codex-v3-evaluation-summary.md). The unique [attempt-2 log](0035-codex-evaluation-attempt-2.log) retains the terminal summary.
- Raw `releaseStatus` remains `BLOCKED` solely because independent bilingual semantic review and evaluation labels were pending when the run finished. Those are separate follow-up reviews; this execution agent has not authored or approved them. This was the only invocation under the additional authorization and was not retried. The learner's server on port 4310 and real `.workspace/` were not contacted or modified by this agent.
