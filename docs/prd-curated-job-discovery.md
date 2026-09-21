---
status: ready-for-agent
---

# PRD — Natural-language curated job discovery

Source of confirmed requirements: [`job-discovery-discussion.md`](./job-discovery-discussion.md)
(the 2026-09-21 accepted first-version direction) and
[`voice-practice-discussion.md`](./voice-practice-discussion.md) §"後續自然語言找職缺".
Governing decisions: [ADR 0003](./adr/0003-separate-job-discovery-from-practice-evidence.md),
[ADR 0004](./adr/0004-separate-posting-facts-analysis-and-role-research.md),
[ADR 0013](./adr/0013-minimize-and-locally-control-practice-data.md),
[ADR 0015](./adr/0015-use-deterministic-practice-and-bounded-agentic-research.md).

## Problem Statement

A Target Learner's real question is *"根據我的履歷，幫我找台灣適合轉職的 AI 職缺"*.
What the product offers instead is a six-field Job Search Profile of comma-separated
keywords, matched by literal substring against one hard-coded public job board.

That gap causes concrete problems:

- The learner has to translate an intention into keyword lists before the product
  can do anything, and guess which literal words the postings happen to use.
- Whatever the profile lets through comes back as an unranked list of up to thirty
  postings with a mechanical "roles: python" style reason line. The learner still
  has to read thirty job descriptions to find the three worth practising.
- Nothing connects a posting to the learner's own Practice Resume, so there is no
  statement of why a job fits, what transfers, what is missing, or what could not
  be determined from the posting.
- "Taiwan jobs" is not expressible. A foreign company's Taipei office and a remote
  role a person in Taiwan can actually take are exactly what the learner wants, and
  literal location matching finds neither reliably.
- There is no query time, no source attribution beyond a board name, and no
  de-duplication, so the learner cannot tell how fresh a result is or whether two
  entries are the same job.
- When nothing matches, the learner gets an empty list and no idea which condition
  to relax.

## Solution

Let the learner describe the job they want in their own words, confirm the criteria
that were understood, and get back a short, curated shortlist they can act on.

**Describe it, don't fill it in.** The learner writes a natural-language request.
The product turns it into a proposed Job Search Profile — role, seniority, location,
work arrangement, salary expectation, priorities and exclusions — and shows it for
confirmation. The learner edits anything before any search runs. Nothing is ever
pre-filled with a preference the learner did not state, and the confirmed profile is
saved as their criteria.

**Search only what is necessary, only when asked.** Searching happens when the
learner presses the button; there is no background or scheduled search. Only the
keywords needed to query a source go outbound to that source; the Practice Resume is
never sent to a job board. Results carry their source and the time they were
retrieved, and duplicates across sources are collapsed.

**Five, curated, with the reasoning shown.** At most five postings are returned, and
fewer when fewer genuinely fit — the list is never padded. Each entry states why it
fits, and splits the assessment into four separate parts rather than one score:
what the learner already **matches**, what is **transferable** from adjacent
experience, what is a genuine **gap**, and what the posting simply **does not say**.
Every entry links to the original posting so the learner can read the source.

**Taiwan means Taiwan, including foreign employers and remote.** Location handling
recognises Taiwan locations, a foreign company's Taiwan-based role, and remote roles
a person in Taiwan can hold — and says which of those a result is, rather than
implying a local office that does not exist.

**Nothing found is a useful answer.** When no posting qualifies, the product names
which conditions excluded the most candidates and offers specific relaxations,
instead of an empty list.

**Then practise it.** From a result the learner reads the original job description,
saves it as a Job Snapshot, chooses whether to attach their Practice Resume and at
what depth, and generates a Question Set — joining the existing practice flow with
no second intake path.

## User Stories

### Saying what you want

1. As a Target Learner, I want to describe the job I want in one sentence in
   Chinese or English, so that I do not have to think in keyword lists.
2. As a Target Learner, I want the product to show me the criteria it understood
   before searching, so that I can correct a misreading for free.
3. As a Target Learner, I want to see role, seniority, location, work arrangement,
   salary, priorities and exclusions as separate confirmable fields, so that I know
   exactly what will be searched.
4. As a Target Learner, I want to edit or clear any field before searching, so that
   the final criteria are mine.
5. As a Target Learner, I do not want any preference invented for me, so that an
   unstated condition stays empty rather than guessed.
6. As a Target Learner, I want my confirmed criteria saved as my Job Search Profile,
   so that my next search starts from where I left off.
7. As a Target Learner, I want to search with my saved profile without writing a new
   sentence, so that repeating a search is quick.
