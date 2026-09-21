---
status: ready-for-agent
---

# Curate at most five jobs with a Fit Breakdown and practise from one

## Parent

[PRD — Natural-language curated job discovery](../prd-curated-job-discovery.md)

## User stories covered

10–46, 48, 50

## What to build

Turn the search run into a short, curated shortlist the learner can act on, and join
it to the existing practice flow.

**Sources.** The replaceable job source contract stays; Greenhouse becomes
configurable as a list of boards rather than one, and several sources are searched
together with results merged and each result keeping its source. A source that fails
or times out is reported per source while the run completes with whatever the healthy
sources returned. The deterministic demonstration source remains the default so the
flow works and is testable with no configuration, labelled as demonstration data.

**Local filtering first.** Sources are queried with the minimum keywords required —
the Practice Resume never reaches a job board. Returned postings keep today's shape
and URL-safety validation. Filtering against the confirmed Job Search Profile happens
entirely in the Local Workspace. Location handling gains a small explicit vocabulary
so Taiwan locations and remote/anywhere/distributed phrasings are recognised, and each
surviving candidate is tagged `taiwan`, `remote` or `unknown` from its own text rather
than assumed. De-duplication collapses postings sharing a canonical source URL, and
postings with the same employer and title from different sources.

**Then curation.** A bounded number of surviving candidates, each trimmed to a bounded
excerpt, plus the Practice Resume, go to the language model under a new contract
returning at most five entries. Each entry identifies a supplied candidate by its
identifier and gives a Traditional Chinese fit rationale and a four-part **Fit
Breakdown**: matched, transferable, gaps, and conditions the posting does not state.
Validation rejects an identifier that was not supplied, more than five entries, a
rationale citing text absent from the supplied excerpt, and any number appearing in
neither the excerpt nor the resume — the evidence-safety rule the Key-Sentence
Correction validator already applies. Fewer than five is correct, not an error;
padding is refused. No single fit score is produced.

**Empty results.** When filtering leaves nothing, the run records which profile
conditions eliminated the most candidates, computed locally, and returns them with
concrete relaxations the interface applies in one click. No model call is made.

**Then practise.** Each result shows its retrieval time, source, location tag, the
retrieved job description in place, and a link to the original posting. Selecting a
result creates a Job Snapshot carrying the posting text, source, source URL and
retrieval time, accepts the resume choice and question depth so it is indistinguishable
downstream from a pasted job description, reuses an existing snapshot for the same run
and result instead of duplicating, and generates the Question Set.

The interface states that the shortlist is the coach's reading of public postings —
not an employer assessment, not an endorsement. Searching and curation run through the
operations tracker so both are cancellable, retryable and idempotent. `CONTEXT.md`
gains **Curated Job Shortlist（精選職缺清單）** and **Fit Breakdown（適配拆解）** as
defined in the PRD, including the note that a Fit Breakdown is not an Experience Gap.

## Acceptance criteria

- [ ] Searching happens only on a learner action; there is no background search.
- [ ] Multiple sources are searched together, results merged, and each result names
      its source and retrieval time.
- [ ] A failing or timing-out source is reported without losing results from healthy
      sources; a rate-limited source says to retry later.
- [ ] The Practice Resume text never reaches a job source, asserted by a test that
      records exactly what the source received.
- [ ] Duplicate postings across sources appear once.
- [ ] Each surviving candidate is tagged Taiwan, remote or unknown from its own text,
      and the tag is shown; exclusions are honoured.
- [ ] At most five results are returned; fewer is accepted and never padded.
- [ ] Each result shows a Traditional Chinese fit rationale and all four Fit Breakdown
      parts, with an empty part allowed, and no single fit score.
- [ ] An entry naming an unsupplied candidate, more than five entries, a rationale
      quoting text absent from the posting excerpt, and a number appearing in neither
      the excerpt nor the resume are each rejected as invalid provider output.
- [ ] Each result links to the original posting and shows the retrieved job
      description in place.
- [ ] With no qualifying result, the run names the blocking conditions and offers
      relaxations applicable in one click, with no model call.
- [ ] Pasting a job description remains available as a fallback.
- [ ] Selecting a result creates a Job Snapshot with source, URL and retrieval time,
      honours the resume choice and question depth, reuses the existing snapshot on a
      second selection, and generates a valid Question Set.
- [ ] A saved snapshot is unaffected by later changes to the posting.
- [ ] Search and curation are cancellable and retryable through the operations
      tracker; a repeated request with the same identifier does not call providers
      twice.
- [ ] The interface states the shortlist is the coach's reading of public postings and
      applies to nothing on the learner's behalf.
- [ ] Old search runs are pruned; deleting all local data removes runs and the profile.
- [ ] A search leaves existing Job Snapshots, Practice Records and recordings
      byte-identical.
- [ ] `CONTEXT.md` defines Curated Job Shortlist and Fit Breakdown, and records that a
      Fit Breakdown is not an Experience Gap.
- [ ] API-level tests cover every rule above.
- [ ] Browser smoke walks: request, proposed criteria, search, at most five results
      with all four Fit Breakdown parts and source and time, open the job description,
      save with the resume attached, reach a generated question, walk the no-results
      relaxation path, and confirm no horizontal overflow at phone width.

## Blocked by

- [Issue 0019](./0019-interpret-a-natural-language-job-request.md)
