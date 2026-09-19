# 0010 — Add evidence-safe key-sentence corrections

Status: ready-for-agent

## Parent

[Second-round Practice Loop improvements](../prd-second-round-improvements.md)

## What to build

After each formal feedback report, surface at most two necessary English sentence corrections: original sentence, a fact-preserving rewrite, and a concise Traditional Chinese reason. Show no fabricated correction when none is warranted; keep the full English demonstration on demand.

## Acceptance criteria

- [ ] Corrections are stored separately from Answer Attempts and preserve original facts, uncertainty, limitations, and missing experience.
- [ ] The UI shows zero to two corrections with original, rewrite, and Chinese rationale.
- [ ] Old records remain readable and do not get silently re-evaluated.
- [ ] API tests and a focused browser regression cover normal, no-change, retry, and evidence-safety paths.

## Blocked by

0009 — follow-up answer surfaces establish the per-answer integration point.
