# Evaluation summary

Generated: 2026-09-24T09:02:10.366Z. Fixture suite 1.0.0; runner 3.1.0; model contract 3.1.0; v23.11.0.

**MVP release: BLOCKED.**

- Automatic constraints: FAIL (59/60 case runs).
- Five synthetic JDs; twenty synthetic transcripts; all four categories (five cases each).
- New feedback invocations: 60; newly collected results: 59; reused saved results: 0; total independent case/repeat evidence: 59. Workspaces opened: 3.
- Stability: 0/80 dimensions within one level (0.0%; minimum90%). **Live model: Codex / ChatGPT subscription / gpt-5.6-luna / xhigh / fast; review approved label expectations.**
- Bilingual automatic pair checks: FAIL; semantic consistency: pending-or-failed.
- Evaluation labels: PENDING. Creator validation: PENDING (0 loops). Model judge: not used.

## Release blockers

- Critical automatic constraints failed
- Three-repeat stability failed
- Independent bilingual semantic review pending, stale or inconsistent
- Evaluation labels pending, stale or outside approved expectations
- Creator five-loop real-use validation pending

## Case coverage

| Case | Tags | Passed runs |
|---|---|---|
| ai-role-fit | mixed-language | 3/3 |
| ai-experience-depth | unsupported-claim, absent-JD-requirement | 3/3 |
| ai-behavioral | transcription-noise | 3/3 |
| ai-technical-communication | experience-gap | 3/3 |
| backend-role-fit | irrelevant | 3/3 |
| backend-experience-depth | supported-example | 3/3 |
| backend-behavioral | unsupported-claim | 3/3 |
| backend-technical-communication | transcription-noise | 3/3 |
| data-role-fit | mixed-language | 3/3 |
| data-experience-depth | experience-gap | 3/3 |
| data-behavioral | reasoned-example | 3/3 |
| data-technical-communication | irrelevant | 3/3 |
| embedded-role-fit | transferable | 2/3 |
| embedded-experience-depth | transcription-noise | 3/3 |
| embedded-behavioral | mixed-language | 3/3 |
| embedded-technical-communication | unsupported-claim, absent-JD-requirement | 3/3 |
| frontend-role-fit | irrelevant | 3/3 |
| frontend-experience-depth | experience-gap | 3/3 |
| frontend-behavioral | transcription-noise | 3/3 |
| frontend-technical-communication | reasoned-example | 3/3 |

Every successful case checks the bilingual schema, exact JD citations, question links, one shared exact quote per bilingual finding, prohibited generated phrases in both languages, unverified-evidence exclusion, automatic bilingual pair checks, and reference gating. Automatic pair checks establish presence and script separation, not semantic equivalence; each paired English/Chinese artifact requires independent semantic review. All inputs are AI-authored synthetic fixtures; no creator records are included. Full per-case output and failures: [machine report](../../evaluation/results/codex-v3-1.json). Evaluation review packet: [version3.1](../../evaluation/v3-1/codex-review-packet.json).

Failures: [{"repeat":3,"caseId":"embedded-role-fit","check":"case constraints","error":"/records/7fe88bf2-5e86-4450-8343-a59d21f3d2c7/feedback: {\"error\":\"Invalid provider output: feedback strength.quote not in transcript\",\"retryable\":true}\n\n502 !== 200\n"},{"check":"identical three-repeat inputs and independent evidence","error":"Expected values to be strictly equal:\n\n2 !== 3\n"}].
