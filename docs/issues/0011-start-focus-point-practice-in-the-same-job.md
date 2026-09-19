# 0011 — Start Focus Point practice in the same job

Status: ready-for-agent

## Parent

[Second-round Practice Loop improvements](../prd-second-round-improvements.md)

## What to build

Turn a saved Focus Point into a new, same-JD scenario question. Preserve its source record and frozen resume version, and after completion report whether the targeted focus improved or still needs practice without requiring a learner-managed skills list.

## Acceptance criteria

- [ ] The learner can start a new practice from a saved Focus Point under the same Job Snapshot.
- [ ] The new record preserves source attribution and does not overwrite older answers or resume versions.
- [ ] Completion presents evidence-grounded focus progress without fabricated improvement.
- [ ] Isolated API and browser tests cover new-record creation, history preservation, and progress display.

## Blocked by

0009, 0010.