8. As a Target Learner, I want an unparseable request to leave my saved profile
   untouched and say so, so that a bad interpretation costs me nothing.
9. As a Target Learner, I want to know that my request text is sent to the
   configured model to be interpreted, so that the outbound data is disclosed.

### Searching

10. As a Target Learner, I want searches to run only when I press the button, so
    that nothing queries the internet behind my back.
11. As a Target Learner, I want only the necessary query keywords sent to a job
    source, so that my full Practice Resume never reaches a job board.
12. As a Target Learner, I want to see when the results were retrieved, so that I
    can judge their freshness.
13. As a Target Learner, I want each result to name its source, so that I know where
    it came from.
14. As a Target Learner, I want the same job appearing in two sources shown once, so
    that a shortlist of five is five real jobs.
15. As a Target Learner, I want a slow or failing source to be reported without
    losing the results from the sources that worked, so that one outage does not
    void the search.
16. As a Target Learner, I want to cancel a running search, so that I am not stuck
    waiting.
17. As a Target Learner, I want a rate-limited source to tell me to retry later
    rather than to fail silently, so that I know it is temporary.

### Reading the shortlist

18. As a Target Learner, I want at most five results, so that I can actually read
    all of them.
19. As a Target Learner, I want fewer than five when fewer fit, so that the list is
    not padded to look productive.
20. As a Target Learner, I want each result to say why it fits me, in Traditional
    Chinese, so that the shortlist explains itself.
21. As a Target Learner, I want what I already match listed separately, so that I
    can see my strengths for this role.
22. As a Target Learner, I want transferable capabilities listed separately from
    direct matches, so that adjacent experience is not overstated as direct
    experience.
23. As a Target Learner, I want genuine gaps listed separately, so that I know what
    to prepare.
24. As a Target Learner, I want conditions the posting does not state listed as
    unknown, so that silence is not read as a match or as a gap.
25. As a Target Learner, I do not want a single fit score, so that I am not reduced
    to a number.
26. As a Target Learner, I want every claim about the posting to be traceable to the
    posting text, so that nothing is invented about the employer.
27. As a Target Learner, I want nothing claimed about my experience beyond what my
    Practice Resume says, so that a gap analysis never invents a credential for me.
28. As a Target Learner, I want each result to link to the original posting, so that
    I can read the employer's own words.
29. As a Target Learner, I want to read the retrieved job description in place, so
    that I can judge it without leaving the product.
30. As a Target Learner, I want a foreign employer's Taiwan-based role included, so
    that my search covers international companies here.
31. As a Target Learner, I want remote roles I could hold from Taiwan included, so
    that my options are not limited to local offices.
32. As a Target Learner, I want each result to say whether it is Taiwan-based,
    foreign-employer-in-Taiwan, or remote, so that I am not misled about where the
    work is.
33. As a Target Learner, I want my exclusions honoured, so that jobs I said no to do
    not come back.

### Nothing found

34. As a Target Learner with no qualifying results, I want to be told which
    conditions removed the most candidates, so that I know what is blocking me.
35. As a Target Learner, I want concrete suggested relaxations, so that my next
    search is better than a guess.
36. As a Target Learner, I want to apply a suggested relaxation in one click, so
    that retrying is cheap.
37. As a Target Learner, I want the option to paste a job description instead, so
    that a failed search never blocks practice.

### From result to practice

38. As a Target Learner, I want to save a result as a Job Snapshot, so that the
    posting is frozen as reproducible evidence.
39. As a Target Learner, I want to choose whether to attach my Practice Resume when
    saving, so that JD-only questioning stays available.
40. As a Target Learner, I want to choose the question depth when saving, so that
    saving from a search matches pasting a job description.
41. As a Target Learner, I want the Question Set generated right after saving, so
    that I can start practising immediately.
42. As a Target Learner, I want saving the same result twice to reuse the existing
    Job Snapshot, so that duplicates do not accumulate.
43. As a Target Learner, I want the saved snapshot to keep its source link and
    retrieval time, so that I can find the original posting later.
44. As a Target Learner, I want a saved snapshot to be unaffected when the posting
    later changes or disappears, so that my practice evidence is stable.

### Honesty and local control

45. As a Target Learner, I want to be told the shortlist is the coach's reading of
    public postings, not an employer's assessment or an endorsement, so that I judge
    it myself.
46. As a Target Learner, I do not want the product to apply for anything or contact
    an employer, so that I stay in control of my job search.
47. As a Target Learner, I want search results kept on this machine, so that my
    search history is mine.
48. As a Target Learner, I want old search runs pruned automatically, so that the
    workspace does not grow without bound.
