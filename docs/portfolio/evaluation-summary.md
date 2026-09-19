# Evaluation summary

Generated: 2026-09-18T07:50:41.271Z. Suite 1.0.0; runner 1.0.0; v23.11.0.

**MVP release: BLOCKED.**

- Automatic constraints: PASS (60/60 case runs).
- Five synthetic JDs; twenty synthetic transcripts; all four categories (five cases each).
- Independent feedback invocations: 60; three fresh workspaces; no receipt replay.
- Stability: 80/80 dimensions within one level (100.0%; minimum90%). **Fixed fake provider only; not substantive model quality.**
- Human labels: PENDING. Creator validation: PENDING. Model judge: not used.

## Release blockers

- Human-labelled expectations pending or stale
- Creator five-loop real-use validation pending
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

Every successful case checks schema, exact JD citations, question links, exact feedback quotes, forbidden generated phrases, unverified-evidence exclusion, and reference gating. Phrase sentinels do not prove semantic truth. All inputs are AI-authored synthetic fixtures; no creator records are included. Full per-case output and failures: [machine report](../../evaluation/results/v1.json). Human review packet: [version1](../../evaluation/v1/review-packet.json).

Failures: none in this deterministic run.
