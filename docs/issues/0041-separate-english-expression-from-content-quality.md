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

2026-09-24: Contract 3.2 adds independent 1–4 anchors and a contiguous verbatim quote instruction. Its runner uses new artifact paths and durably counts live analysis/feedback reservations across resume, including rejected or interrupted calls. The exact-quote validator, 3.1 outputs, approved expectations and release gates remain unchanged. See [3.2 implementation handoff](../verification/0041-v3-2-implementation-handoff.md). No new model evaluation was authorized or run; release remains BLOCKED.

2026-09-24: A new, separately authorized 3.2 Codex run used exactly 65 requests and saved 60/60 valid outputs. Automatic checks, 79/80 stability units, and independent semantic review of all 480 bilingual pairs pass. Blind AI labels were approved before raw results were generated, but the fixed comparison passes only 25/60 outputs; 35 fail one or more rating ranges. Four English-expression discrepancies concern the subjective 3/4 naturalness boundary, not a clear repetition of the original content/expression conflation. The creator/persona gate remains pending. See [3.2 review handoff](../verification/0041-v3-2-review-handoff.md). Implementation remains complete; **release remains BLOCKED**. No historical output or threshold was changed, and the 65-request approval is exhausted.

2026-09-24: Reviewed all 35 failed 3.2 case/repeat outputs and recorded a [prospective rater-persona calibration](../verification/0041-prospective-rater-calibration.md) for relevance, support, structure and English-expression boundaries. This is post-run analysis for future blind labels, not a revision of the 3.2 labels, outputs or acceptance gate. Release remains **BLOCKED**; no further model request was made.

2026-09-24: Two independent AI Role persona raters applied the prospective guide to eight [new synthetic calibration cases](../verification/0041-heldout-rater-calibration.md). They agreed on 28/32 levels, with all four other judgments one level apart. An independent AI adjudicator found three guide departures and one genuine adjacent structure boundary; no further guide edit is justified by this small challenge set. This is offline calibration, not release evidence or a new subscription evaluation. Release remains **BLOCKED**.

2026-09-24: Implemented prospective contract 3.3 boundary clarifications and a staged blind-label evaluation workflow. The runner now freezes questions and approved labels before live feedback, and offline review rejects post-run label edits. Targeted tests passed 26/26, the full offline suite 249/249, and independent Standards/Spec re-reviews found no implementation blocker. See [3.3 implementation handoff](../verification/0041-v3-3-implementation-handoff.md). No new model evaluation was run: the previous 35/60 failures remain historical evidence, and release remains **BLOCKED** pending a separately authorized 65-request run and independent gates.

2026-09-24: The newly authorized 3.3 Codex analysis phase used 3/65 durable requests. Two question sets were saved; the third failed the unchanged required-category validator. No blind packet, label, or feedback was produced. Completing five valid analyses plus sixty feedback results now needs at least 66 total requests, so calls paused pending separate approval for one additional request. See [attempt-1 handoff](../verification/0041-v3-3-analysis-attempt-1-handoff.md). Release remains **BLOCKED**.

2026-09-24: After separate approval to raise the cumulative cap to 66, the same checkpoint completed five valid analyses using six reserved requests. The twenty-case blind packet and pre-feedback rater guide are frozen; no feedback has been requested. See [blind-packet handoff](../verification/0041-v3-3-blind-packet-handoff.md). Independent AI Role persona drafting and approval precede the sixty feedback requests.

2026-09-24: Two independent AI Role persona raters drafted twenty blind labels each (74/80 dimensions agreed); a third independent AI approver adjudicated the six one-level differences and approved twenty single-level labels before any feedback request. The [pre-feedback approval handoff](../verification/0041-v3-3-label-approval-handoff.md) records hashes, AI provenance and unchanged request count of 6/66. Release remains **BLOCKED** pending the sixty fresh feedback results and independent gates.

2026-09-24: The authorized 3.3 Codex run consumed its full 66/66 request cap and saved 60/60 valid feedback outputs. Automatic checks and 80/80 stability units pass. The fixed pre-feedback AI label comparison passes 20/60 and fails 40/60, so the scoring gate still blocks release. See [raw-run handoff](../verification/0041-v3-3-feedback-run-handoff.md). Independent bilingual meaning review and persona validation remain pending; no result, label or acceptance threshold was changed.

2026-09-25: Independent AI review of all 480 English/Traditional-Chinese pairs found one substantive addition in `embedded-role-fit` repeat 1; the other 59 outputs were semantically consistent. The [offline reviewed report](../../evaluation/results/codex-v3-3-reviewed.json) confirms source, request, frozen-label and output integrity. Automatic constraints and stability PASS; fixed label gate FAIL (40/60), bilingual semantic gate FAIL (1/60), and persona validation remains PENDING (0/5). See [review handoff](../verification/0041-v3-3-review-handoff.md). Contract implementation is complete, but **release remains BLOCKED**. No historical output or approved range was changed.

2026-09-25: A separately approved contract 3.3 AI-persona run completed five real-UI synthetic Practice Loops with two snapshots, four categories, honest experience gaps, and one cancelled-then-retried feedback operation. It used 13 of a hard cap of 28 new Codex subscription requests. An independent AI verifier checked the records and 40 bilingual pairs and signed the persona ledger, so the persona gate now **PASSES 5/5**. The regenerated [offline report](../../evaluation/results/codex-v3-3-reviewed.json) still fails the fixed label comparison (40/60) and bilingual semantic gate (1/60); **release remains BLOCKED**. See [persona handoff](../verification/0041-v3-3-persona-handoff.md) and [walkthrough](../verification/0041-v3-3-persona-walkthrough.md). No old model output, label or threshold was changed.
