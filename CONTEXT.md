# Adaptive English Interview Coach

This context defines the language of a focused coaching product for practising English interviews for AI and software roles in Taiwan's technology sector.

## Language

**Target Learner**:
A job seeker who can read technical English but needs practice expressing relevant, structured answers in English interviews for AI or software roles in Taiwan's technology sector.
_Avoid_: English learner, student, user

**Interview Coach**:
The product that guides repeated, job-specific interview practice and helps the Target Learner improve recurring weaknesses over time.
_Avoid_: English tutor, chatbot, interviewer bot

**Practice Loop**:
A job-specific practice session in which the Target Learner answers one question, receives evidence-based feedback, and retains a focus for future practice; a second answer and comparison are optional.
_Avoid_: Lesson, chat session, mock interview

**Written Answer Draft（文字作答草稿）**:
The learner's unfinished written response to a selected question, which can be resumed before submission as an Answer Attempt; a revision draft remains distinct from the previously submitted answer.
_Avoid_: Submitted answer, completed practice, speech transcript draft

**Answer Attempt**:
One learner-submitted spoken or written response to a Job-grounded Interview Question, represented by its transcript for coaching and comparison; generated English assistance is not an Answer Attempt.
_Avoid_: Final answer, message, recording

**Practice Record**:
The locally retained evidence of a completed or partial Practice Loop, including its question, transcripts, Feedback Reports, comparison, and Focus Point, with an associated local recording for spoken answers when available. A recording preserves the original speech even if the learner later corrects the transcript; older records may contain transcripts only.
_Avoid_: Chat history, audio archive, model trace

**Answer Recording（回答錄音）**:
The retained local audio of one submitted spoken Answer Attempt, associated with that specific answer version and deleted with its owning practice data. It is evidence of what the learner actually said, not a scored artifact; editing the transcript afterwards never alters or re-cuts it, and the interface labels an edited transcript so the audio is not presented as matching it.
_Avoid_: Audio archive, voice sample, pronunciation evidence

**Feedback Report**:
A structured, transcript-grounded evaluation of one Answer Attempt across relevance, support, structure, and English expression, with one strength and one priority improvement. Support means experience evidence for experience questions and reasoning, assumptions, examples, or trade-offs for technical and hypothetical questions; bilingual explanations express the same assessment with shared ratings and original quotations.
_Avoid_: Overall grade, personality assessment, free-form critique

**Focus Point**:
The single highest-priority improvement selected from one Practice Loop for deliberate attention in a later attempt.
_Avoid_: Weakness, mistake list, study plan

**Recurring Weakness**:
A learner-confirmed problem or a pattern supported by evidence from at least two separate Practice Loops, tracked as active, improving, or resolved.
_Avoid_: One-off mistake, model memory, personality trait

**Local Workspace**:
The learner-controlled environment in which the application runs and personal artifacts are stored, while explicitly configured external providers may perform model inference or speech transcription.
_Avoid_: Fully offline system, hosted account, cloud workspace

**Legacy Candidate Evidence Profile**:
An optional learner-approved collection of experience claims and proof points, each linked to a resume excerpt or explicitly confirmed by the learner, used to personalize coaching without limiting which job capabilities may be practised.
_Avoid_: Resume, generated biography, inferred experience

**Legacy Approved Evidence**:
A specific experience claim the learner has confirmed as accurate and defensible in an interview.
_Avoid_: Model inference, suggested story, keyword match

**Experience Gap**:
A capability in the Job Capability Map for which the learner has no Approved Evidence; it identifies a practice need and never makes the learner ineligible to practise the question.
_Avoid_: Disqualification, failure, missing keyword

**Job Search Profile**:
The Target Learner's editable criteria for discovering relevant openings, including desired roles, locations, seniority, work arrangements, priorities, and exclusions.
_Avoid_: Resume, learner profile, search prompt

**Job Snapshot**:
An immutable, time-stamped capture of one selected job posting and its source, used as reproducible evidence for analysis and practice.
_Avoid_: Live job, search result, cached page

**Job Capability Map**:
A model-produced, source-linked description of the responsibilities, competencies, and evidence expectations inferred from selected Job Snapshots.
_Avoid_: Skill prediction, learner skill profile

