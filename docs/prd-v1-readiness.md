---
status: ready-for-agent
---

# PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate

Source of confirmed requirements: [`next-steps-discussion.md`](./next-steps-discussion.md)
(2026-09-24 decisions, the single source of decisions for this round), the three
open questions it listed and the added common behavioural questions (all
answered 2026-09-24, recorded there and under **Implementation Decisions**), [`creator-validation.zh-TW.md`](./creator-validation.zh-TW.md),
[`verification/persona-walkthrough-2026-09-23.md`](./verification/persona-walkthrough-2026-09-23.md),
[`MVP-ACCEPTANCE.md`](./MVP-ACCEPTANCE.md), `CONTEXT.md`, and
[ADR 0003](./adr/0003-separate-job-discovery-from-practice-evidence.md),
[ADR 0011](./adr/0011-cover-four-interview-question-categories.md),
[ADR 0012](./adr/0012-generate-a-reviewable-question-set-per-job.md),
[ADR 0013](./adr/0013-minimize-and-locally-control-practice-data.md),
[ADR 0014](./adr/0014-require-a-small-versioned-evaluation-suite.md).

Nothing in this PRD re-opens a decision the learner already made. It covers the
five items that stand between the current build and the `v1.0.0` tag. Chinese
interview mode (v1.1), self-introduction step 2, resume-gap hints and DevOps
deployment are explicitly out of scope.

## Problem Statement

The MVP is functionally complete and the workbench redesign is owner-accepted,
but the release is still **BLOCKED**:

- The creator validation gate asks for five real creator Practice Loops. The
  creator has decided that this bar, as written, is not what stands between the
  product and a useful v1.0.0. There is no recorded decision explaining the lower
  bar, and the evaluation checks still reject any AI persona loop.
- The 20-case label file and the bilingual semantic review are empty, so
  the Evaluation Suite cannot pass.
- As a Target Learner in Taiwan, most of the postings I care about are on 104,
  but the job-search page silently searches only Greenhouse boards. I cannot tell
  that 104, LinkedIn or Cake results will never appear, and getting a 104 JD into
  the app means copying it by hand and cleaning up the first line so the job
  title reads well.
- Almost every real interview opens with "Tell me about yourself" and asks a
  few classic behavioural questions (a conflict, a failure, a tight deadline),
  yet no Question Set reliably contains them, so the most predictable questions
  are the ones I never rehearse.

## Solution

1. The job-search page states plainly that it searches Greenhouse only and that
   104, LinkedIn and Cake JDs should be pasted directly.
2. A project skill, `/find-104-jobs`, lets the creator (in a Claude Code session,
   not inside the app) search 104 through the job104 MCP, pick up to three
   postings, save each JD under the gitignored workspace with a clean
   `職稱 — 公司` title line, and create the matching Job Snapshots through the
   local app's existing snapshot endpoint. It never answers questions, never
   generates questions and never stores credentials.
3. Every job's Question Set shows **Common Questions**: app-authored questions
   with Chinese glosses that are not model output. The self-introduction is
   pinned at the top and opens every three-question short mock session; five
   classic behavioural questions sit in a collapsed "常見行為題" block after the
   job-grounded questions. All are practised and coached through the existing
   Practice Loop and feedback pipeline. The model contract does not change.
4. A new ADR 0020 makes v1.0.0 an **AI-validated release**: the creator gate is
   met by five AI persona Practice Loops (runs 2–5 of the 2026-09-23 walkthrough
   plus one new persona loop on the Common Questions), attested by an AI
   verifier, never in the creator's name. It defines an AI persona Practice Loop
   and records the risk. The evaluation checks, `MVP-ACCEPTANCE.md` and the
   creator-validation ledger follow it.
5. The 20 labelled Evaluation Cases are drafted by a rater persona and approved
   by an independent AI reviewer, marked `reviewerType: "ai"`; one pre-authorised
   Codex evaluation run and an AI bilingual semantic review of its 60 outputs
   complete the Evaluation Suite evidence. The release status says
   "AI-validated"; real creator use and human labels move to after v1.0.0.

## User Stories

### Job-source clarity

