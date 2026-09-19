---
status: completed
---

# Discover jobs from a Job Search Profile

## Parent

[Adaptive English Interview Coach PRD](../PRD.md)

## User stories covered

5–10, 41

## What to build

Let the learner create and edit a Job Search Profile, run an on-demand read-only discovery across replaceable Job Source adapters, inspect why results match, and select one result to create a Job Snapshot. The existing paste-JD path remains the reliable fallback when a live source is unavailable.

Discovery is user-initiated and bounded. This slice does not log in, save jobs remotely, apply to jobs, perform scheduled crawling, or distribute scraped job data.

## Acceptance criteria

- [x] The learner can edit desired roles, locations, seniority, work arrangements, priorities, and exclusions.
- [x] An on-demand discovery run uses a replaceable Job Source contract with at least one configured implementation and one deterministic fake.
- [x] Results show their source and an inspectable explanation of why they matched the Job Search Profile.
- [x] Selecting a result creates an immutable, time-stamped Job Snapshot containing the captured posting and source URL.
- [x] A changed or unavailable live posting does not mutate an existing Job Snapshot.
- [x] The paste-JD flow remains available when no Job Source can return results.
- [x] Requests are read-only, bounded, and expose rate-limit or provider errors without silently retrying indefinitely.
- [x] API-level tests cover filtering, exclusions, result selection, snapshot immutability, unavailable sources, and fallback behavior.

## Blocked by

- [Issue 0001](./0001-complete-a-text-practice-loop-from-a-pasted-jd.md)

## Verification

Independent reviewer passed all eight criteria. [Evidence](../verification/0004.md).
