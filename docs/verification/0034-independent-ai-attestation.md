# Issue 0034: independent AI attestation

Attested at 2026-09-24T06:57:10Z by Codex AI independent verifier
`/root/attest0034`. This verifier did not operate the fifth Practice Loop.
The attestation is for an **AI persona** ledger; `creator` remains `null`.

I checked all five entries in [`evaluation/v3/creator-validation.json`](../../evaluation/v3/creator-validation.json).
For runs 2–5 of the original walkthrough, I read the explicitly authorized
historical backup `.workspace/persona-qa-2026-09-23/workspace.json` read-only
(SHA-256 `80368cbb65ff52311c9ebba50930f48bdc30300bb38a1d9fdcf83130fc8c9a03`).
For the new Common Question loop, I read the sanitized durable copy
[`workspace.json`](persona-common-questions-2026-09-24/workspace.json)
(SHA-256 `ad768b27cf9131c61cdcae62f422f1bfec70e6b4145a40bb6c06a009a74ae04f`).
All five ledger record IDs, snapshot IDs, categories, completion timestamps,
completed states, and final answer input modes exactly match their respective
workspace records. Every referenced snapshot exists and each completed record
has a Focus Point.

The fifth record `88e911ee-047a-4d19-98cc-05a904118e0f` has the fixed
`self-introduction` Common Question, one text answer with feedback, no optional
follow-ups, and a saved Focus Point. Its isolated workspace has successful
first-attempt `analysis`, `feedback`, and `corrections` operations. I compared
the stored text answer against the fixed persona card: it stays within the
listed backend tools, internal RAG FAQ, 50-question manual check, and stated
experience gaps; it adds no accomplishment or metric. The stored feedback's
strength, priority-improvement, and four rating quotes are verbatim substrings
of that answer, and the English/Chinese reasons make the same assessments. I
also compared
the [walkthrough](persona-common-questions-2026-09-24.md) with its question-set,
feedback, completed, reloaded-history, and progress screenshots. The UI
screenshots show the Common Question and completed Practice Loop. The provider
banner in the walkthrough evidence identifies Codex; operation receipts show
successful provider operations but do not independently count subscription
turns.

The original [walkthrough](persona-walkthrough-2026-09-23.md) documents the
persona and synthetic operation for runs 2–5. The run-4
[canceled-state screenshot](persona-walkthrough-2026-09-23/loop4-cancelled.png)
(SHA-256 `2207778e8cea4af3cfefbe09dc08904b97502db0f055b1a5cc48efad7770c84c`)
shows feedback canceled and retryable; the backup retains a successful feedback
receipt for the same record at attempt 2. The first attempt was overwritten in
the backup, so I do not claim a saved canceled operation exists. The accepted
cross-source interpretation and its limit are detailed in
[`0033-ledger-provenance.md`](0033-ledger-provenance.md).

The five unique records cover four Job Snapshots and four Question Categories.
Run 2 supplies the documented Experience Gap; run 4 supplies the documented
cancellation and recovery. Every entry is marked `synthetic: true`, names
persona 林小安, and links a verification document. No entry is represented as
creator or human validation. This evidence supports the AI persona gate; it
does not validate real speech or a real learner's experience.

`npm run evaluate` completed offline after allowing its temporary localhost
listeners: 60/60 deterministic case runs, stability 80/80, and the creator gate
reported `{ "pass": true, "count": 5, "validationMode": "ai-persona",
"errors": [] }`. The overall release remained `BLOCKED` because independent
bilingual semantic review, reviewed labels, and live-model quality evidence
were still pending at this check. This offline command made no model calls.

The first sandboxed `npm test` and `npm run evaluate` attempts failed with
`listen EPERM` on temporary `127.0.0.1` servers. Under the permitted localhost
test execution, `npm test` reported 215 passed and one failed: the existing
`test/evaluation.test.js` fixture expected the earlier four-loop ledger and
null attestation. That assertion must be updated for the completed fifth loop;
it is not an observed product failure. No test result is claimed as passing
until that regression test is updated and rerun.

## Follow-up after the test fixture was updated

The original developer updated only the stale ledger assertion in
`test/evaluation.test.js` to expect five completed persona loops and the
independent AI attestation. I inspected that focused diff and ran
`git diff --check` for the test, ledger and this verification document; it
reported no whitespace errors. The full `npm test` rerun then passed
**216/216, zero failures**. The earlier 215/216 failure above remains recorded
as the pre-fix result. The already completed offline evaluation was not rerun
because this change only corrected the test's expectation.