**Role Research Brief**:
A source-linked synthesis of relevant company, team, domain, and likely interview context gathered outside the Job Snapshot, with facts kept distinct from model inferences.
_Avoid_: Job Snapshot, company truth, interview leak

**Bounded Research Run**:
A learner-initiated agent investigation with an explicit role-research goal, approved read-only tools, finite source and cost limits, complete traces, and citation requirements.
_Avoid_: Background crawler, unrestricted browsing, auto-application agent

**Job-grounded Interview Question**:
An interview-practice question justified by evidence in a Job Snapshot, its Job Capability Map, and optionally a Role Research Brief; it is not claimed to be an employer's actual interview question.
_Avoid_: Real interview question, company interview question

**Question Category**:
One of four MVP interview intents: role fit and motivation, experience and project depth, behavioral and situational judgment, or technical communication.
_Avoid_: Difficulty, topic tag, interview stage

**Question Set**:
A reviewable collection of Job-grounded Interview Questions generated for one Job Snapshot, with capability coverage and practice history preserved across sessions.
_Avoid_: Random prompt, live question stream, generic question bank

**Recommended Question（推薦練習題）**:
A Job-grounded Interview Question selected from a Question Set as a suggested next practice based on coverage and learning needs; the learner remains free to choose another question.
_Avoid_: Predicted employer question, mandatory question, new question generation

**Evaluation Case**:
A fixed test fixture containing job context, optional answer input, and expected constraints used to detect regressions in analysis, question generation, feedback, or workflow behavior.
_Avoid_: Practice Record, learner score, demo prompt

**Evaluation Suite**:
The versioned collection of Evaluation Cases and their rule-based, human-labelled, and optional model-judged results used to assess system reliability.
_Avoid_: Learner progress, benchmark claim, production analytics

## Personalized Practice Vocabulary

**Practice Resume（練習履歷）**:
The learner-provided resume selected as personal background for interview practice; its contents are learner-supplied statements, not independently verified accomplishments.
_Avoid_: Verified experience, inferred biography

**JD-only Questioning（僅依職缺出題）**:
Interview practice questions grounded in the selected job description without using a learner resume.
_Avoid_: Generic questions, resume-required practice

**Resume-and-JD Questioning（履歷與職缺共同出題）**:
Interview practice questions grounded in both the selected job description and the learner's Practice Resume, connecting job requirements to stated background without inventing missing experience.
_Avoid_: Resume-only questioning, employer's actual questions

**English Assistance（英文協助）**:
An on-demand English expression of the learner's supplied ideas or a rewrite of a submitted answer, with a Chinese explanation and no invented personal facts; it is distinct from the learner's Answer Attempts.
_Avoid_: Learner answer, verified accomplishments, automatic improvement

**Illustrative Answer（示範回答）**:
An on-demand, explicitly hypothetical English answer that models concrete structure and reasoning for a Job-grounded Interview Question so a stuck learner has something to adapt; it never presents invented metrics, employers, ownership or outcomes as real, is always shown with an application-fixed hypothetical-replace-with-your-own-experience caveat, is not an Answer Attempt, and is never reused as the learner's history. It is distinct from English Assistance (which expresses the learner's own supplied ideas).
_Avoid_: Sample answer, model answer, the learner's answer, verified experience

**Follow-up Question（追問題）**:
A question that probes the learner's preceding answer within the same interview topic; each main question permits at most two optional follow-ups, each with its own answer and feedback.
_Avoid_: Answer revision, unrelated next question

**Key-Sentence Correction（關鍵句修正）**:
At most two necessary sentence-level English corrections offered after a formal Feedback Report, each quoting one of the learner's own sentences verbatim and pairing it with a fact-preserving rewrite and a Traditional Chinese reason; it preserves the original facts, uncertainty, limitations, and missing experience, is stored apart from Answer Attempts, and shows nothing when no correction is warranted.
_Avoid_: Rewritten answer, English Assistance, invented experience, grammar score

**Focus Point Continuation（重點延續練習）**:
A new Practice Loop started from a completed Practice Record's Focus Point under the same Job Snapshot and frozen resume version, presenting a fresh same-job scenario question while preserving the source record; its completion shows evidence-grounded progress without claiming improvement.
_Avoid_: Editing the earlier record, a new job, a learner-managed skills list
