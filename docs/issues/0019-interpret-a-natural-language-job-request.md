---
status: ready-for-human
---

# Interpret a natural-language job request into a confirmed Job Search Profile

## Parent

[PRD — Natural-language curated job discovery](../prd-curated-job-discovery.md)

## User stories covered

1–9, 47, 49

## What to build

Let the learner write what they want — "根據我的履歷，幫我找台灣適合轉職的 AI 職缺" —
and turn it into a Job Search Profile they confirm before anything is searched.

A new model contract receives only the learner's request text and the profile field
names and returns lists for each field, leaving a field empty when the learner did
not state it. It never guesses a preference. The learner's text is treated as
untrusted data, as every other model input already is. The returned proposal is
validated exactly like a learner-entered profile, then shown for confirmation: the
learner can edit or clear any field, and only confirmation saves it as their Job
Search Profile. An invalid provider output leaves the saved profile untouched and
says so.

The Job Search Profile gains a `salary` field alongside its existing six, stored as a
list of learner-stated strings like the others. Profiles saved before this change
load with the new field empty; the full set is required only on write.

Searching with the saved profile and no new sentence stays available. Interpretation
runs through the long-running operations tracker so it is cancellable, retryable and
idempotent per request identifier. The interface discloses that the request text is
sent to the configured model.

## Acceptance criteria

- [x] A learner can write a request in Chinese or English and see the criteria that
      were understood, as separate fields for role, seniority, location, work
      arrangement, salary, priorities and exclusions.
- [x] A field the learner did not state comes back empty rather than guessed.
- [x] The learner can edit or clear any field before confirming.
- [x] Nothing is saved until the learner confirms; confirming saves the profile.
- [x] An invalid provider output is rejected and the saved profile is unchanged.
- [x] Searching with the saved profile and no new request text still works.
- [x] A profile saved before this change loads with an empty salary field and can be
      re-saved with the full set.
- [x] Interpretation is cancellable and retryable through the operations tracker, and
      a repeated request with the same identifier does not call the provider twice.
- [x] The interface states that the request text is sent to the configured model.
- [x] Deleting all local data removes the saved profile.
- [x] API-level tests cover: unstated fields staying empty, validation rejecting an
      invalid proposal without changing the saved profile, the proposal not being
      saved before confirmation, and legacy six-field profiles loading.
- [x] Browser smoke covers typing a request, seeing the proposed criteria, editing one
      field, and confirming.

## Blocked by

None — can start immediately.

## Verification

Implemented and verified through the API and browser seams.
[Evidence](../verification/0019.md). No independent review yet, and interpretation
quality with a configured model is pending human validation.
