# 0009 — Add bounded optional follow-ups

Status: completed

## Parent

[Second-round Practice Loop improvements](../prd-second-round-improvements.md)

## What to build

Deliver a complete primary-answer-to-follow-up path. After Chinese feedback on a primary Answer Attempt, the Target Learner can request a grounded follow-up, answer it, receive Chinese feedback, then either ask the next follow-up or end. Preserve frozen formal-answer context, enforce a maximum of two follow-ups, and retain existing cancellation, retry, drafts, primary revision, and old-record behaviour.

## Acceptance criteria

- [ ] A feedback-complete primary answer can start a follow-up; generated assistance is excluded from saved interview context.
- [ ] Each follow-up is separately persisted, receives Chinese feedback, and only then enables a second follow-up or ending.
- [ ] The record rejects more than two follow-ups and permits an early end without losing saved feedback.
- [ ] Changing a primary answer later cannot rewrite a previously saved follow-up source snapshot.
- [ ] Provider retry/cancellation/deletion and restart persistence keep records consistent.
- [ ] API and browser regression checks cover the bounded visible flow, including a mobile layout check.

## Blocked by

None — can start immediately.

## Comments

2026-09-19: Implemented and verified. See [follow-up verification](../verification/optional-follow-ups-0009.md). The API keeps primary Answer Attempts separate from `followUps`, freezes the first formal primary transcript for the whole follow-up thread, excludes all model feedback/coaching from provider input, enforces the two-question bound, and prevents completion while a submitted follow-up awaits feedback.
