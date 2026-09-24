---
status: completed
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
5. Checks that the app answers on its base URL (default `127.0.0.1:4310`, overridable so tests can target another port); if so, creates one Job
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

- [x] The skill exists with valid frontmatter and a description that triggers on 104 job-search requests.
- [x] It enforces the default three / explicit five import limit.
- [x] Saved files follow the naming, first-line and second-line rules and live only in `.workspace/jds/`.
- [x] Duplicate 104 postings are skipped with a message; `.workspace/validation-jds/` is never written.
- [x] Snapshots are created only through the existing endpoint; no questions are generated.
- [x] An unreachable app produces a clear message and no server control actions.
- [x] Agent-run check (recorded under Comments): against the agent's own server (another port, temporary `WORKSPACE_DIR`, JD files in a temporary folder), one real job104 search imports 1–3 postings whose job titles read `職稱 — 公司`; a second run with the same posting skips it; no questions were generated; 4310 was never contacted.

## Files likely touched

- `.claude/skills/find-104-jobs/SKILL.md` (new)
- `.gitignore` only if `.workspace/` coverage turns out incomplete (it currently ignores `.workspace/`)

## How to verify

```sh
git check-ignore .workspace/jds/example.txt
# then run the skill against your own test server (not 4310), e.g.
# /find-104-jobs 台北 後端工程師 Python  (base URL overridden to the test port)
```

## Blocked by

None — can start immediately.

## Comments

### 2026-09-24 — AI implementation, independent check and review

- Implemented by `backend-developer`; independent `test-automator` verified all seven criteria; `reviewer` returned Standards PASS and issue Spec PASS.
- `git check-ignore -v .workspace/jds/example.txt` confirms `.gitignore:1`; frontmatter, selection, three/five cap, safe paths and provenance rules were reviewed directly in the Markdown skill.
- Real job104 MCP search/detail was exercised via its installed Python SDK stdio transport. The independent disposable acceptance script `/private/tmp/issue0030_acceptance.py` ran with `/Users/shiehpay/Desktop/resume/.tools/job104-mcp/.venv/bin/python`, using an isolated server on port 62171 and temporary workspace/JD directories. It returned 12 candidates and imported selected posting `8t66j` as `資深後端工程師 — 聯想感行銷科技股份有限公司`, with URL/retrieval date on line two; created snapshot `cb612487-787e-403e-beec-ea3e0251ae23`; repeated selection skipped the duplicate. Workspace totals: one snapshot, zero analyses, zero records. The unreachable-app case retained the JD and reported failure. No request to 4310 occurred; only the owned test server was stopped. The developer separately completed the same real check on port 60902.
- This instruction skill was verified through static review and a script following its workflow, not an executable skill interpreter. Import limits and other unexercised edge rules are instruction-reviewed, not claimed as runtime-tested. Public 104 network and loopback access used the normal escalation flow.
- PRD story 19 requests a direct snapshot link, but this issue explicitly accepts its ID and excludes app changes. The app currently has no snapshot URL route; the skill honestly supplies ID plus base URL. Follow-up [0037](./0037-job-snapshot-deep-links.md) tracks that out-of-scope gap.
