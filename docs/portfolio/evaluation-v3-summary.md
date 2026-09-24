# Evaluation summary

Generated: 2026-09-24T04:47:53.365Z. Fixture suite 1.0.0; runner 3.0.0; model contract 3.0.0; v23.11.0.

**MVP release: BLOCKED.**

- Automatic constraints: PASS (60/60 case runs).
- Five synthetic JDs; twenty synthetic transcripts; all four categories (five cases each).
- Independent feedback invocations: 60; three fresh workspaces; no receipt replay.
- Stability: 80/80 dimensions within one level (100.0%; minimum90%). **Fixed fake provider only; not substantive model quality.**
- Bilingual automatic pair checks: PASS; semantic consistency: pending-or-failed.
- Human labels: PENDING. AI persona validation: PENDING (4 loops). Model judge: not used.

## Release blockers

- Independent bilingual semantic review pending, stale or inconsistent
- Human-labelled expectations pending or stale
- AI attestation pending: attestedBy and valid attestedAt required
- Pending fifth persona loop (4/5 completed)
- Live-model semantic quality and rating stability not evaluated; fixed fake ratings are not quality evidence

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

Every successful case checks the bilingual schema, exact JD citations, question links, one shared exact quote per bilingual finding, prohibited generated phrases in both languages, unverified-evidence exclusion, automatic bilingual pair checks, and reference gating. Automatic pair checks establish presence and script separation, not semantic equivalence; each paired English/Chinese artifact remains pending human review. All inputs are AI-authored synthetic fixtures; no creator records are included. Full per-case output and failures: [machine report](../../evaluation/results/v3.json). Human review packet: [version3](../../evaluation/v3/review-packet.json).

Failures: none in this deterministic run.