49. As a Target Learner, I want deleting all local data to remove my search profile
    and runs, so that the deletion promise still holds.
50. As a Target Learner, I want a search to leave my existing Job Snapshots,
    Practice Records and recordings untouched, so that discovery cannot damage
    practice.

## Implementation Decisions

### Domain language

`CONTEXT.md` already defines **Job Search Profile**, **Job Snapshot** and
**Job Capability Map**. Two additions:

- **Curated Job Shortlist（精選職缺清單）** — at most five retrieved postings
  selected for one search run, each with a Traditional Chinese fit rationale and a
  four-part fit breakdown, retrieval time, source, and a link to the original
  posting. It is the coach's reading of public postings, never an employer
  assessment, an endorsement, or a ranking claim.
  _Avoid_: Job match score, recommendation engine, application shortlist.
- **Fit Breakdown（適配拆解）** — the four separate parts of one shortlist entry:
  matched capabilities, transferable capabilities, gaps, and conditions the posting
  does not state. It never collapses into a single score, and "unknown" is a
  first-class outcome rather than a silent match or a silent gap.
  _Avoid_: Fit score, match percentage, qualification verdict.

A Fit Breakdown is discovery-side analysis of a posting against the Practice
Resume. It is not an **Experience Gap** (which belongs to a Job Capability Map for a
saved Job Snapshot) and must not be presented as one, per ADR 0003's separation of
discovery from practice evidence.

### Interpreting the request

A new model contract turns the learner's sentence into a proposed Job Search
Profile. It receives only the request text and the profile field names, and returns
lists for each field, leaving a field empty when the learner did not state it —
never guessing. The result is validated exactly like a learner-entered profile
before it is shown, and it is shown for confirmation rather than applied. The
learner's request text is treated as untrusted data by the provider instruction, as
every other model input already is.

The Job Search Profile gains a `salary` field alongside its existing six, stored as
a list of learner-stated strings like the others. Profiles saved before this change
load with the new field empty; validation requires the full set only for writes.

### Sources

The job source contract stays replaceable, as ADR 0008 requires. Multiple sources
are configured and searched together, results merged, and each result keeps the
source it came from.

- **Greenhouse boards**, already implemented, become configurable as a list rather
  than one board. Greenhouse returns the employer's original job description text
  and a canonical posting URL, which is what "a source that stably yields the
  original JD" means. Many international employers with Taiwan roles and remote
  roles publish there.
- The **deterministic demonstration source** remains the default so the flow is
  usable and testable with no configuration, and it is labelled as demonstration
  data.
- A source that fails or times out is reported per source; the run completes with
  whatever the healthy sources returned, and says which source failed.

104 was investigated for this round. It is reachable from the developer's agent
tooling through an MCP server, but not from the Local Workspace server that runs
this product, and there is no credential-free public contract this application can
depend on. It is therefore recorded as a future source adapter, not shipped, and
nothing in the interface claims 104 coverage.

### Local filtering, then curation

The pipeline is deliberately two-stage, and the split determines what goes outbound.

1. **Retrieve and filter locally.** Sources are queried with the minimum keywords
   required. Every returned posting is validated for shape and URL safety as it is
   today. Filtering against the Job Search Profile — inclusions, exclusions,
   location, work arrangement, salary text — happens entirely in the Local
   Workspace. The Practice Resume never goes to a job board.
   Location matching gains a small, explicit vocabulary so that Taiwan, Taipei,
   Hsinchu, Kaohsiung and equivalents, and remote/anywhere/distributed phrasings,
   are recognised, and each surviving candidate is tagged `taiwan`, `remote` or
   `unknown` from the posting text rather than assumed.
   De-duplication collapses postings sharing a canonical source URL, and postings
   with the same employer and title from different sources.
2. **Curate with the model.** A bounded number of surviving candidates, each
   trimmed to a bounded excerpt, plus the Practice Resume, go to the configured
   language model under a new contract that returns at most five entries. Each entry
   identifies a supplied candidate by its identifier and gives the Traditional
   Chinese rationale and the four-part Fit Breakdown. Validation rejects any
   identifier that was not supplied, more than five entries, a rationale that cites
   text absent from the supplied posting excerpt, and any claim containing a number
   that appears in neither the posting excerpt nor the resume — the same
   evidence-safety rule the Key-Sentence Correction validator already applies.
   The model may return fewer than five, and returning fewer is correct rather than
   an error; padding is refused.

The curation call sends the Practice Resume to the language model — the same
provider that already receives it for question generation — and this is disclosed in
the provider panel. The confirmed decision "對外搜尋使用必要關鍵字，避免直接傳完整
履歷" governs the **job source**, which receives keywords only.

