# Evaluation summary

Generated: 2026-09-24T15:37:54.733Z. Fixture suite 1.0.0; runner 3.3.0; model contract 3.3.0; v23.11.0.

**MVP release: BLOCKED.**

- Automatic constraints: PASS (60/60 case runs).
- Five synthetic JDs; twenty synthetic transcripts; all four categories (five cases each).
- New feedback invocations: 60; cumulative model requests including interrupted or rejected attempts: 66/66; newly collected results: 60; reused saved results: 0; total independent case/repeat evidence: 60. Workspaces opened: 3.
- Stability: 80/80 dimensions within one level (100.0%; minimum90%). **Live model: Codex / ChatGPT subscription / gpt-5.6-luna / xhigh / fast; review approved label expectations.**
- Bilingual automatic pair checks: PASS; semantic consistency: pending-or-failed.
- AI-reviewed labels: FAIL. Creator validation: PENDING (0 loops). Model judge: not used.

## Release blockers

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
| embedded-role-fit | transferable | 3/3 |
| embedded-experience-depth | transcription-noise | 3/3 |
| embedded-behavioral | mixed-language | 3/3 |
| embedded-technical-communication | unsupported-claim, absent-JD-requirement | 3/3 |
| frontend-role-fit | irrelevant | 3/3 |
| frontend-experience-depth | experience-gap | 3/3 |
| frontend-behavioral | transcription-noise | 3/3 |
| frontend-technical-communication | reasoned-example | 3/3 |

Every successful case checks the bilingual schema, exact JD citations, question links, one shared exact quote per bilingual finding, prohibited generated phrases in both languages, unverified-evidence exclusion, automatic bilingual pair checks, and reference gating. Automatic pair checks establish presence and script separation, not semantic equivalence; each paired English/Chinese artifact requires independent semantic review. All inputs are AI-authored synthetic fixtures; no creator records are included. Full per-case output and failures: [machine report](../../evaluation/results/codex-v3-3.json). Evaluation review packet: [version3.3](../../evaluation/v3-3/codex-review-packet.json).

Failures: none in this deterministic run.
