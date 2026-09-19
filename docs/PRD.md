# Adaptive English Interview Coach — Product Requirements Document

> 2026-09-18 更新：履歷個人化、選用第二次作答、首次回饋後可看英文示範及 headspace-meditation 視覺，依[最新試行決策](learner-flow-discussion.md)與[ADR 0017](adr/0017-use-selected-resume-and-optional-revision.md)實施。下文舊版強制雙次作答、逐項經驗核准及參考時機的描述已由新決策取代；人工標註與五次真人練習仍未完成。

## Problem Statement

Job seekers preparing for English interviews for AI and software roles in Taiwan can often read technical English and understand their target domain, yet struggle to express relevant, structured, defensible answers under interview conditions. Generic language tutors do not ground practice in a real job description, and generic interview generators often invent company expectations, assume prior experience, or provide unstructured feedback that cannot be compared across attempts.

The Target Learner needs a private, repeatable way to select a real opening, understand what the role may test, practise one representative question in English, receive transcript-grounded feedback, revise the answer, and see whether the revision improved. A lack of direct experience must become a practice need rather than a reason to suppress questions or fabricate achievements.

## Solution

Build a local-first, cloud-assisted Interview Coach centered on a 15–20 minute Practice Loop. The learner can paste a job description or discover openings through replaceable read-only Job Source adapters, select one opening, and preserve it as an immutable Job Snapshot. The system derives a cited Job Capability Map and a reviewable Question Set spanning role fit, experience depth, behavioral judgment, and technical communication.

The learner answers by voice or text. Voice is transcribed and raw audio is deleted by default. Each Answer Attempt receives a structured Feedback Report covering relevance, support, structure, and English expression, with transcript evidence, one strength, and one priority improvement. The learner revises and answers again before seeing a complete reference answer, then compares both attempts and stores one Focus Point. Repeated, evidence-backed Focus Points may become Recurring Weaknesses.

The MVP uses a deterministic, human-controlled workflow. External job, language-model, and speech providers are replaceable adapters. A later Bounded Research Run may autonomously investigate a selected company and role under explicit source, tool, time, step, and cost limits, but it is not required for the MVP.

## User Stories

