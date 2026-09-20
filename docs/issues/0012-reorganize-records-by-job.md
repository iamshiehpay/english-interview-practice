# 0012 — Reorganize Records by job

Status: ready-for-human

Implemented and verified by automated API tests and a focused browser regression (desktop 1440×900 and mobile 390×844) on 2026-09-20 (isolated workspaces). Human learner acceptance is still pending; see [verification](../verification/second-round-0010-0013.md).

## Parent

[Second-round Practice Loop improvements](../prd-second-round-improvements.md)

## What to build

Replace the Records surface with a warm, single-column job-centred list. Show the most recent unfinished practice first, group records by job, support search/filter/pagination/renaming, move deletion to a more menu, and retain an entry point for jobs with no completed practice. Job detail nests a primary question and its follow-ups in one Practice Record and only expands one selected answer version at a time.

## Acceptance criteria

- [x] Jobs sort by recent activity and show brief title, recent activity, and completed-primary count only. (`renderHistory`; `jobActivity`.)
- [x] Unfinished practice, searching, filtering, paging, rename, deletion menu, and empty-job start entry all work without deleting unrelated data. (Continue card, `#job-search`, `#job-filter`, pager, inline rename via `POST /api/snapshots/:id/title`, per-job/record `.more-menu` deletion, always-present "開始新練習/產生題目".)
- [x] Details preserve historical questions, answer versions, feedback, and follow-up grouping. (Job detail lists each Practice Record; opening one reuses `showRecord`, which nests the primary question, one answer version at a time, and follow-up grouping.)
- [x] Desktop and mobile browser checks show a reachable single-column layout with no horizontal overflow. (`test/browser-smoke.js` at 1440×900 and 390×844.)

## Blocked by

0009 — follow-up grouping contract.
