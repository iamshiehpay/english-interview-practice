# 0012 — Reorganize Records by job

Status: ready-for-agent

## Parent

[Second-round Practice Loop improvements](../prd-second-round-improvements.md)

## What to build

Replace the Records surface with a warm, single-column job-centred list. Show the most recent unfinished practice first, group records by job, support search/filter/pagination/renaming, move deletion to a more menu, and retain an entry point for jobs with no completed practice. Job detail nests a primary question and its follow-ups in one Practice Record and only expands one selected answer version at a time.

## Acceptance criteria

- [ ] Jobs sort by recent activity and show brief title, recent activity, and completed-primary count only.
- [ ] Unfinished practice, searching, filtering, paging, rename, deletion menu, and empty-job start entry all work without deleting unrelated data.
- [ ] Details preserve historical questions, answer versions, feedback, and follow-up grouping.
- [ ] Desktop and mobile browser checks show a reachable single-column layout with no horizontal overflow.

## Blocked by

0009 — follow-up grouping contract.
