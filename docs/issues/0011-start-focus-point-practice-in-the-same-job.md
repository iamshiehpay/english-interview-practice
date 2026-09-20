# 0011 — Start Focus Point practice in the same job

Status: ready-for-human

Implemented and verified by automated API tests and a focused browser regression on 2026-09-20 (isolated workspaces). Human learner acceptance is still pending; see [verification](../verification/second-round-0010-0013.md).

## Parent

[Second-round Practice Loop improvements](../prd-second-round-improvements.md)

## What to build

Turn a saved Focus Point into a new, same-JD scenario question. Preserve its source record and frozen resume version, and after completion report whether the targeted focus improved or still needs practice without requiring a learner-managed skills list.

## Acceptance criteria

- [x] The learner can start a new practice from a saved Focus Point under the same Job Snapshot. (`POST /api/records/from-focus`; "針對這個重點再練一次" on a completed record.)
- [x] The new record preserves source attribution and does not overwrite older answers or resume versions. (`focusOrigin` on the new record; the source record and its frozen `snapshot.resume` are untouched.)
- [x] Completion presents evidence-grounded focus progress without fabricated improvement. (`.focus-progress` panel shows the source Focus Point beside the new priority and its quote, and states the system will not claim improvement.)
- [x] Isolated API and browser tests cover new-record creation, history preservation, and progress display. (`test/focus-practice.test.js`; `test/browser-smoke.js`.)

## Blocked by

0009, 0010.
