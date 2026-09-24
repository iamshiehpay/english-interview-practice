---
status: needs-triage
---

# Do not report an empty bilingual audit as automatically passing

## Context

The failed 0035 run wrote `evaluation/v3/codex-bilingual-audit.json` with `cases: []` and `automaticPass: true`. `evaluation/run.js` applies `every` to an empty array. The raw report correctly has `automatedPass: false`, and offline review rejects missing/insufficient artifacts, so this is misleading standalone audit evidence rather than a release-gate bypass.

## Proposed scope

Require complete expected case/repeat coverage before an audit can report automatic success. Add regression tests for no outputs, partial outputs, and a complete passing audit. Preserve failed-run evidence and do not make model calls to test this condition.

## Comments

2026-09-24: Filed by coordinating AI after independent review. No runner change was made during 0035 to avoid altering the captured one-shot source or broadening scope.
