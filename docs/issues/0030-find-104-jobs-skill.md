---
status: ready-for-agent
---

# `/find-104-jobs` project skill: search 104, save clean JDs, create Job Snapshots

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

5–19

## Context

A creator tool, not a product feature: the app does not change. The job104 MCP
works without login (checked 2026-09-23); no credentials may be requested or
stored (ADR 0013). The Job Snapshot endpoint does **not** deduplicate identical
JD text, and a snapshot's title comes from the first line of its text.
`.workspace/validation-jds/` is the creator-validation runbook's fixed five-JD
set and must not be touched.

## What to build

A Claude Code project skill at `.claude/skills/find-104-jobs/`, written per the
writing-for-agents guidance, that:

1. Takes a natural-language request, searches 104 through the job104 MCP and
   lists about ten candidates (title, company, location, link).
2. Lets the creator pick; imports at most three per run by default, up to five
   only on explicit request.
3. Before importing, checks `.workspace/jds/` for an existing file with the same
   104 job id / URL and skips duplicates with a message.
4. Saves each JD to `.workspace/jds/YYYY-MM-DD-<company>-<title>.txt`
   (slugified): line 1 `職稱 — 公司`, line 2 the source URL and retrieval date,
   then the JD body from the job104 detail tool.
5. Checks that the app answers on `127.0.0.1:4310`; if so, creates one Job
   Snapshot per file through the existing snapshot endpoint with the file text.
   If not, keeps the files and reports that snapshots were not created. It never
   starts, stops or restarts the server and never uses `pkill`/`killall`.
6. Never triggers question generation, never answers questions, never writes
   practice records.
7. Reports, per posting: file path, job title and the created snapshot id (or
   the skip / failure reason).

The skill text must state that the first request to 4310 may need the creator's
permission approval.

## Acceptance criteria

- [ ] The skill exists with valid frontmatter and a description that triggers on 104 job-search requests.
- [ ] It enforces the default three / explicit five import limit.
- [ ] Saved files follow the naming, first-line and second-line rules and live only in `.workspace/jds/`.
- [ ] Duplicate 104 postings are skipped with a message; `.workspace/validation-jds/` is never written.
- [ ] Snapshots are created only through the existing endpoint; no questions are generated.
- [ ] An unreachable app produces a clear message and no server control actions.
- [ ] Creator-run check (recorded under Comments): one real run imports 1–3 postings whose job titles read `職稱 — 公司` in the app; a second run with the same posting skips it; 4310 is still running afterwards.

## Files likely touched

- `.claude/skills/find-104-jobs/SKILL.md` (new)
- `.gitignore` only if `.workspace/` coverage turns out incomplete (it currently ignores `.workspace/`)

## How to verify

```sh
git check-ignore .workspace/jds/example.txt
# then, in a Claude Code session with the app running on 4310:
# /find-104-jobs 台北 後端工程師 Python
```

## Blocked by

None — can start immediately.

## Comments
