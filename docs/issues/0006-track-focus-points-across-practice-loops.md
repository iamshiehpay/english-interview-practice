---
status: completed
---

# Track Focus Points across Practice Loops

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

34–39

## What to build

Extend locally persisted Practice Records into an evidence-backed progress view. Each completed Practice Loop retains one Focus Point. A pattern becomes a Recurring Weakness only when the learner confirms it or evidence links it across at least two separate loops. The learner can inspect active, improving, and resolved patterns and use them to influence question recommendations.

Provide local data controls for deleting an individual Practice Record and all product data. Deletion must not leave a Recurring Weakness claiming evidence that no longer exists.

## Acceptance criteria

- [x] Every completed Practice Loop can retain exactly one primary Focus Point.
- [x] A one-off Focus Point is not automatically presented as a Recurring Weakness.
- [x] A Recurring Weakness requires learner confirmation or supporting evidence from at least two separate Practice Loops.
- [x] Recurring Weaknesses can move between active, improving, and resolved states with inspectable evidence.
- [x] Question recommendations can consider unresolved Focus Points without preventing manual selection.
- [x] The learner can delete one Practice Record and derived progress state remains consistent.
- [x] The learner can delete all locally stored product data through an explicit confirmation flow.
- [x] API-level tests cover promotion, rejection, status transitions, evidence removal, restart persistence, and deletion.

## Blocked by

- [Issue 0001](./0001-complete-a-text-practice-loop-from-a-pasted-jd.md)

## Verification

Independent reviewer passed all eight criteria. [Evidence](../verification/0006.md).
