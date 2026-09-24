# Issue 0035 — single Codex v3 evaluation attempt

## Pre-run record

- Status at 2026-09-24 04:51:09 UTC: prepared to launch the one creator-authorized subscription evaluation; outcome not yet known.
- Command: `npm run evaluate -- --codex --accept-subscription-usage` (execute once; never retry silently).
- Source capture: [`codex-v3-model-run-source.json`](codex-v3-model-run-source.json), created exclusively before launch. Ordered runner code checksum: `9e88cabc5cdc4a81f9546ea9b8aa75d7af439e8c75bd8cc9858407899740d8d5`.
- Source freeze commits: 0031 `5de15a0`; 0033 `ba6a1b7`; 0032 `3dd1e5d`; 0034 blocked evidence `cb21ec5`. The only uncommitted files at preflight were the issue 0035 offline reviewer and its test.
- Preflight: `evaluation/results/codex-v3.json`, `evaluation/v3/codex-analysis.json`, `evaluation/v3/codex-review-packet.json`, and `evaluation/v3/codex-bilingual-audit.json` were absent; no evaluation process was listed. The source capture also did not previously exist.
- Expected outputs: `evaluation/results/codex-v3.json`, `evaluation/v3/codex-analysis.json`, `evaluation/v3/codex-review-packet.json`, `evaluation/v3/codex-bilingual-audit.json`, and `docs/portfolio/codex-v3-evaluation-summary.md`.
- The runner uses its own temporary workspaces and ephemeral loopback servers. The learner's server on port 4310 and real `.workspace/` are outside this run.

## Execution

- Launched once at approximately 2026-09-24 04:51:39 UTC. Tool session handle: `55185`.
- Command output is being preserved in `docs/verification/0035-codex-evaluation.log`.
- Status at 2026-09-24 04:51:57 UTC: running; npm printed its `node evaluation/run.js --codex --accept-subscription-usage` command, with no terminal result yet.

## Outcome

- Terminal report generated at 2026-09-24 04:51:52 UTC. The output-logging shell pipeline exited `0` because its last command was `tee`; that shell status is **not** the evaluation result. The saved raw report records `automatedPass: false`, `releaseStatus: "BLOCKED"`, and stability `0/0`.
- Source integrity: raw report `codeChecksum` is `9e88cabc5cdc4a81f9546ea9b8aa75d7af439e8c75bd8cc9858407899740d8d5`, matching the pre-run capture.
- The runner recorded `analysisCalls: 15` local analysis attempts (five jobs across three repeats), `providerCalls: 0`, `results: 0`, and 16 failures. Each of the 15 job attempts received HTTP 503: `Codex executable does not match any reviewed macOS build`. The last failure records `0 !== 60` independent feedback invocations.
- `codex-cli 0.156.1` was reported by the runner. The checked-in macOS executable allowlist covers reviewed builds 0.154.0 and 0.155.1. `verifiedBinary` rejected the executable before `CodexRPC` was created, so no model inference request was reached by these attempts. `analysisCalls` counts attempted analysis entry points, not successful subscription calls.
- Artifacts written: [raw v3 report](../../evaluation/results/codex-v3.json), [review packet](../../evaluation/v3/codex-review-packet.json) (empty array), [bilingual audit](../../evaluation/v3/codex-bilingual-audit.json) (zero cases), and [evaluation summary](../portfolio/codex-v3-evaluation-summary.md). `evaluation/v3/codex-analysis.json` was **not** produced. No semantic review is possible from this failed run.
- This was the single authorized evaluation command. It was not restarted or retried. Port 4310 and the real `.workspace/` were not touched by this agent. A new evaluation attempt requires a separate decision after the executable is reviewed and the attempt evidence is assessed.