1. As a Target Learner, I want the job-search page to tell me it only searches Greenhouse, so that I do not wait for 104 results that will never come.
2. As a Target Learner, I want the page to tell me what to do instead for 104, LinkedIn and Cake postings, so that I know pasting a JD is the supported path.
3. As a Target Learner, I want the note to be one quiet line near the search input, so that it informs without cluttering the search flow.
4. As a Target Learner on a phone, I want the note to remain readable at narrow widths, so that the guidance is not lost on mobile.

### `/find-104-jobs`

5. As the creator, I want to search 104 from a Claude Code session with a natural-language request, so that I can find relevant Taiwan postings without leaving my workflow.
6. As the creator, I want to see about ten candidate postings (title, company, location, link) before anything is imported, so that I choose what enters my workspace.
7. As the creator, I want to import at most three postings per run by default, so that I do not flood my job list with jobs I will not practise.
8. As the creator, I want to raise the limit to five when I explicitly ask, so that I can prepare a batch when I need one.
9. As the creator, I want each imported JD saved as a file under a dedicated gitignored folder, so that I keep a local copy that never enters version control.
10. As the creator, I want each saved JD to start with a clean `職稱 — 公司` line, so that the job title in the app reads correctly without hand editing.
11. As the creator, I want the second line of each saved JD to record the source URL and retrieval date, so that the Job Snapshot keeps its provenance.
12. As the creator, I want the skill to create the Job Snapshot through the running local app, so that the job appears in my records exactly as if I had pasted it.
13. As the creator, I want the skill to skip a posting that was already imported and tell me so, so that repeated runs do not create duplicate jobs.
14. As the creator, I want the skill not to generate questions, so that I decide when to click "產生題目" and spend model calls.
15. As the creator, I want the skill never to answer questions or touch practice records, so that my acceptance evidence stays mine.
16. As the creator, I want the skill to use the job104 MCP without login and never ask for or store 104 credentials, so that ADR 0013 holds.
17. As the creator, I want the skill to stop with a clear message when the local app is not running on its usual port, so that it never starts, stops or restarts my server.
18. As the creator, I want the fixed validation JD set to stay untouched by the skill, so that the creator-validation runbook keeps its five known JDs.
19. As the creator, I want the skill to report what it created (file path, job title, snapshot link), so that I can go straight to practice.

### Self-introduction

20. As a Target Learner, I want every job's Question Set to include "Tell me about yourself.", so that I rehearse the question most interviews open with.
21. As a Target Learner, I want its Chinese gloss to explain what a good answer covers (background, relevant experience, why this role, in one to two minutes), so that I know what the interviewer is really asking.
22. As a Target Learner, I want the self-introduction pinned at the top and marked as a fixed question, so that I can tell it apart from the job-grounded questions. It stays a role-fit question and is not grouped with the common behavioural questions.
23. As a Target Learner, I want it to appear for jobs whose questions were generated before this change, so that my existing jobs benefit without regenerating.
24. As a Target Learner, I want it to appear only once a Question Set exists, so that the job page before question generation is unchanged.
25. As a Target Learner, I want the job-grounded question count to stay 8–12 and be shown separately from the fixed question, so that the question counts I see stay honest.
26. As a Target Learner, I want "add four more questions" to keep working unchanged, so that the fixed question never disturbs question expansion.
27. As a Target Learner, I want to answer the self-introduction in text or voice like any other question, so that the practice flow is familiar.
28. As a Target Learner, I want bilingual feedback on my self-introduction through the normal feedback pipeline, so that it is coached with the same rubric and quotations.
29. As a Target Learner, I want the self-introduction treated as a role-fit question, so that feedback and Focus Points use the right intent.
30. As a Target Learner, I want optional revision, follow-ups, "不知道怎麼回答？" hints and the illustrative answer to work on the self-introduction, so that it is not a second-class question.
31. As a Target Learner, I want a completed self-introduction practice to count as a completed main-question practice, so that my progress reflects it.
32. As a Target Learner, I want each job's self-introduction practice history kept under that job, so that I can compare how I introduce myself for different roles.
33. As a Target Learner, I want every three-question short mock session to open with the self-introduction, so that the mock feels like a real interview opening.
34. As a Target Learner, I want the other two mock questions still chosen from the job-grounded questions of other categories, so that the mock keeps its coverage.
35. As a Target Learner, I want "練這個重點" to generate a new job-grounded scenario question even when the Focus Point came from my self-introduction, so that focus practice stays grounded in the JD.
36. As a Target Learner, I want the self-introduction never to claim to be an employer's actual question or cite capability evidence, so that the job-grounding promise stays truthful.

