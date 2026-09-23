# 0010 — Add evidence-safe key-sentence corrections

Status: awaiting-human-validation

Implemented and verified by automated API tests and a focused browser regression on 2026-09-20 (deterministic demonstration provider, isolated workspaces). Human learner acceptance is still pending; see [verification](../verification/second-round-0010-0013.md).

## Parent

[Second-round Practice Loop improvements](../prd-second-round-improvements.md)

## What to build

After each formal feedback report, surface at most two necessary English sentence corrections: original sentence, a fact-preserving rewrite, and a concise Traditional Chinese reason. Show no fabricated correction when none is warranted; keep the full English demonstration on demand.

## Acceptance criteria

- [x] Corrections are stored separately from Answer Attempts and preserve original facts, uncertainty, limitations, and missing experience. (`record.corrections[attemptId]`; `validateCorrections` requires `original` to be a verbatim transcript substring and rejects numbers not already present.)
- [x] The UI shows zero to two corrections with original, rewrite, and Chinese rationale. (`correctionsHtml`, `.correction-card`; a no-change note when empty.)
- [x] Old records remain readable and do not get silently re-evaluated. (Corrections are only generated on an explicit or fresh-feedback request; reopening a record never generates them.)
- [x] API tests and a focused browser regression cover normal, no-change, retry, and evidence-safety paths. (`test/corrections.test.js`; `test/browser-smoke.js`.)

## Blocked by

0009 — follow-up answer surfaces establish the per-answer integration point.
