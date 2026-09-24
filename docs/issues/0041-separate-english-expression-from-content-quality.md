---
status: completed
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

2026-09-24: Compared all eight saved reasons with the fixed AI-approved ranges and documented the dimension boundary in [the 0041 handoff](../verification/0041-expression-rubric-handoff.md). Feedback contract 3.1.0 now tells the model to score clear English independently of task fit and unsupported content. Regression coverage preserves the exact eight historical failures and offline review of contract 3.0.0. Implementation complete; release remains BLOCKED pending separately authorized fresh model evidence and independent review. No saved model output or approved label changed.

2026-09-24: A separately authorized 3.1 Codex evaluation used all 65 permitted requests. One invalid exact quote left 59/60 saved results, so automatic completeness and formal stability remain blocked. Blind-drafted, independently approved expectations find 15 mismatches among those 59 results, including one English-expression mismatch; independent bilingual review finds the 59 saved outputs semantically consistent but cannot pass a 60-output gate. The prior AI persona ledger remains historical 3.0 evidence. See [run handoff](../verification/0041-codex-v3-1-evaluation-handoff.md) and [offline review](../verification/0041-v3-1-review-handoff.md). No extra model request was made after the authorized run; release remains BLOCKED.
