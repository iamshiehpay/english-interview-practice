# Goal: implement issues 0029–0036 with $implement, verify each one independently, and loop until all are done

Created 2026-09-24. For Codex; subagents map to the custom roles in `~/.codex/agents/`.

## Background
- PRD for this round: `docs/prd-v1-readiness.md`; issues: `docs/issues/0029`–`0036`; index: `docs/issues/README.md`.
- v1.0.0 is an **AI-validated release** (see the last decision in `docs/next-steps-discussion.md`): there are no creator-only gates. Persona practice and labelling are done by AI and always honestly marked as AI. **Never sign or approve anything in the user's name.**
- The user has **pre-authorised** the Codex evaluation in 0035: exactly one run, about 65 subscription calls. If it fails, record why; never re-run it automatically.
- Do not ask the user anything. Stop and report only under the stop conditions below.

## Before starting (delegate the reading; the main agent only receives summaries)
- Have `repo-scout` read the PRD, the eight issues, `AGENTS.md`, `CONTEXT.md`, `docs/agents/issue-tracker.md` and the working rules in `docs/next-steps-discussion.md`, and return a summary.
- The main agent only coordinates: scheduling, dispatching, judging verification results, updating issue status and committing. **It does not write feature code itself.**

## Subagent roles (~/.codex/agents)

| Purpose | Agent |
|---|---|
| Coordination | main session |
| Frontend implementation (`public/`) | `frontend-developer` |
| Backend / evaluation implementation (`src/`, `evaluation/`) | `backend-developer` |
| Running tests and browser smoke, collecting verification evidence | `test-automator` |
| `$code-review`, bilingual semantic review, label approval | `reviewer` (read-only) |
| Finding and reading files | `repo-scout` |
| Mapping code paths before a change | `code-mapper` |
| Root-causing after two failed fix rounds | `debugger` |

- Assignments:
  - `frontend-developer`: 0029, the UI part of 0031, 0032.
  - `backend-developer`: the server part of 0031, 0033, step 1 of 0035, the label check in 0036.
- Persona work (the persona practice loop in 0034, the rater-persona drafting in 0036): write the persona card before starting. The drafter and the approver must be **different agents**.
- At most three subagents run at once. **0029, 0031 and 0032 all change `public/app.js` and `test/browser-smoke.js`, so they must run one after another, never in parallel.**

## Schedule
- Track A (sequential): 0029 → 0031 → 0032 → 0034
- Track B (parallel with A): 0033 (0034 also waits for it)
- Track C (parallel with A): 0030 → 0035 → 0036
- Before starting an issue, confirm every issue in its "Blocked by" is `completed`.

## Per-issue loop
1. **Implement**: dispatch the matching developer agent. The brief contains only the PRD, **the full text of that one issue**, and the hard rules below.
   - It uses `$implement`: `$tdd` wherever possible, at the seams in the PRD's Testing Decisions; run single test files along the way and the full `npm test` at the end. For UI work also run `node --check public/app.js` and `npm run test:browser`.
   - **Do not commit yet.** Report: files changed, tests added, and evidence for each acceptance criterion.
2. **Verify**: dispatch `test-automator` to re-run every verification command independently.
   - For UI issues, use `$agent-browser` on its own port with a temporary `WORKSPACE_DIR` and exercise the screens, including a 360 px width.
   - Check every acceptance criterion with reproducible evidence (test name, command output, file and line).
   - In parallel, dispatch `reviewer` to run `$code-review` against the commit from before the issue started.
   - The issue passes only when both report PASS.
3. **Fix**: on any FAIL, send the concrete list back to **the same** developer agent, then return to step 2.
   - If round 2 still fails, dispatch `debugger` to find the root cause first.
   - If round 3 still fails, set the issue to `needs-info`, explain under `## Comments` exactly where it is stuck, and move on to unaffected issues.
4. **Close out** (main agent):
   - Tick the acceptance criteria (`- [x]`) and append to `## Comments`: date, verification commands and result summary, known limitations, and anything found that is out of scope.
   - Set the front-matter `status` to `completed` and update the status column in `docs/issues/README.md`.
   - File out-of-scope problems as new issues (`docs/issues/0037-…` onwards, status `needs-triage`); do not fix them in passing.
   - One commit per issue (rules below).
5. Continue with the next issue until 0029–0036 are all `completed`, or only `needs-info` issues remain.

## Issue-specific notes
- **0030**: run the real check against **the agent's own test server** (another port, temporary `WORKSPACE_DIR`, JD files in a temporary folder), never 4310. The skill's base URL must be overridable.
- **0033**: verify every ledger field against `.workspace/persona-qa-2026-09-23/workspace.json` (**read-only**), not against the prose. Leave `creator`, `attestedBy` and `attestedAt` null.
- **0034**: on the agent's own server, with the real Codex provider and fake speech, a persona uses `$agent-browser` to complete one full Practice Loop on a Common Question. Only a verifier that **did not run the loop** may set `attestedBy` / `attestedAt`; `creator` stays null.
- **0035**: first make `evaluation/review-report.js` support v3, with tests; then run `npm run evaluate -- --codex --accept-subscription-usage` **exactly once**.
  - The semantic review is done by `reviewer`, never by the agent that ran the evaluation.
  - If network or codex-binary access is blocked, request escalation through the normal flow; never work around the sandbox.
- **0036**:
  - A rater persona drafts; `reviewer` approves case by case with `reviewerType: "ai"`. No bulk approval, and never claim the labels are human.
  - Finish with `node evaluation/review-report.js`, which **makes no model calls**.
  - The summary's release status may only read "AI-validated", and it lists the human validation still to do after v1.0.0.
  - **Do not create the v1.0.0 tag.**

## Hard rules (paste verbatim into every subagent brief)
- The user's app runs on 127.0.0.1:4310: **never stop, restart or call it**. No `pkill` / `killall` or any name-matched process kill. Test on your own port with a temporary `WORKSPACE_DIR` and stop only your own PID.
- agent-browser closes only its own `--session`; never `close --all`.
- Do not read or write `.workspace/` unless an issue explicitly asks for read-only access. Never delete or modify real resumes, Job Snapshots or practice records.
- After changing any `src/codex-*.js`, run `npm run codex:verify`.
- If the static-file allowlist in `src/server.js` changes, **remind the user to restart 4310** in the final report.
- Do not change the model contract or call paid or subscription models unless an issue explicitly requires it (0035, 0034).
- New behaviour needs new tests; an old PASS is not acceptance for new work. Report failing test output as it is.

## Commit rules (Codex has no hook for these; follow them yourself)
- Conventional Commits: `type: Capitalized description` (type is feat | fix | refactor | docs | chore | perf | revert), capitalised, no trailing period.
- **No** Co-Authored-By or any AI trailer.
- Run `git add` and `git commit` separately, with `git commit` as its own command. For a body, write the message to a temporary file and use `git commit -F <file>`.
- Commit only to the current branch; no push, no tag.

## Stop conditions and final report
Stop when everything is done or only `needs-info` issues remain, and report to the user in Traditional Chinese:
- Each issue's status, commit hash, a verification-evidence summary, and the agents used
- The 0035 evaluation result, the status of the four gates (automated / semantic / labels / creator) and the release status
- Anything the user must do (e.g. restart 4310), and any new issues from 0037 onwards
