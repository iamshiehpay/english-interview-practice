---
status: completed
---

# Harden the Local Workspace and provider controls

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

1–3, 38–41

## What to build

Make the integrated Local Workspace reliable and transparent. The learner can configure supported providers without storing credentials in product data, inspect which provider and data categories a step will use, cancel or retry external operations, and recover from timeouts without corrupting snapshots or practice state. Package the local application with a documented, repeatable startup path and add one browser smoke test across the complete happy path.

## Acceptance criteria

- [x] Provider credentials remain outside the application database and are never returned through ordinary API responses or logs.
- [x] The interface identifies the active Job Source, language-model, and speech providers and describes what data leaves the machine.
- [x] External operations enforce finite timeouts and expose pending, failed, cancelled, and retryable states.
- [x] Retrying a failed operation is idempotent or otherwise cannot duplicate or corrupt Job Snapshots and Practice Records.
- [x] Only the context required for the current operation is sent to an external provider.
- [x] Logs and traces exclude credentials and avoid unnecessary resume or transcript content.
- [x] A documented local startup path launches the required application services and persistence.
- [x] One browser smoke test completes the happy path from pasted JD through a saved Practice Record.
- [x] Failure-injection tests cover timeouts, malformed model output, unavailable Job Sources, and speech-provider failure.

## Blocked by

- [Issue 0001](./0001-complete-a-text-practice-loop-from-a-pasted-jd.md)
- [Issue 0003](./0003-add-voice-first-answer-attempts.md)
- [Issue 0004](./0004-discover-jobs-from-a-job-search-profile.md)

## Verification

Independent reviewer passed all nine criteria. [Evidence](../verification/0007.md).