1. As a Target Learner, I want to run the application in a Local Workspace, so that my job-search and practice data remain under my control.
2. As a Target Learner, I want to configure external model and speech providers with my own credentials, so that I can choose the services and costs I accept.
3. As a Target Learner, I want to see which provider is active and what information will leave my machine, so that cloud-assisted behavior is transparent.
4. As a Target Learner, I want to paste a job description, so that I can practise even when a Job Source is unavailable.
5. As a Target Learner, I want to paste a supported job URL, so that the system can obtain the posting without manual copying when possible.
6. As a Target Learner, I want to edit a Job Search Profile containing desired roles, locations, seniority, arrangements, priorities, and exclusions, so that discovery reflects what I want.
7. As a Target Learner, I want to trigger a read-only job discovery run, so that the product can find relevant openings without applying or changing external state.
8. As a Target Learner, I want to understand why an opening matched my Job Search Profile, so that I can judge the recommendation myself.
9. As a Target Learner, I want to select an opening and preserve its original content as a Job Snapshot, so that later analysis remains reproducible if the live posting changes.
10. As a Target Learner, I want the source URL and capture time attached to a Job Snapshot, so that I can verify the original posting.
11. As a Target Learner, I want a Job Capability Map derived from the Job Snapshot, so that I can understand the role's responsibilities and likely competency expectations.
12. As a Target Learner, I want every Job Capability to cite the relevant job-description text, so that model inference does not masquerade as employer fact.
13. As a Target Learner, I want facts and inferences labelled separately, so that I can judge how strongly each conclusion is supported.
14. As a Target Learner, I want an initial Question Set of 8–12 questions, so that I can inspect and select realistic practice topics before answering.
15. As a Target Learner, I want each question linked to a Question Category, Job Capability, and source evidence, so that I know why it is relevant.
16. As a Target Learner, I want questions covering role fit, experience depth, behavioral judgment, and technical communication, so that practice reflects multiple interview intents.
17. As a Target Learner, I want the Interview Coach to recommend the next question based on coverage and learning needs, so that practice remains focused.
18. As a Target Learner, I want to override the recommendation or request additional questions, so that I remain in control of practice.
19. As a Target Learner, I want to practise a capability even when I have no matching work experience, so that Experience Gaps do not exclude me.
20. As a Target Learner with an Experience Gap, I want guidance for conceptual, hypothetical, transferable, and honest learning-plan answers, so that I can respond without fabricating achievements.
21. As a Target Learner, I want to optionally import a resume and review extracted proof points, so that coaching can reference my actual experience when useful.
22. As a Target Learner, I want only learner-confirmed claims to become Approved Evidence, so that generated suggestions remain defensible.
23. As a Target Learner, I want unlisted claims in an answer treated as unverified rather than false, so that I can add genuine experiences not present in my resume.
24. As a Target Learner, I want to answer by voice, so that practice resembles a real spoken interview.
25. As a Target Learner, I want a text-answer fallback, so that I can practise without a microphone and the workflow remains testable.
26. As a Target Learner, I want to review the transcript used for coaching, so that I know what the system evaluated.
27. As a Target Learner, I want raw audio deleted after transcription by default, so that the product does not become an unnecessary voice archive.
28. As a Target Learner, I want a Feedback Report with separate ratings for relevance, support, structure, and English expression, so that I understand the kind of improvement needed.
29. As a Target Learner, I want feedback to quote my transcript, so that suggestions are grounded in what I actually said.
30. As a Target Learner, I want one strength and one priority improvement, so that the feedback is actionable rather than overwhelming.
31. As a Target Learner, I want the meaning of support to adapt to the Question Category, so that technical reasoning is not incorrectly judged as missing a personal STAR story.
32. As a Target Learner, I want to revise and answer the same question before seeing a complete reference answer, so that measured improvement reflects my effort rather than imitation.
33. As a Target Learner, I want a side-by-side comparison of two Answer Attempts, so that I can see evidence of improvement and remaining problems.
34. As a Target Learner, I want one Focus Point saved from each Practice Loop, so that the next practice session has a clear target.
35. As a Target Learner, I want a problem promoted to a Recurring Weakness only after I confirm it or it appears across separate Practice Loops, so that one-off mistakes do not become permanent labels.
36. As a Target Learner, I want Recurring Weaknesses tracked as active, improving, or resolved, so that progress is visible without a misleading universal English score.
37. As a Target Learner, I want my Practice Records stored locally across restarts, so that repeated practice can build on prior evidence.
38. As a Target Learner, I want provider failures to be retryable without losing a partial Practice Record, so that temporary outages do not destroy my work.
39. As a Target Learner, I want to delete an individual Practice Record, Job Snapshot, or all local product data, so that I control retention.
40. As a developer, I want model outputs validated against explicit schemas, so that malformed responses fail visibly and recoverably.
41. As a developer, I want external Job Source, language-model, and speech services behind replaceable adapters, so that the product is not locked to one provider.
42. As a developer, I want a versioned Evaluation Suite with representative job descriptions and answer transcripts, so that prompt or model changes can be regression-tested.
43. As a developer, I want deterministic citation and schema checks to be primary, so that a model judge is not the sole authority on system quality.
44. As a developer, I want material failures converted into Evaluation Cases, so that known mistakes do not silently return.
45. As a portfolio reviewer, I want to see an architecture diagram, evaluation results, known failure modes, and a transcript-grounded before-and-after example, so that I can assess engineering quality beyond the UI demo.

## Implementation Decisions