### Runs, storage and pruning

A search run stores its confirmed profile, retrieval time, per-source status, the
surviving candidates, and the Curated Job Shortlist. Runs are pruned to a small
number of the most recent, as they already are. Selecting a result creates a Job
Snapshot carrying the posting text, source, source URL and retrieval time, and
reuses an existing snapshot for the same run and result instead of creating a
duplicate. Selection accepts the resume choice and question depth so a snapshot
saved from a search is indistinguishable downstream from a pasted one.

Interpretation, searching and curation all run through the existing long-running
operations tracker, so each is cancellable, retryable, idempotent per request
identifier, and visible in the operations strip.

### Empty results

When filtering leaves nothing, the run records which profile conditions eliminated
the most candidates, computed locally from the retrieved postings, and returns them
with concrete relaxations the interface can apply in one click. This requires no
model call.

## Testing Decisions

Good tests assert what the learner sees and what leaves the machine. The two
existing seams are used; no new seam is added.

### HTTP API seam (`test/*.test.js`, prior art `test/discovery.test.js`)

With a stub job source and a stub language model:

- **Interpretation**: a request produces a profile proposal with unstated fields
  empty; an invalid provider output is rejected and the saved profile is unchanged;
  the proposal is not saved until confirmed.
- **Outbound discipline**: the stub job source records exactly what it received and
  the assertion is that the Practice Resume text never appears in it; the curation
  stub asserts that it received the resume and bounded posting excerpts.
- **Curation**: at most five entries; fewer is accepted; an entry naming a candidate
  that was not supplied is rejected as invalid provider output; a rationale quoting
  text absent from the posting is rejected; a number that appears in neither the
  posting nor the resume is rejected; each entry carries all four Fit Breakdown
  parts, with an empty part allowed.
- **De-duplication and attribution**: the same posting from two sources appears once;
  every result carries source and retrieval time; a failing source is reported while
  the healthy source's results survive.
- **Location tagging**: postings are tagged Taiwan, remote or unknown from their own
  text; exclusions are honoured.
- **Empty results**: no qualifying posting yields named blocking conditions and
  suggested relaxations, and no model call.
- **Selection**: selecting creates a Job Snapshot with source, URL and retrieval
  time; selecting twice reuses it; the resume choice and depth are honoured; an
  analysis then generates a valid Question Set.
- **Isolation**: a search run leaves existing snapshots, records and recordings
  byte-identical; workspace deletion removes the profile and runs.

### Browser DOM seam (`test/browser-smoke.js`)

With the demonstration source and provider: type a request, see the proposed
criteria, edit one field, search, see at most five results each showing the four Fit
Breakdown parts, the retrieval time, the source and a link to the original posting,
open the retrieved job description, save one result with the resume attached, reach
a generated question, and confirm no horizontal overflow at phone width. Also walk
the no-results path and confirm the relaxation suggestions appear and apply.

### Not automated

Whether the shortlist is genuinely the right five jobs is a human judgement against
a real configured source, and the verification document records it as pending
learner acceptance. Source coverage for Taiwan is a configuration question, not a
code assertion.

## Out of Scope

- Applying to jobs, contacting employers, generating cover letters, or any outbound
  action on the learner's behalf.
- Scheduled, background or continuous searching, and change alerts on saved jobs.
- Salary prediction, negotiation advice, or company reviews.
- A single fit score, ranking claim, or success-probability estimate.
- Role Research Brief and Bounded Research Run behaviour (ADR 0004 and ADR 0015 keep
  role research separate from posting facts; this PRD touches neither).
- A 104 source adapter, and any source requiring a login, a paid key, or scraping a
  site that forbids it.
- Sending the Practice Resume to a job board under any circumstance.
- Changing the Job Capability Map, Question Set or Practice Loop contracts.

## Further Notes

- The confirmed direction says "先選少數可穩定取得原始 JD 的來源；具體來源需調查".
  This PRD's answer is: Greenhouse boards, configurable as a list, plus the
  demonstration source, with the contract kept replaceable. That is a narrower
  answer than "Taiwan job market coverage" and the interface must not imply
  otherwise.
- The Fit Breakdown deliberately has an "unknown" bucket because a posting that
  does not mention a condition is not evidence either way. Collapsing unknown into
  match or gap is the most likely way this feature would start lying.
- ADR 0003 keeps discovery separate from practice evidence. A Fit Breakdown must not
  be written into the Legacy Candidate Evidence Profile, and must not be presented as
  an Experience Gap against a Job Capability Map.
