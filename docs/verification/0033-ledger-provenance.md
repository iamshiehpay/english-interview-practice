# Issue 0033 ledger provenance audit

Audited on 2026-09-24 against the explicitly authorized, read-only backup
`.workspace/persona-qa-2026-09-23/workspace.json` (SHA-256
`80368cbb65ff52311c9ebba50930f48bdc30300bb38a1d9fdcf83130fc8c9a03`).
The destination is [`evaluation/v3/creator-validation.json`](../../evaluation/v3/creator-validation.json).
No backup record was changed. The backup has five Practice Records, including
the run 1 warm-up; the ledger intentionally selects only runs 2–5.

| Walkthrough run | Record ID in backup and ledger | Snapshot ID | Category | `completedAt` | Last answer `inputMode` |
|---|---|---|---|---|---|
| 2 | `dc225a7c-ac45-4aa8-b6c0-18761a50607a` | `1adc38dc-d275-4168-a9f2-a749bef5e628` | `technical-communication` | `2026-09-23T08:58:06.794Z` | `text` |
| 3 | `0d250144-2df3-49d8-8ed5-21d388388d20` | `7dd3fee0-b476-46bb-a188-23650e829b42` | `behavioral` | `2026-09-23T09:02:03.685Z` | `text` |
| 4 | `09adb280-0b52-4779-b0ed-45ef7cb88209` | `7dd3fee0-b476-46bb-a188-23650e829b42` | `experience-depth` | `2026-09-23T09:04:40.566Z` | `text` |
| 5 | `952ddb5a-ce65-44d5-b8eb-66bb5ddd53e5` | `648b4e1a-ea4f-4c63-bdb8-207a9f3272ef` | `role-fit` | `2026-09-23T09:08:05.489Z` | `text` |

For every row, the backup's `records[recordId].id`, `snapshotId`,
`question.category`, `completedAt`, `status: "completed"`, and last
`attempts[].inputMode` match the ledger. Every referenced snapshot exists in
`snapshots`. This directly supports `completed: true`. The four rows cover
three Job Snapshots and four Question Categories. Run 2's stored answer
explicitly acknowledges no production fine-tuning experience and describes a
hypothetical approach, supporting `experienceGap: true`; this audit does not
publish its transcript.

## Fields whose source is outside the backup

| Ledger fields | Source and evidentiary limit |
|---|---|
| `schemaVersion`, `contractVersion` | Evaluation artifact format and model contract, not Practice Record fields. |
| `validationMode: "ai-persona"` | [ADR 0020](../adr/0020-validate-v1-with-ai-persona-loops.md), not a workspace field. |
| `creator: null`, `attestedBy: null`, `attestedAt: null` | Deliberately unfilled ledger attestation; the backup cannot attest the release. |
| `synthetic: true`, `persona: "林小安"` | The [walkthrough](persona-walkthrough-2026-09-23.md) documents that an AI agent played the persona. Workspace records do not store operator identity or synthetic provenance. |
| `evidence` | The linked walkthrough document exists under `docs/verification/`; its path is ledger provenance, not a workspace field. |
| Runs 3–5 `experienceGap: false`; runs 2, 3 and 5 `inducedFailure: null` | The walkthrough does not report those conditions for those runs. A final workspace state cannot prove that no unrecorded event occurred. |
| Run 4 `inducedFailure.type` and `recovered: true` | The backup directly shows a feedback operation and receipt for this record with `attempt: 2`, `state: "succeeded"`, and the same record as `targetId` and `resultId`. That supports a successful second attempt, **not the cause of the first attempt**. The [canceled-state screenshot](persona-walkthrough-2026-09-23/loop4-cancelled.png) (SHA-256 `2207778e8cea4af3cfefbe09dc08904b97502db0f055b1a5cc48efad7770c84c`) shows the UI saying the feedback operation was canceled and retryable; the walkthrough describes the later retry. |

The backup holds 17 operations and 17 receipts, all with final state
`succeeded`. It contains no saved `cancelled` operation or receipt. In
[`src/operations.js`](../../src/operations.js), a retry reuses the request ID and
replaces `d.operations[id]` with the next `attempt`; the successful receipt also
contains only that latest attempt. Thus the backup's `attempt: 2` cannot by
itself establish that attempt 1 was canceled, and no read-only query of this
backup can recover the overwritten state. The screenshot and contemporary
walkthrough are independent evidence for the cancellation, but they are not
fields in `workspace.json`.

**Historical finding under the original workspace-only rule (superseded below):** issue 0033 originally required taking and
verifying *every* ledger value against the backed-up workspace. The backup does
not contain persona provenance, evidence-document paths, attestation fields,
or the prior canceled attempt. The ledger records the requested four loops and
links the available sources without fabricating a canceled receipt. Its
`ai-persona` gate remains pending the fifth loop and independent attestation.


**2026-09-24 — User-authorized evidence-source clarification:** The user explicitly approved cross-verification using the backup together with the original screenshot and contemporaneous walkthrough. Native record fields still require exact backup matches. Persona/synthetic/evidence metadata and the cancellation event may use the separately identified historical sources above; the successful retry must still match the saved operation/receipt. The absent canceled workspace event is not reconstructed or claimed to exist. This resolves the former evidence-source contradiction, subject to independent verification of those sources; loop coverage, completion requirements, AI disclosure and independent attestation remain unchanged.
