# 0041 — prospective rater calibration on new synthetic cases

After the [post-run review of the 35 contract-3.2 mismatches](0041-prospective-rater-calibration.md), an agent authored [eight new synthetic question/transcript cases](../../evaluation/calibration/0041-heldout-packet.json) to exercise the clarified boundaries. Their transcripts do not duplicate any of the 20 contract-3.2 evaluation transcripts. The packet SHA-256 is `01c03b840dd416825cad9d57cb186179d0a0d6b638b3c10ad5662e49482484a2`. These cases were designed from known failure themes, so they are a diagnostic challenge set, not an unbiased sample or a new release suite.

Two independent AI Role persona raters were instructed to use only the packet, the prospective guide section and the contract-3.2 rating anchors, without inspecting each other's scores or the historical model outputs. Their [A](../../evaluation/calibration/0041-rater-a.json) and [B](../../evaluation/calibration/0041-rater-b.json) artifacts each contain all eight cases and 32 four-dimension ratings. Every cited quote is an exact nonempty transcript substring; both artifacts bind to the packet hash. They agreed exactly on **28/32** dimension levels and were within one level on **32/32**. Agreement is a calibration observation, not an acceptance threshold.

An independent AI [adjudicator](../../evaluation/calibration/0041-adjudication.json) checked both artifacts against the packet and guide without reading historical outputs. Its four disagreement decisions were:

| Case and dimension | Rater A / B | Independent decision |
| --- | --- | --- |
| `cal-schema-drift` structure | 4 / 3 | Both 3 and 4 fit: the detection → flag → owner-check sequence is clear but only briefly developed. Retain this as a genuine adjacent boundary. |
| `cal-woodwork` structure | 4 / 3 | 3: one claim with a simple reason is the guide's explicit thin-answer example. |
| `cal-alert-claim` relevance | 2 / 1 | 2: alert creation is a related subtopic, though the requested validation method is absent. Unsupported claims affect support, not relevance. |
| `cal-alert-claim` structure | 2 / 3 | 3: the verification instruction refers back to the claim, making a thin but discernible link. Its credibility does not lower structure. |

The adjudicator found **three departures from the existing guide and one genuine 3/4 boundary**, and recommended no further wording change from this small set. The prospective guide therefore stays as committed in `787923d`; a future label on a similarly borderline transcript may use a justified adjacent range **before** seeing any model feedback, with independent approval. The frozen 3.2 labels, outputs and 35 failed comparisons remain unchanged.

No new subscription/paid model evaluation is warranted from this calibration alone: the feedback contract has not changed, and reusing these post-run challenge cases as if they were blind release labels would not repair the existing failed gate. A future model evaluation should follow a separately reviewed product-contract change and pre-approved labels, with a concrete request budget presented for user approval first. Release remains **BLOCKED** by the 3.2 label comparison and pending persona gate. This calibration used no subscription-model evaluation request, port 4310, real practice data, push or release tag; the artifacts verify the ratings and hashes, while the tool-use account is a process attestation.
