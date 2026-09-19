# Known limitations and release blockers

The current portfolio is a runnable engineering demonstration, not a completed real-user MVP validation.

- Human expectations are pending for all twenty cases. AI-authored guidance is explicitly separate from human labels.
- The creator has not yet attested to five real Practice Loops. Synthetic evaluation and browser smoke do not count.
- The shipped evaluation defaults to a deterministic fake with fixed level2 ratings. Its 100% stability proves repeatability of the pipeline, not sensitivity, fairness, learning gains or live-model quality. No paid/live evaluation has been performed.
- Exact citations, links and quotes establish structural grounding, not semantic entailment. Forbidden phrase sentinels cover specific invented requirements and achievements; they do not detect every paraphrase and can flag a cautionary mention. Such failures require human adjudication and a versioned fixture change, never silent removal.
- Free-text instructions can contain prompt injection. Provider instructions treat input as untrusted; exact schemas cannot prove arbitrary prose follows every instruction. Actual model behavior requires adversarial human-reviewed evaluation.
- Synthetic examples have no verified resume evidence. Their claims stay unverified. Approved/rejected evidence routing is covered separately by API regression tests.
- Job discovery uses lexical matching on one configured public Greenhouse board. It does not search the whole job market or infer suitability.
- Candidate claim extraction is conservative and incomplete. Exact Focus Point grouping does not merge semantic synonyms.
- Fake speech returns a labelled sample transcript. Real microphone support varies by browser and permission; transcript review remains mandatory. No pronunciation, accent, emotion or personality judgments are made.
- Local persistence assumes one server process and a trusted local account. It is not an encrypted multi-user service. Compact successful receipts grow until full data deletion.
- External providers may charge and retain data according to their terms. Cancellation cannot recall transmitted data or prevent every charge. `store:false` is not a promise of zero provider retention.

Failure regression coverage includes invalid source citations, unsupported facts, malformed links/categories, bad feedback quotes, extra answer fields, rate limits, model timeout, transcription failure, cancel/late output, deletion races, interrupted restart and duplicate retry. See [verification records](../verification/0007.md) and `npm test`.