- The MVP is a local web application backed by a Local HTTP API. The API is the primary application and testing seam.
- The workflow is deterministic and human-controlled: discover or paste a posting, select it, snapshot it, derive capabilities, generate a Question Set, select a question, answer, receive feedback, revise, compare, and persist a Focus Point.
- Job Source adapters are read-only and replaceable. Pasting a job description is the stable fallback and cannot depend on a live provider.
- Job Search Profiles are editable discovery preferences. They are not resumes, learner ability profiles, or model chat memory.
- Job Snapshots are immutable records of posting content and source metadata. Model analysis never modifies the snapshot.
- Job Capability Maps are structured model outputs whose capabilities cite exact evidence from the Job Snapshot and distinguish facts from inference.
- A Question Set belongs to one Job Snapshot. Each question preserves its category, target capabilities, supporting evidence, rationale, recommendation state, and practice history.
- The four MVP Question Categories are role fit and motivation, experience and project depth, behavioral and situational judgment, and technical communication.
- Coding challenge execution, automatic code grading, system-design whiteboards, salary negotiation, and pronunciation or accent scoring are excluded from the MVP.
- Candidate Evidence Profiles are optional. They personalize answer coaching and prevent invented achievements, but cannot suppress questions or disqualify Experience Gaps.
- Voice is the primary answer path and text is the fallback. Raw audio is deleted after transcription by default; the transcript becomes the coaching artifact.
- Feedback Reports use four levels for relevance, support, structure, and English expression. Support is interpreted according to Question Category.
- Feedback Reports quote transcript evidence, provide one strength and one priority improvement, and do not provide a complete reference answer before revision.
- Practice Records preserve the question, transcripts, Feedback Reports, comparison, and Focus Point. They do not preserve raw audio by default.
- A Recurring Weakness requires learner confirmation or evidence from at least two separate Practice Loops.
- Local persistence must survive process restarts without user accounts or a hosted database.
- Credentials remain outside application data. External requests use the minimum context needed and the interface discloses the active provider and outbound data.
- Language-model, speech-to-text, and Job Source integrations use explicit provider contracts with fake implementations for deterministic tests.
- Provider operations expose failure, retry, timeout, and cancellation states. A failed operation cannot corrupt an existing Practice Record.
- Structured model outputs are schema-validated before entering domain state.
- Role Research Briefs and Bounded Research Runs are second-stage features. A Bounded Research Run is learner-initiated, read-only, cited, traced, and constrained by source, tool, step, time, and cost limits.
- The system never applies to jobs, modifies external accounts, or represents inferred interview expectations as employer-published facts.

## Testing Decisions

- The Local HTTP API is the primary seam for testing observable application behavior. Tests should exercise complete use cases rather than internal helper functions or literal prompt strings.
- Job Source, language-model, and speech-to-text providers are replaced by deterministic fakes in the main automated suite.
- Each vertical slice includes API-level behavior tests that cover persistence, validation, and failure recovery for the behavior it adds.
- One browser-level smoke test covers the complete happy path from a pasted job description through a saved Practice Record. Broad browser E2E coverage is intentionally avoided.
- Optional live-provider tests are isolated, explicitly enabled, rate-limited, and excluded from the default deterministic suite.
- The initial Evaluation Suite contains approximately five representative job descriptions and twenty answer transcripts, including irrelevant, unsupported, mixed-language, transcription-noise, and Experience Gap cases.
- Capability evaluation checks schema validity, exact citation presence, and unsupported requirement claims.
- Question evaluation checks capability linkage, source grounding, category coverage, and duplication constraints.
- Feedback evaluation checks transcript quotation, rubric compliance, unsupported candidate claims, Experience Gap treatment, and rating stability.
- Across three evaluations of identical input, at least 90% of dimension ratings must differ by no more than one level.
- Material failures discovered during development or real use become versioned regression cases.
- Tests must cover retry behavior and prove that provider failure does not corrupt saved state.
- Tests must cover deletion of one Practice Record and deletion of all locally stored product data.

## Out of Scope

- General English conversation courses, standardized-test preparation, vocabulary curricula, leaderboards, social features, and broad language education.
- Claims that generated questions are actual questions used by a named employer.
- Autonomous background crawling, unrestricted web browsing, scheduled bulk scraping, job application submission, bookmarking, or modification of external job accounts.
- Role Research Brief generation and Bounded Research Runs in the MVP.
- Multi-agent orchestration introduced only to demonstrate multiple agents.
- Coding challenge execution, source-code grading, take-home assignment grading, or a system-design whiteboard.
- Pronunciation, accent, emotion, personality, or hiring-outcome scoring.
- A single universal learner score.
- Permanent raw-audio storage by default.
- Hosted multi-user accounts, cloud synchronization, team administration, or a production-scale cloud database.
- Fully offline model deployment as an MVP requirement.
- Automatic resume rewriting, application submission, cover letters, salary negotiation, or full job-application tracking.

## Further Notes

- The creator is the first real Target Learner and must complete at least five full Practice Loops across two Job Snapshots and two Question Categories before the MVP is considered validated.
- Real-use validation must include at least one Experience Gap question and one deliberately induced failure.
- The portfolio handoff includes a two-to-three-minute demo, an architecture diagram, an Evaluation Suite summary, known limitations, and one transcript-grounded before-and-after answer example.
- The accepted MVP quality gates are maintained separately in the MVP acceptance document and remain authoritative if summaries diverge.
- This PRD is local because no project issue tracker or Git repository is configured yet. It should become the parent issue when a tracker is established.
