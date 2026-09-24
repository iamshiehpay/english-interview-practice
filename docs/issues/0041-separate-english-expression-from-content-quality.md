---
status: needs-triage
---

# Investigate English-expression penalties for grammatical but unsupported answers

## Context

Issue 0036 independently approved twenty AI-rater labels against the frozen 0035 Codex packet. The approver changed three English-expression ranges from 2–3 to 3–4 because the transcripts are grammatical and intelligible; relevance and evidential support remain separate dimensions. This is an AI judgment requiring investigation, not a human-validated ground truth or a proven implementation root cause.

The offline gate correctly rejects eight saved outputs, all with English-expression level 2 against the approved range 3–4:

| Case | Repeats |
|---|---|
| `ai-experience-depth` | 1, 3 |
| `backend-behavioral` | 1, 2, 3 |
| `embedded-technical-communication` | 1, 2, 3 |

The twenty approvals and verbatim evidence are structurally valid. Required/forbidden findings and bilingual semantic review pass; 52/60 outputs satisfy all approved ranges. Overall release remains BLOCKED. See [approved labels](../../evaluation/v3/human-labels.json), [saved outputs](../../evaluation/results/codex-v3.json), [offline report](../../evaluation/results/codex-v3-reviewed.json), and [rater rubric](../verification/0036-rater-persona.md).

## Proposed scope

- Compare the intended English-expression rubric with the affected transcripts and model rationales; decide whether relevance or unsupported content is being counted twice, and document any legitimate contextual language criterion.
- Add regression coverage separating fluent but irrelevant/unsupported answers from grammatically unclear answers. Preserve low relevance/support where warranted.
- If prompt or contract changes are justified, implement them as a separate, reviewed change; retain the original frozen run, independent approvals and failures. Do not edit saved outputs or widen expectations just to pass.
- Validate changes first with offline tests. Any fresh paid/subscription evaluation requires a separately authorized run; this issue and the prior one-shot approval do not authorize one.

## Comments

2026-09-24: Filed from independent `review0031` label approval during 0036. Eight comparison failures are model-quality evidence; the new offline gate detecting them is working as designed. No model source was changed and no additional inference was requested.