### Common behavioural questions

52. As a Target Learner, I want five classic behavioural questions (conflict, failure, tight deadline, ownership, learning something new quickly) available for every job, so that I can prepare stories for the questions interviewers ask everywhere.
53. As a Target Learner, I want each one to carry a Chinese gloss and a short STAR hint, so that I know what kind of story the question wants and how to structure it.
54. As a Target Learner, I want them in their own collapsed "常見行為題" block after the job-grounded questions, so that they do not push the job-specific questions down.
55. As a Target Learner, I want them labelled as common questions, not job-grounded ones, so that I am never told they came from the JD.
56. As a Target Learner, I want to answer and get bilingual feedback on them exactly like any other question, including revision, follow-ups, hints and the illustrative answer, so that the practice flow is the same.
57. As a Target Learner without a matching past experience, I want the existing hints and hypothetical framing to help me, so that I am never pushed to invent experience.
58. As a Target Learner, I want each job's practice history for these questions kept under that job, so that I can see how my stories fit different roles.
59. As a Target Learner, I want three-question short mock sessions to keep using job-grounded behavioural questions, so that mocks do not repeat the same common question every time.

### Revised MVP gate (ADR 0020)

37. As the creator, I want an ADR that records why v1.0.0 is validated by five AI persona loops and AI-reviewed labels, and what risk that accepts, so that the decision is explicit and reviewable.
38. As the creator, I want the ADR to define an AI persona Practice Loop precisely, so that future persona runs are comparable and cannot be quietly downgraded.
39. As the creator, I want the evaluation checks to accept AI persona loops only when they are marked synthetic and link to their persona and verification evidence, so that synthetic loops are never mistaken for real ones.
40. As the creator, I want the checks to keep the original human validation mode available, so that real creator loops and human labels can be added after v1.0.0 without another rewrite.
41. As the creator, I want the existing coverage rules (two Job Snapshots, two Question Categories, one Experience Gap, one induced failure with recovery) to apply across all five loops together, so that coverage is not lowered along with the headcount.
42. As the creator, I want four persona loops taken from runs 2–5 of the 2026-09-23 walkthrough and a fifth new persona loop on the Common Questions, all written into the ledger with their real record identifiers, so that the evidence is traceable and also exercises the new questions.
43. As the creator, I want the walkthrough document to gain an appended note that ADR 0020 changes its status, without rewriting its original text, so that historical evidence stays intact.
44. As the creator, I want the ledger attested by the AI verifier (`attestedBy`, `attestedAt`) with `creator` left null, so that nothing is signed in my name.
45. As the creator, I want `MVP-ACCEPTANCE.md` and the creator-validation runbook to describe the new rule, so that anyone reading them sees one consistent gate.

### Human labels and evaluation

46. As the creator, I want a rater persona to draft all 20 labelled cases (five JDs × four question types) with score ranges, rationale, quotations, required and forbidden feedback content and bilingual-consistency notes, so that the labels exist without my time.
47. As the creator, I want an independent AI reviewer to check and approve each case individually, so that no draft is accepted unexamined.
48. As the creator, I want the label file, checks and summary to state that labels are AI-reviewed, not human, so that the provenance is honest.
49. As the creator, I want the single Codex evaluation run (about 65 subscription calls) pre-authorised once, with no automatic re-run on failure, so that subscription usage stays bounded.
50. As the creator, I want the 60 bilingual outputs of that run reviewed by an AI reviewer into the semantic-review artifact the checks already accept, so that bilingual consistency has evidence.
51. As the creator, I want the evaluation summary updated with the new results and gate status, so that the portfolio record shows exactly what passed.

## Implementation Decisions

### Answers to the three open questions (confirmed 2026-09-24)

