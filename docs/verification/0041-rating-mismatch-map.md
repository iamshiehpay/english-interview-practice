# Issue 0041: current release blockers from frozen evidence

The [official contract-3.3 offline report](../../evaluation/results/codex-v3-3-reviewed.json) remains the latest release-gate decision: **BLOCKED**. Its sixty saved feedback outputs all pass automatic validity; stability is 80/80 and AI-persona Practice Loops are 5/5. The fixed pre-feedback blind comparison passes only 20/60 outputs, and independent review finds one bilingual semantic inconsistency among sixty. These are release-quality failures, not evidence that the already implemented practice flow is broken. None of the later diagnostic pilots changes this official verdict.

The forty failed outputs contain **59 dimension-level misses**. Recomputing levels from the saved 3.3 outputs and unchanged [independently approved ranges](../../evaluation/v3-3/label-approval.json) gives:

| Dimension | Misses | Below approved range | Above approved range |
| --- | ---: | ---: | ---: |
| Relevance | 11 | 9 | 2 |
| Support | 17 | 8 | 9 |
| Structure | 27 | 26 | 1 |
| English expression | 4 | 0 | 4 |

Seventeen of the twenty cases have at least one failed repeat; ten cases fail on all three repeats. The dominant structure under-score is therefore not just a few isolated completions. A miss in multiple dimensions still counts as one failed output in the 40/60 release figure.

The controlled diagnostic comparisons on eight separate synthetic cases did not find a safe replacement:

| Candidate | Full rating matches | Dimension misses (R/S/St/E) | Consistent bilingual outputs | Decision |
| --- | ---: | --- | ---: | --- |
| 3.4 Luna | 12/16 | 0 / 2 / 2 / 0 | 15/16 | NO_GO |
| 3.4 Sol, same inputs | 10/16 | 1 / 3 / 2 / 0 | 16/16 | NO_GO |
| 3.5 Luna, same inputs | 9/16 | 1 / 0 / 6 / 0 | 16/16 | NO_GO |

The 3.5 prompt removed the pilot's support misses but produced six structure under-scores, often treating a missing result or explanation as an organizational fault. This is a useful diagnosis, not an accepted fix; the 3.5 prompt was written after seeing these eight cases and remains outside production. Switching to Sol improved the observed bilingual count but worsened full rating matches. The diagnostic decisions and [3.5 handoff](0041-v3-5-rubric-diagnostic-handoff.md) were fixed before their respective outputs and did not rewrite any response, blind range or threshold.

Remaining work: independently resolve the structure boundary against the already written rubric and existing 60-case evidence, design a **new** blind packet before model output, then seek a separately capped evaluation for a versioned candidate. Only a passing official app evaluation under the unchanged gates can approve v1.0.0; prompt-only results on these eight reused cases cannot. Additional model usage requires separate user approval. No further model requests are included in this evidence map.
