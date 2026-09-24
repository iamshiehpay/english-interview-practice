# Issue 0036 — independent verification

Verifier: Codex AI `/root/attest0034`, separate from the label drafter
`/root/persona0034` and approver `/root/review0031`. This check used the frozen
0035 Codex outputs and offline tools only; it made no model calls.

## Implementation and regression coverage

I read issue 0036, ADR 0020, and the changes to `evaluation/checks.js`,
`evaluation/review-report.js`, `evaluation/run.js`, and their tests. The label
validator now reports `human`, `ai`, or `mixed` mode; AI persona provenance
requires each approved label to declare `reviewerType: "ai"`, while untyped
legacy v1 and v2 human approvals retain their previous behavior. A partially
typed artifact is rejected. The offline review now compares approved rating
ranges and literal required/forbidden findings against **all three saved
repeats for each of twenty cases** before it can report `AI-validated`.
Existing deterministic constraints and the independent semantic and creator
gates remain required. Tests cover the valid AI path, missing/invalid types,
mixed and legacy human modes, and range/required/forbidden failures at the
offline release boundary.

`npm test` passed **222/222** with zero failures. `node --check
evaluation/run.js` and `git diff --check` both passed. The full suite ran with
permission for its own temporary localhost listeners. No `src/codex-*.js`
file or static-file allowlist was changed by this issue.

The raw 0035 report's ordered source checksum still matches its captured
pre-run source. The current whole-source checksum differs only in
`evaluation/run.js` and `evaluation/checks.js`, as expected for this offline
workflow change; all six protected model-contract file hashes still match
the live-run capture.

## Approved label artifact and saved-output comparison

The label artifact declares schema 2, contract 3.0.0, and
`persona-drafted-ai-approved` provenance with different drafter and approver
identities. Its twenty unique case IDs and input checksums match the frozen
Codex review packet; all twenty evidence-quote sets occur verbatim in their
respective transcripts. Every label names the recorded AI approver and
`reviewerType: "ai"`. `labelStatus` returns structural **PASS**, mode `ai`,
20 approvals, and no errors. This validates binding and schema; the separate
approver owns the substantive judgments.

`node evaluation/review-report.js` exited **1** and accurately reported:
bilingual semantic gate `PASS`, label gate `FAIL` with mode `ai`, creator gate
`PASS`, and release `BLOCKED`. Its label gate compared all **60** saved
feedback outputs and found eight genuine English-expression range mismatches:

| Case | Approved range | Saved levels by repeat | Failing repeats |
| --- | --- | --- | --- |
| `ai-experience-depth` | 3–4 | 2, 3, 2 | 1, 3 |
| `backend-behavioral` | 3–4 | 2, 2, 2 | 1, 2, 3 |
| `embedded-technical-communication` | 3–4 | 2, 2, 2 | 1, 2, 3 |

These are saved-model versus independently approved-label disagreements, not
schema or test failures. The gate must remain blocked unless a separate,
evidence-based review changes the approval or a new authorized evaluation
supplies different outputs. No label, frozen output, or model contract was
edited by this verifier. The remaining summary/status acceptance check will
be repeated when the issue's final report is available.

## Final verification after the runner gate fix

The developer moved runner gate construction into a shared function and added
regression tests for the distinction between automatic output failures and
approved-label mismatches. The new integration test reads the saved Codex run:
raw automatic checks remain PASS while its eight label comparisons block
release. I inspected that diff; the runner no longer appends label-comparison
failures to `raw.failures` or uses them to set `automatedPass`.

The final `npm test` rerun passed **224/224**. `node --check
evaluation/run.js` and `git diff --check` passed. `node
evaluation/review-report.js` exited **1** with bilingual `PASS`, AI label
`FAIL`, creator `PASS`, release `BLOCKED`. The reviewed report revalidates sixty
outputs, reports twenty approved AI labels, sixty comparisons, eight failures
and therefore **52/60** comparisons passing. Its only blocker is the label
expectation mismatch. The raw report still has automatic PASS with zero
automatic failures; source drift is confined to the two evaluation workflow
files, and protected model-source hashes remain matched as checked above.

The leading current-evidence section of
[`evaluation-v3-summary.md`](../portfolio/evaluation-v3-summary.md) matches
these gate states, says release `BLOCKED` rather than `AI-validated`, and
clearly identifies its older fake-provider section as historical. Issue
[`0041`](../issues/0041-separate-english-expression-from-content-quality.md)
records the eight English-expression mismatches without changing the approved
labels or original outputs. I resolved all four evidence links in issue 0041
to existing files. **Issue 0036 implementation acceptance passes**; its
released-product quality gate remains blocked by the genuine model/label
disagreement tracked in 0041. No model call or new live evaluation was made.