- **Self-introduction wording and placement.** English text: `Tell me about yourself.` Chinese gloss (`meaningZh`): 「請用一到兩分鐘介紹自己：你的背景、和這個職位相關的經驗，以及為什麼想應徵。」 It is shown for every job that has a Question Set, including existing ones. It does **not** count toward the model's 8–12 questions; it is displayed as a separate pinned "fixed question". It is always the first question of a three-question short mock session.
- **Common behavioural questions (added in the PRD session).** Five app-fixed questions, category `behavioral`, in a separate collapsed "常見行為題" block after the job-grounded questions; not counted in the 8–12; not picked by short mock sessions. Initial wording (English text / Chinese gloss), to be proof-read in the implementing slice:
  1. `Tell me about a time you disagreed with a teammate. How did you handle it?` / 「說一次你和隊友意見不同的經驗：你怎麼處理、結果如何？」
  2. `Tell me about a time you made a mistake or failed. What did you learn?` / 「說一次你犯錯或失敗的經驗：你從中學到什麼、之後怎麼改進？」
  3. `Tell me about a time you had to deliver under a tight deadline. How did you prioritise?` / 「說一次在很緊的期限內交付的經驗：你怎麼排優先順序、取捨了什麼？」
  4. `Tell me about a time you took ownership of a problem that was not assigned to you.` / 「說一次你主動承擔不屬於你分內的問題：你為什麼出手、做了什麼、結果如何？」
  5. `Tell me about a time you had to learn a new technology quickly. How did you approach it?` / 「說一次你必須快速學會新技術的經驗：你怎麼學、怎麼確認自己真的會用？」

  Each carries an app-authored English and Chinese rationale that includes a one-line STAR hint (情境、任務、行動、結果).
