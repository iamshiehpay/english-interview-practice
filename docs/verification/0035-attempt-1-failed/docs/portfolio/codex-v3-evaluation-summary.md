# Evaluation summary

Generated: 2026-09-24T04:51:52.914Z. Fixture suite 1.0.0; runner 3.0.0; model contract 3.0.0; v23.11.0.

**MVP release: BLOCKED.**

- Automatic constraints: FAIL (0/60 case runs).
- Five synthetic JDs; twenty synthetic transcripts; all four categories (five cases each).
- Independent feedback invocations: 0; three fresh workspaces; no receipt replay.
- Stability: 0/0 dimensions within one level (0.0%; minimum90%). **Live model: Codex / ChatGPT subscription / gpt-5.6-luna / xhigh / fast; review human-labelled semantic expectations.**
- Bilingual automatic pair checks: FAIL; semantic consistency: pending-or-failed.
- Human labels: PENDING. AI persona validation: PENDING (4 loops). Model judge: not used.

## Release blockers

- Critical automatic constraints failed
- Three-repeat stability failed
- Independent bilingual semantic review pending, stale or inconsistent
- Human-labelled expectations pending or stale
- AI attestation pending: attestedBy and valid attestedAt required
- Pending fifth persona loop (4/5 completed)

## Case coverage

| Case | Tags | Passed runs |
|---|---|---|
| ai-role-fit | mixed-language | 0/3 |
| ai-experience-depth | unsupported-claim, absent-JD-requirement | 0/3 |
| ai-behavioral | transcription-noise | 0/3 |
| ai-technical-communication | experience-gap | 0/3 |
| backend-role-fit | irrelevant | 0/3 |
| backend-experience-depth | supported-example | 0/3 |
| backend-behavioral | unsupported-claim | 0/3 |
| backend-technical-communication | transcription-noise | 0/3 |
| data-role-fit | mixed-language | 0/3 |
| data-experience-depth | experience-gap | 0/3 |
| data-behavioral | reasoned-example | 0/3 |
| data-technical-communication | irrelevant | 0/3 |
| embedded-role-fit | transferable | 0/3 |
| embedded-experience-depth | transcription-noise | 0/3 |
| embedded-behavioral | mixed-language | 0/3 |
| embedded-technical-communication | unsupported-claim, absent-JD-requirement | 0/3 |
| frontend-role-fit | irrelevant | 0/3 |
| frontend-experience-depth | experience-gap | 0/3 |
| frontend-behavioral | transcription-noise | 0/3 |
| frontend-technical-communication | reasoned-example | 0/3 |

Every successful case checks the bilingual schema, exact JD citations, question links, one shared exact quote per bilingual finding, prohibited generated phrases in both languages, unverified-evidence exclusion, automatic bilingual pair checks, and reference gating. Automatic pair checks establish presence and script separation, not semantic equivalence; each paired English/Chinese artifact remains pending human review. All inputs are AI-authored synthetic fixtures; no creator records are included. Full per-case output and failures: [machine report](../../evaluation/results/codex-v3.json). Human review packet: [version3](../../evaluation/v3/codex-review-packet.json).

Failures: [{"repeat":1,"jobId":"ai","check":"analysis grounding/schema","error":"/snapshots/16a375b5-7a41-4314-908b-e09791b577df/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":1,"jobId":"backend","check":"analysis grounding/schema","error":"/snapshots/75bbd106-3ba1-4437-8d52-d03111504eff/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":1,"jobId":"data","check":"analysis grounding/schema","error":"/snapshots/26ce9e58-4d32-47ae-8e5c-38e2b3005ac9/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":1,"jobId":"embedded","check":"analysis grounding/schema","error":"/snapshots/95f39306-8850-4c89-8316-eadf30c5613c/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":1,"jobId":"frontend","check":"analysis grounding/schema","error":"/snapshots/36f66b51-fb0d-400a-bf4a-ebdd1eafc133/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":2,"jobId":"ai","check":"analysis grounding/schema","error":"/snapshots/704cc9b6-91ba-4fef-8ec5-7ae5b4df4e3c/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":2,"jobId":"backend","check":"analysis grounding/schema","error":"/snapshots/17329b03-9e5a-46c2-b8d3-8b16a0abd692/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":2,"jobId":"data","check":"analysis grounding/schema","error":"/snapshots/3ec4df47-3e44-49ed-addd-c4c11a48f6c6/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":2,"jobId":"embedded","check":"analysis grounding/schema","error":"/snapshots/49c71fb6-6f29-4e2c-8a8a-59182bfd53bd/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":2,"jobId":"frontend","check":"analysis grounding/schema","error":"/snapshots/15755451-f68e-45ab-8961-c6d025994d34/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":3,"jobId":"ai","check":"analysis grounding/schema","error":"/snapshots/92744a43-6f2c-4661-9e92-e2e181f7d3e2/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":3,"jobId":"backend","check":"analysis grounding/schema","error":"/snapshots/05a0c3cd-927a-4ba5-9f02-b96f8b4dd0fa/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":3,"jobId":"data","check":"analysis grounding/schema","error":"/snapshots/d5ba1a6c-ca43-4151-add1-da348947279b/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":3,"jobId":"embedded","check":"analysis grounding/schema","error":"/snapshots/1510ddc0-8b0f-4144-b9d9-dfb6e78f8fb3/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"repeat":3,"jobId":"frontend","check":"analysis grounding/schema","error":"/snapshots/74a0cb7f-23da-4980-ac46-99a9775d3934/analysis: {\"error\":\"Codex executable does not match any reviewed macOS build\",\"retryable\":true}\n\n503 !== 200\n"},{"check":"identical three-repeat inputs and independent invocations","error":"Expected values to be strictly equal:\n\n0 !== 60\n"}].
