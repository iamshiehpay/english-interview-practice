# Issue 0041: blind structure-boundary adjudication — approval pending

This is the first stop point in the [scoring resolution design](0041-scoring-resolution-design.md), prompted by the frozen 3.3 result: 27/60 structure misses, 26 below the approved range. It is a diagnosis of whether the written 3-versus-4 boundary is reproducible, not a rerating of historical release evidence. The original outputs, approved labels, bilingual verdict, acceptance thresholds and `BLOCKED` release report remain immutable.

The new [blind packet](../../evaluation/v3-3/structure-boundary-blind-packet.json) contains exactly twenty case IDs, existing input checksums, question text and transcripts copied from the pre-feedback 3.3 source packet. It contains no model feedback, old label, rater draft, job-analysis output or release result. Its canonical checksum is `eb0a43f1ebd8e674ce8604da06db6ecd211f7fd077e7dca19451d23035d98e02`; the source packet checksum is `ae2326ed2448d65e1fd0dab5c5975e9e65d9aba5b08b7303b84fb98a94b8ac35`.

Two independent AI Role-persona raters each review only that packet and the fixed structure anchors below, blind to one another and all prior scores. For each case they save one 1–4 structure level, one exact contiguous transcript quote, a short reason identifying the transcript-internal organizational link, and whether a missing requested result/content was **excluded** from the structure judgment. Each rater completes all twenty cases without new subscription feedback calls. Their draft files must have distinct paths and be frozen before comparison.

- **4:** A developed causal, contrastive or stepwise line in the transcript connects statements and advances the answer; brevity or off-topic content does not by itself lower structure.
- **3:** An understandable but thin progression, including one claim with a simple reason or merely related chronological statements; the connections are not developed.
- **2:** Weak links, fragmentation or repetition impede the line of thought.
- **1:** No discernible organization.

Missing requested content, an unreported result, unsupported factual claims, English grammar and bilingual wording are **not structure faults**. The raters may say these are absent, but may not use them as their structure-level reason. This is the existing 3.3 contract boundary, not a new scoring scale.

A third independent AI reviewer checks both complete drafts against the packet and anchors, records disagreements and adjudicates the organizational reasoning without reading old model output or approved labels first. Only after those judgments are frozen, compare both blind drafts and adjudications with the saved 3.3 approved ranges and model levels. Classify each historical structure miss as agreement with the fixed label, independent disagreement with the fixed label, or unresolved boundary; do not overwrite or retroactively widen any range. The final artifact must identify AI provenance, exact packet/draft hashes and the limits of AI-only adjudication.

**Requested model-use cap, not yet approved:** at most **three independent AI reviewer agent invocations** (two blind raters and one adjudicator); **zero** Codex subscription feedback or paid-model API calls. A failed or interrupted invocation counts, with no replacement or retry. Do not start an agent review until the user separately approves this cap. This review cannot pass v1.0.0 or authorize a fresh release evaluation; it only determines whether to pursue a structured evidence-first scorer or resolve an ambiguous rubric before spending additional feedback requests.