- **`/find-104-jobs` storage and volume.** JD files go to a new `.workspace/jds/` folder, never `.workspace/validation-jds/` (that folder is the runbook's fixed five-JD set). File name `YYYY-MM-DD-<company>-<title>.txt`, slugified. Line 1 is `職稱 — 公司`; line 2 records the source URL and retrieval date; the JD body follows. The skill lists about ten candidates, the creator picks; default maximum three imports per run, up to five on explicit request. Before importing, the skill checks existing files in `.workspace/jds/` by 104 job id / URL and skips duplicates with a message.
- **AI persona Practice Loop (ADR 0020).** One complete Practice Loop run against the real local app, driven through its UI by an AI agent, with a real language-model provider (not the fake provider), playing a persona whose background is written down beforehand and which never invents experience beyond it. Each loop leaves a real record identifier and links to a verification document. Coverage minimums are the existing four rules, satisfied by all five loops together. The loops are runs 2–5 of the 2026-09-23 walkthrough plus one new persona loop on the Common Questions.
- **No creator-only gates (decided after the issue split, 2026-09-24).** v1.0.0 is an AI-validated release: five persona loops replace the real creator loop, the ledger is attested by the AI verifier with `creator` left null, the 20 labels are persona-drafted and AI-approved with `reviewerType: "ai"`, and the release status reads "AI-validated". This amends ADR 0014's "human labels are primary" for v1.0.0 only and is recorded in ADR 0020. Real creator use and human labels are post-v1.0.0 work. The single Codex evaluation run is pre-authorised; `/find-104-jobs` is verified by the agent against its own test server.

### Common Questions (self-introduction and common behavioural questions)

- **Common Question** is a new domain term: an app-authored interview question shown with every job's Question Set, not generated from the Job Snapshot and not a Job-grounded Interview Question. Add it to `CONTEXT.md`.
- The Common Questions are one ordered app-authored list; the rules below apply to every item. The self-introduction is the first item and the only one pinned above the job-grounded questions.
- Each Common Question is an app-authored constant, not model output. It is injected when the Question Set is **served**, not when it is generated or stored, so the model contract, the analysis validator, the evaluation checks and the "preserve existing questions byte-for-byte" expansion contract are untouched, and no stored Question Set is migrated.
- Each has a stable, reserved question id shared by every job (e.g. `self-introduction`, `common-behavioral-conflict`), its category (`role-fit` for the self-introduction, `behavioral` for the rest), its Chinese gloss, a short app-authored rationale in English and Chinese, an explicit empty `capabilityIds` list and no capability evidence. An empty list is required: the feedback path reads `capabilityIds` unconditionally.
- Question-set views gain a way to tell Common Questions apart (e.g. a `source: "common"` field plus a `group` of `self-introduction` or `behavioral`) so the UI can pin the self-introduction and render the collapsed "常見行為題" block; job-grounded counts shown to the learner exclude all Common Questions.
- Anywhere the server checks that a question id belongs to a job's stored Question Set (starting an Answer Attempt, follow-ups, mock sessions, focus-point practice), the reserved ids are also accepted when that job has a Question Set.
- The practice record stores the served question object as it does today, so old and new records render identically.
- Mock-session question selection puts the self-introduction first; the remaining two are chosen by the existing rule from the job-grounded questions only (common behavioural questions are never picked). The three questions keep distinct categories, so the other two are not role-fit (confirmed 2026-09-24).
- "練這個重點" keeps generating a new job-grounded question; a Focus Point from a Common Question is treated as a Focus Point of that question's category.
- Completion counts count Common Questions like any other main question. The learner-facing question count shows Common Questions and job-grounded questions separately, e.g. 「常見題 6｜職缺題目 8」 (confirmed 2026-09-24).

### `/find-104-jobs`

- A Claude Code project skill (`.claude/skills/find-104-jobs/`), written per the writing-for-agents guidance. It is a creator tool, not a product feature; the app itself does not change.
- It talks to the app only through the existing Job Snapshot creation endpoint (the same one the paste flow uses) on `127.0.0.1:4310`. It never starts, stops or restarts the server and never uses name-matched process kills; if the app is unreachable, it saves the JD files and reports that snapshots were not created. The first call to 4310 may need the creator's explicit permission approval.
- The snapshot endpoint does not deduplicate; deduplication is the skill's responsibility via the files in `.workspace/jds/`. The app's existing rule that re-pasting a JD is the learner's choice (reuse or create new) is unchanged.
- The skill does not trigger question generation, answer questions, or write practice records.

### Job-search note

- Copy (zh-TW): 「目前只搜尋 Greenhouse；104、LinkedIn、Cake 的職缺請直接貼上 JD。」 shown as one secondary-text line on the job-search view near the search request, styled with existing design tokens. No in-app 104 scraping is built.

### Revised MVP gate

- New ADR 0020 (`docs/adr/0020-…`) records: the AI-validated release rule, the persona-loop definition above, AI-reviewed labels, why the bar is lowered, and the accepted risk (persona loops and AI labels exercise the pipeline and UI but not a real learner's comprehension, motivation or voice, and not real speech; nothing in v1.0.0 has been validated by a human). Note that `docs/verification/0020.md` is an unrelated issue-verification document. `docs/devops-discussion.md` already renumbers its tentative ADR to 0021; no further change is needed there.
- Ledger gains `validationMode` (`"creator"` = the original human rule, `"ai-persona"` = ADR 0020) and `attestedBy`; synthetic loops gain `persona` (name) and `evidence` (a `docs/verification/` path).
- The creator-status check keeps the original rule for `validationMode: "creator"`. For `"ai-persona"` it requires: at least five completed loops with unique record ids, all `synthetic: true` with non-empty `persona` and `evidence` under `docs/verification/`; the four coverage rules over all loops; `creator` null; non-empty `attestedBy` and a valid `attestedAt`. Its result exposes the mode so reports can say "AI-validated".
- The four persona entries are filled from the backed-up walkthrough workspace (copied on 2026-09-24 to `.workspace/persona-qa-2026-09-23/`, gitignored), using their real record ids, snapshot ids, categories, completion times and input mode; run 2 carries `experienceGap: true`, run 4 carries the cancel-and-retry induced failure with `recovered: true`. The implementer verifies each value against the stored records rather than the prose.
- The fifth loop is a new persona loop on a Common Question (issue 0034); until it and the AI attestation exist, the gate reports "pending fifth persona loop".

### Human labels and evaluation

- The label file keeps its schema plus `reviewerType` per label (`"human"` or `"ai"`). A rater persona drafts all 20 cases; an independent AI reviewer (a different agent) checks each one and only then sets `status: "approved"`, `reviewer` (agent / model identity), `reviewedAt` and `bilingualSemanticConsistency`. The label check accepts AI approvals only with `reviewerType: "ai"` and reports the label mode; reports must call them AI-reviewed labels, never human labels.
- The Codex evaluation (`npm run evaluate -- --codex --accept-subscription-usage`, about 65 subscription calls) is pre-authorised by the creator for exactly one run; a failed run is recorded and not re-run without the creator.
- The semantic-review artifact follows the shape the checks already accept (schema version 2, matching contract version, `reviewerType: "ai"`, 60 audits, each with checksum, verdict and rationale).

## Testing Decisions

- Good tests assert externally observable behaviour through the highest existing seam — HTTP responses, served Question Sets, check results, rendered text — not internal helpers.
- **Common Questions:** node HTTP-level tests alongside the existing question-set and mock-session tests: the served Question Set has the self-introduction first and the five common behavioural questions marked as their own group, each with the expected text, gloss, category and empty capability list; old stored Question Sets serve it without migration; no Question Set means no fixed question; "add four more questions" still works and the count of job-grounded questions is unchanged; an Answer Attempt on the reserved id gets feedback through the fake provider; an Answer Attempt on a common behavioural question works the same way; a mock session opens with the self-introduction and never includes a common behavioural question. Model-output validation tests stay unchanged. Browser smoke asserts the pinned, labelled self-introduction card and the collapsed "常見行為題" block.
- **Job-search note:** browser smoke asserts the copy on the job-search view.
- **Revised gate:** unit tests on the creator-status check: `"creator"` mode behaves exactly as before; `"ai-persona"` with five valid persona loops and AI attestation passes; a non-null `creator`, missing `attestedBy`/`attestedAt`, a persona loop missing `persona` or `evidence`, fewer than five loops, or an unmet coverage rule fails. The label check gets matching tests for `reviewerType`.
- **`/find-104-jobs`:** no app tests (the app does not change). Verified by one agent-run session against the agent's own test server (never 4310): clean title line, source line, dedupe skip on a second run, no questions generated.
- **Evaluation:** the evaluation checks are the acceptance test; `npm test` must stay green and the offline review step must report the AI-reviewed label, semantic-review and AI-persona creator gates as passing, with the release status "AI-validated".
- Prior art: the existing question-set, mock-session and evaluation test files, and the browser smoke script. All tests run on their own port with a temporary workspace and never touch 4310 or `.workspace/`.

## Out of Scope

- Chinese interview mode (planned v1.1; needs a new ADR, contract v4 and Chinese evaluation cases).
- Model-generated or resume-grounded Common Questions, and Common Questions in the short mock session other than the self-introduction.
- Self-introduction step 2 (resume-grounded follow-ups with verbatim quotation; needs a new ADR, contract v4 and re-evaluation).
- Resume-gap hints, a "try with a sample job" button, an operations-row retry button.
- Any in-app 104, LinkedIn or Cake search or scraping; storing any job-board credentials.
- DevOps deployment and the ADR 0021 work in `devops-discussion.md`.
- Creating the `v1.0.0` tag itself; it follows the version decision in `devops-discussion.md` once the revised gate passes.

## Further Notes

- Suggested order from the discussion: job-search note → `/find-104-jobs` → Common Questions → revised gate → Codex evaluation and AI semantic review → AI-reviewed labels on the resulting packet → offline recheck (`evaluation/review-report.js`, no model calls). The evaluation must precede labelling because each label is keyed to an `inputChecksum` that includes the model-generated question, and v3 has no frozen Codex analysis yet (found while splitting issues; issues 0029–0036). The revised-gate ledger work should not wait long, even though the walkthrough workspace is now backed up.
- No slice needs the creator: the evaluation (about 65 subscription calls) is pre-authorised once, and the persona loop in 0034 uses a handful of real provider calls on the agent's own server. Real creator use and human labels are recorded as post-v1.0.0 work.
- Working rules for every slice: never stop or restart the server on 127.0.0.1:4310; no `pkill`/`killall`; agent-browser closes only its own session; run `npm run codex:verify` after editing any `src/codex-*.js`; restart the server after changing the static-file allowlist; Conventional Commits with a capitalised subject, no trailing period, no AI trailer, and `git commit` as a separate command.
