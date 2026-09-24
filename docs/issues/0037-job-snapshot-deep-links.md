---
status: completed
---

# Direct links to individual Job Snapshots

## Parent

[PRD v1 readiness](../prd-v1-readiness.md), user story 19; discovered during [0030](./0030-find-104-jobs-skill.md).

## Context

The 104 import skill returns a snapshot ID and app base URL. The app has no verified URL/hash route to open that snapshot directly. Issue 0030 explicitly excludes product changes and accepts the ID, but the broader PRD asks for a snapshot link that goes straight to practice.

## Proposed scope

Define a stable local snapshot URL, resolve it safely on initial load, handle unknown/deleted IDs, and have the skill report that verified link format. Preserve normal navigation and add browser coverage for direct entry and missing snapshots. This is a triage proposal, not an approved expansion of 0030.

## Comments

2026-09-24: Filed by the coordinating AI after independent reviewer confirmation. No routing change was made during 0030.

2026-09-24: Added the verified local route `/#/snapshots/<UUID>`. Initial load resolves only a UUID present in the current workspace. An existing Question Set opens at its recommendation; a snapshot without questions offers an explicit generation action without making a model call on entry. Missing, deleted, and malformed links open practice history with an error. Leaving via normal navigation clears the route. The 104 import skill now reports this URL after a successful snapshot POST. Isolated fake-provider browser coverage is in `npm run test:browser:deep-links`; see [0037 handoff](../verification/0037-deep-link-handoff.md). Implementation complete; no release validation is implied.
