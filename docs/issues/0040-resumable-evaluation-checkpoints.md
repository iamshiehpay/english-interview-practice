---
status: completed
---

# Save evaluation results as they complete and resume without duplicate calls

## Request

2026-09-24: The user asked whether model results can be saved after one call so they do not need repeated calls. The immediate, independently useful scope is durable per-case results and explicit resumption. The requested total repetition count is being clarified separately; this slice does not silently lower the existing three-repeat stability gate.

## Required behavior

- Save each successful feedback result durably as it completes, not only after the full suite.
- On an explicitly invoked matching run, validate saved results and skip exactly the completed case/repeat combinations. Run only missing combinations; a wholly completed run can regenerate reports offline from saved results.
- Bind saved state to suite/fixture inputs, model configuration, contract, source and exact input/output checksums. Reject tampered, duplicate or stale state clearly rather than silently reuse it or automatically spend calls to replace it.
- Keep distinct repeats distinct; never count one cached output as multiple independent samples. Preserve the existing stability and release criteria until an explicit repetition-policy decision.
- Report reused results and new calls accurately, alongside total collected evidence; no implication that cached reads are fresh model invocations.
- Preserve previously captured failed Codex artifacts. Implementing resume does not authorize another live run, automatic retries or extra subscription calls.

## Acceptance criteria

- [ ] A deterministic fake-provider interrupted run resumes with no additional provider calls for previously completed case/repeat entries.
- [ ] Re-running a complete matching evaluation regenerates equivalent evidence without model calls.
- [ ] Stale configuration/input/source and tampered/duplicate checkpoint entries are rejected before new provider calls.
- [ ] Saved entries survive interruption through atomic persistence; missing entries and failed entries are not falsely counted as complete.
- [ ] Three-repeat stability, model contracts, and independent-output evidence remain honest and unchanged; call accounting distinguishes new/reused evidence.
- [ ] Focused regression tests, full npm test and offline evaluation pass; no live evaluation or 4310 access occurs.
- [ ] Usage documentation explains resumption, invalidation and the distinction between saving results and independent repetition.

## Comments

No new live-model run is authorized by this issue. The prior issue 0035 attempt and its one-shot restriction remain intact.

2026-09-24: Added atomic per-result checkpoints with strict preflight validation, exact case/repeat reuse, independent version 3.1 artifact paths and explicit fresh/reused call accounting. The fake-provider interruption and complete replay tests pass without model calls; no historical artifact or real practice data changed. Implementation complete; release remains BLOCKED pending fresh authorized model evidence and independent reviews. See [0040 handoff](../verification/0040-checkpoint-handoff.md).
