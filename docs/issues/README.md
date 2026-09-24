# Implementation Issues

Local issue tracker for the Adaptive English Interview Coach. All issues below were approved as tracer-bullet vertical slices. `awaiting-human-validation` means implemented and automatically verified (see `docs/verification/`), pending the creator's real-use check.

| Issue | Status | Blocked by |
|---|---|---|
| [0001 — Complete a text Practice Loop from a pasted JD](./0001-complete-a-text-practice-loop-from-a-pasted-jd.md) | completed | None |
| [0002 — Generate a grounded Capability Map and Question Set](./0002-generate-a-grounded-capability-map-and-question-set.md) | completed | 0001 |
| [0003 — Add voice-first Answer Attempts](./0003-add-voice-first-answer-attempts.md) | completed | 0001 |
| [0004 — Discover jobs from a Job Search Profile](./0004-discover-jobs-from-a-job-search-profile.md) | completed | 0001 |
| [0005 — Personalize with optional Candidate Evidence](./0005-personalize-with-optional-candidate-evidence.md) | completed | 0002 |
| [0006 — Track Focus Points across Practice Loops](./0006-track-focus-points-across-practice-loops.md) | completed | 0001 |
| [0007 — Harden the Local Workspace and provider controls](./0007-harden-the-local-workspace-and-provider-controls.md) | completed | 0001, 0003, 0004 |
| [0008 — Ship the Evaluation Suite and portfolio release](./0008-ship-the-evaluation-suite-and-portfolio-release.md) | awaiting-human-validation | 0002, 0003, 0005, 0006, 0007 |
| [0009 — Add bounded optional follow-ups](./0009-add-bounded-optional-follow-ups.md) | completed | None |
| [0010 — Add evidence-safe key-sentence corrections](./0010-add-evidence-safe-key-sentence-corrections.md) | awaiting-human-validation | 0009 (completed) |
| [0011 — Start Focus Point practice in the same job](./0011-start-focus-point-practice-in-the-same-job.md) | awaiting-human-validation | 0009, 0010 |
| [0012 — Reorganize Records by job](./0012-reorganize-records-by-job.md) | awaiting-human-validation | 0009 |
| [0013 — Refine Practice Loop UI clarity](./0013-refine-practice-loop-ui-clarity.md) | awaiting-human-validation | 0001, 0009, 0010 |
| [0014 — Read English practice text aloud](./0014-read-english-practice-text-aloud.md) | awaiting-human-validation | None |
| [0015 — Record a three-minute answer](./0015-record-a-three-minute-answer.md) | awaiting-human-validation | None |
| [0016 — Retain and replay Answer Recordings](./0016-retain-and-replay-answer-recordings.md) | awaiting-human-validation | 0015 |
| [0017 — Answer by voice in every answer path](./0017-answer-by-voice-in-every-answer-path.md) | awaiting-human-validation | 0015, 0016 |
| [0018 — Run a three-question Short Mock Session](./0018-run-a-three-question-short-mock-session.md) | awaiting-human-validation | 0017 |
| [0019 — Interpret a natural-language job request](./0019-interpret-a-natural-language-job-request.md) | awaiting-human-validation | None |
| [0020 — Curate five jobs with a Fit Breakdown](./0020-curate-five-jobs-with-a-fit-breakdown.md) | awaiting-human-validation | 0019 |
| [0021 — Hide the question in listening mode](./0021-hide-the-question-in-listening-mode.md) | awaiting-human-validation | 0014 |
| [0022 — Design tokens and app shell (rail with 我的進步, self-hosted fonts)](./0022-design-tokens-and-app-shell.md) | completed | None |
| [0023 — Practice workbench: two-pane desktop, mobile tabs, fixed 結束並保存](./0023-practice-workbench-two-pane-and-mobile-tabs.md) | completed | 0022 |
| [0024 — Annotated feedback: transcript marks, rating bars, inline correction diff](./0024-annotated-feedback.md) | completed | 0023 |
| [0025 — Home redesign: five-second hero, flow strip, static feedback preview](./0025-home-redesign.md) | completed | 0022 |
| [0026 — Remaining views restyle (含練習紀錄標題截短)](./0026-remaining-views.md) | completed | 0022 |
| [0027 — Short Mock Session dark room](./0027-mock-session-dark-room.md) | completed | 0022, 0024 |
| [0028 — Verification: browser smoke, screenshots, runbook label sync](./0028-verification-and-runbook-sync.md) | completed | 0022, 0023, 0024, 0025, 0026, 0027 |
| [0029 — Job-search page states that only Greenhouse is searched](./0029-greenhouse-only-job-search-note.md) | completed | None |
| [0030 — `/find-104-jobs` project skill](./0030-find-104-jobs-skill.md) | completed | None |
| [0031 — Common Questions mechanism: pinned self-introduction](./0031-common-questions-self-introduction.md) | completed | None |
| [0032 — Five common behavioural questions (常見行為題)](./0032-common-behavioural-questions.md) | ready-for-agent | 0031 |
| [0033 — ADR 0020: revised creator gate and persona loops in the ledger](./0033-adr-0020-revised-creator-gate.md) | needs-info | None |
| [0034 — Fifth AI persona loop on Common Questions and AI attestation](./0034-fifth-persona-loop-and-ai-attestation.md) | ready-for-agent | 0031, 0032, 0033 |
| [0035 — Codex evaluation run (v3) and AI semantic review](./0035-codex-evaluation-and-semantic-review.md) | ready-for-agent | None |
| [0036 — AI-reviewed labels, offline release recheck, summary update](./0036-ai-reviewed-labels-and-release-recheck.md) | ready-for-agent | 0035 (0034 for the final release status) |

| [0037 — Direct links to individual Job Snapshots](./0037-job-snapshot-deep-links.md) | needs-triage | None |

Implementation should proceed in dependency order. Start each issue in a fresh session with the PRD and only the selected issue as the implementation brief.

## Feature PRDs

| PRD | Issues |
|---|---|
| [Voice practice](../prd-voice-practice.md) | 0014–0017, 0021 |
| [Three-question short mock session](../prd-short-mock-session.md) | 0018 |
| [Natural-language curated job discovery](../prd-curated-job-discovery.md) | 0019–0020 |
| [Workbench UI redesign](../prd-ui-redesign.md) | 0022–0028 |
| [v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md) | 0029–0036 |
