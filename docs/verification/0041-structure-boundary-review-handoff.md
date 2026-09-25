# Issue 0041: blind structure-boundary review

The user approved at most **three independent AI reviewer invocations** and **zero Codex subscription feedback calls** for the [prospective review plan](0041-structure-boundary-review-plan.md). Exactly three invocations were used: two independently blind AI Role-persona raters and one blind adjudicator. They saw the same frozen [twenty-case packet](../../evaluation/v3-3/structure-boundary-blind-packet.json) but no historical model ratings or approved labels while scoring. The two [drafts](../../evaluation/v3-3/structure-boundary-rater-a.json) and [draft B](../../evaluation/v3-3/structure-boundary-rater-b.json) were validated and committed before the third review. The [blind adjudication](../../evaluation/v3-3/structure-boundary-adjudication-blind.json) was committed separately before historical comparison. No old output, label, bilingual verdict or release threshold changed.

The two raters agreed on **17/20** structure levels. The adjudicator resolved the three disagreements as `ai-role-fit` 3, `backend-behavioral` 3, and `data-technical-communication` 1, without departing from both raters on any case. The [offline comparison](../../evaluation/v3-3/structure-boundary-comparison.json) checks exact packet, draft, adjudication, label and raw-output hashes. The blind adjudication agrees with the original approved structure range in **15/20** cases and differs in five. This is AI-only evidence of a boundary problem, not proof that any original approval was wrong.

Of the **27** historical structure rating misses (26 model scores below range, one above):

| Relationship to independent blind judgments | Failed repeats |
| --- | ---: |
| All three blind judgments support the original approved range; model still misses it | 16 |
| Model level equals the blind adjudicated level outside the original approved range | 8 |
| Model differs from both the original range and blind adjudicated level | 3 |

In particular, `embedded-role-fit`, `embedded-experience-depth`, and `frontend-technical-communication` each have three model-level 3s against approved 4s and three independent blind 4s: these look like repeated model under-scoring. Conversely, all three model repeats for `backend-technical-communication` and `data-role-fit` are 3, matching three fresh blind 3s while the historical approval is 4: these expose a reproducible 3/4 boundary disagreement. `backend-behavioral` illustrates both issues: old approval 2, blind judgments 2/3/3, and all three model repeats 1.

The result rules out treating all 27 structure misses as either unavoidable random model slips or automatically incorrect historical labels. The next revision must state prospectively what connection is sufficient for structure 4 and what counts as a merely understandable progression at 3, keep missing task content in its own dimension, and use **new** blind cases before any feedback is generated. If independent raters cannot consistently apply that decision rule, stop rather than spend on another model run. The old official contract-3.3 report remains **BLOCKED** (40/60 outputs with rating misses and 1/60 bilingual semantic inconsistency). No production contract or v1.0.0 release status was changed.

Offline checks passed: the draft validator checked all 40 rater decisions, exact quotes and source packet hashes, and the comparison verifier checked the adjudication, twenty labels, sixty historical outputs and all twenty-seven structure misses. No full app test suite was rerun because this phase added only isolated evaluation evidence and documentation.
