---
status: ready-for-human
---

# Creator completes one real Practice Loop and attests the ledger

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

44

## Context

Under ADR 0020 the gate needs at least one real, non-synthetic creator loop,
and `creator` / `attestedAt` may be filled only after the creator personally
confirms. Doing this loop after 0031 and 0032 ship lets it double as a real check
of the Common Questions, but that is not required.

## What to build

- The creator completes one full Practice Loop in the real app on
  `127.0.0.1:4310` with their own answer (any category; text or voice).
- An agent reads the resulting record from the real workspace (read-only) and
  adds one `synthetic: false` loop to the ledger with its real record id,
  snapshot id, category, completion time and input mode; it adds
  `experienceGap` / `inducedFailure` only if they genuinely happened.
- After the creator reviews the entry and says so, `creator` and `attestedAt`
  are filled.

## Acceptance criteria

- [ ] The ledger contains the creator's real loop with values matching the stored record.
- [ ] `creator` and `attestedAt` were filled only after the creator's explicit confirmation (recorded under Comments with the date).
- [ ] The creator-status check passes (`npm run evaluate` shows the creator gate as PASS).
- [ ] No stored learner record was modified.

## Files likely touched

- `evaluation/v3/creator-validation.json`

## How to verify

```sh
npm test
npm run evaluate
```

## Blocked by

- [Issue 0033](./0033-adr-0020-revised-creator-gate.md)

## Comments
