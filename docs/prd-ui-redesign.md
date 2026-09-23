---
status: ready-for-agent
---

# PRD — Workbench UI redesign

Source of confirmed requirements: [`ui-direction-discussion.md`](./ui-direction-discussion.md)
(2026-09-23 decision and the 2026-09-23 trade-off defaults), the confirmed mockup
[`design/mockups/workbench-annotated-feedback/`](./design/mockups/workbench-annotated-feedback/)
(design tokens live in its `index.html` `:root`), the AI-persona QA in
[`verification/persona-walkthrough-2026-09-23.md`](./verification/persona-walkthrough-2026-09-23.md),
`CONTEXT.md`, and [ADR 0006](./adr/0006-use-a-fixed-evidence-based-feedback-contract.md),
[ADR 0016](./adr/0016-use-bilingual-feedback-with-shared-evidence.md),
[ADR 0018](./adr/0018-provide-an-explicitly-hypothetical-illustrative-answer.md),
[ADR 0019](./adr/0019-retain-local-answer-recordings-for-playback.md).

Nothing in this PRD re-opens a decision the learner already made. Where the
mockup left a trade-off open, the confirmed default is recorded under
**Implementation Decisions**, not silently assumed. This PRD is presentation and
navigation only: it changes no HTTP contract, no stored data shape, no model
prompt, and none of `src/codex-*.js`. Every existing feature stays reachable;
behaviour and data are unchanged.

## Problem Statement

The learner said the current interface "looks like a Claude-branded template."
A 2026-09-23 audit of the live app (fake-provider screenshots, 1440px and 390px)
confirmed 6 of 8 typical Headspace-style traits are present:

- Warm cream background (`--mist:#fff4e8`), peach header gradient `#ffedd5 →
  #fff4e8` (`public/style.css:17,23`).
- Terracotta/peach accent (`--teal:#944427`, the variable is named teal but the
  colour is orange-brown; primary button `#f4a573`) (`public/style.css:8-9,325`).
- A single centred narrow column: content is 780-880px wide, leaving roughly
  300px empty on each side at 1440px.
- 28px large-radius, soft warm-shadow cards (`public/style.css:113-118`).
- Fully pill-shaped buttons, `border-radius:999px` (`public/style.css:300`).
- Generous whitespace throughout.

This was a deliberate earlier choice — `learner-flow-discussion.md` records a
2026-09-18 decision to use a Headspace-style meditation visual language (warm
peach/cream, coral buttons, pills, 24-32px radii) that happens to overlap with
Claude's own product look. This PRD replaces that visual language; it does not
fault the earlier decision.

The same audit and the 2026-09-23 AI-persona walkthrough (run against the
`creator-validation.zh-TW.md` runbook, loops 2-5) found information-architecture
problems that are independent of colour and shape and must be fixed as part of
this redesign, not deferred:

- **練習紀錄 job cards use the entire JD text as the `<h3>` title.**
  `public/app.js:1144` — `function jobTitle(snapshot) { return snapshot?.title
  || firstLine(snapshot?.text); }` — falls back to the first non-blank line of
  the pasted job description, which is routinely a full sentence. The job
  header at `public/app.js:1250` renders `` `<h3>${escape(job.title)}</h3>` ``
  with **no** truncation, unlike the practice view's job line
  (`public/app.js:1012`), which already truncates the same helper's output.
  A 2026-09 earlier fix truncated only that one other location.
- **「我的進步」 has no navigation entry anywhere.** The view, its route name,
  and its renderer all exist and work (`public/index.html:69`,
  `public/app.js:248,1278`), but `public/index.html`'s `<nav>` lists only five
  buttons (開始練習／找職缺／練習紀錄／我的履歷／設定) and nothing in the
  codebase carries `data-view="progress"`. The persona walkthrough's loop 5
  could only reach the page with a DOM workaround
  (`docs/verification/persona-walkthrough-2026-09-23.md`, finding 1); the
  underlying content was verified correct, the entry point was not. The
  `creator-validation.zh-TW.md` runbook already instructs the creator to click
  a 「我的進步」 nav item that does not exist.
- A single-practice mobile feedback screen is roughly 7300px tall with 「結束
  並保存」 at the very bottom (`ui-direction-discussion.md`).
- The home page is a single textarea; a first-time visitor cannot tell what the
  product does before pasting a job description.
- Feedback re-pastes the learner's own sentences into several separate quote
  boxes instead of annotating one transcript.

## Solution

Apply the visual direction the learner confirmed on 2026-09-23: **A. workbench
layout** (Linear/Vercel/Raycast — neutral white/zinc surface, one cool accent,
6-8px radii, hairline borders, higher information density, monospace
transcript) for the app shell and practice screen, **B. annotated feedback**
(Grammarly-style editor — the transcript appears once, feedback references are
marked directly on it and linked to notes in a side pane, four ratings shown as
1-4 segment bars, key-sentence corrections shown as an inline diff), and **D.
dark mock-interview room** (Yoodli/Final Round AI — recording- and
timer-centred) applied only to the three-question Short Mock Session; every
other screen stays light. Gamified style **C** (Duolingo/Speak) was explicitly
rejected as too casual for interview preparation and portfolio use.

This redesign ships now, ahead of the creator's five validation practices,
superseding the earlier "no UI changes during validation" sequencing (see
**Further Notes**). It touches presentation and navigation only.

## Goals

- Replace the Headspace-style visual language with the confirmed
  workbench + annotated-feedback + dark-room direction, using the design
  tokens defined in the mockup.
- Fix the two information-architecture defects called out by the user: add a
  「我的進步」 navigation entry, and stop showing raw JD text as a job card
  title.
- Make every existing view and every existing feature (practice loop, voice,
  follow-ups, corrections, short mock session, history, progress, evidence,
  discovery, settings, operations panel) reachable and usable in the new shell,
  unchanged in behaviour.
- Meet the responsive and accessibility rules recorded under
  **Implementation Decisions**.

## Non-goals

- No backend, API, model-contract, or prompt changes; no changes to
  `src/codex-*.js` or `evaluation/`.
- No new data fields, no new stored state beyond a per-viewer display
  preference (listening mode already does this; nothing new is added here).
- No changes to what a Feedback Report, Session Summary, Fit Breakdown, or any
  other model output contains — only how it is displayed.
- No 104 job-URL paste input (the mockup shows a decorative "貼上 JD / 104
  網址" toggle; the real app has no URL-fetch capability, see **Out of
  Scope**).
- No structured "company" field or chip (the mockup's job company text is
  sample data; the real Job Snapshot has no such field, see **Further Notes**).
- No system-light variant of the dark mock room (the mockup defines the tokens
  for one; building it is deferred).

## User Stories

### Recognising the product and getting started

1. As a Target Learner arriving for the first time, I want to understand what
   the product does within about five seconds, so that I know whether to paste
   my job description.
2. As a Target Learner, I want to see a short, concrete example of what the
   feedback looks like before I do anything, so that I can judge the product's
   value up front.
3. As a Target Learner, I want the example feedback to be clearly labelled as
   a fixed sample, so that I never mistake it for my own practice.
4. As a returning Target Learner, I want my "continue last practice" card to
   still appear first, so that resuming is still one click.

### Finding every feature

5. As a Target Learner, I want a 「我的進步」 link in the main navigation, so
   that I can actually reach the page that already tracks my Focus Points.
6. As a Target Learner, I want the same set of destinations (開始練習／找職缺／
   練習紀錄／我的進步／我的履歷／設定) reachable from every screen, so that
   navigation is never a dead end.
7. As a Target Learner on a narrow desktop window, I want the navigation to
   collapse to icons rather than disappear, so that I do not lose destinations
   just because my window is smaller.
8. As a Target Learner on a phone, I want the same destinations reachable
   through a compact menu, so that mobile is not second-class.

### Practising in the workbench

9. As a Target Learner on a desktop screen, I want the question and my answer
   on one side and feedback on the other, so that I can work without losing
   sight of either.
10. As a Target Learner, I want to see which question in the job's set I am on
    and which ones I have already answered, so that I can plan my session.
11. As a Target Learner on a mid-size window (1024-1280px), I want the layout
    to still work rather than crush my answer column, so that a laptop is not
    a broken experience.
12. As a Target Learner on a phone, I want my answer and my feedback in
    separate tabs with a count on the feedback tab, so that a single practice
    is not one enormous scroll.
13. As a Target Learner on a phone, I want 「結束並保存」 fixed at the bottom
    of the screen, so that I never have to hunt for it at the end of a long
    feedback page.
14. As a Target Learner, I want the transcript shown in a clear monospace
    typeface, so that the reading experience matches the workbench's
    engineering-tool feel.

### Reading annotated feedback

15. As a Target Learner, I want my own answer shown exactly once, with the
    feedback's references marked directly on it, so that I never see the same
    sentence pasted into three separate boxes.
16. As a Target Learner, I want hovering or focusing a marked sentence to
    highlight the matching note, and vice versa, so that I can see exactly
    which words support which comment.
17. As a Target Learner, I want the strength and the priority improvement
    visually distinguished from each other and from the rating evidence, so
    that I do not have to read every note to tell them apart.
18. As a Target Learner, I want that distinction to work even if I cannot see
    colour, so that the annotation scheme is not colour-only.
19. As a Target Learner, I want the four ratings shown as clear 1-4 bars I can
    expand for the Chinese reason, so that the summary is scannable and the
    detail is still there.
20. As a Target Learner, I want a Key-Sentence Correction shown as an inline
    diff against my own sentence, so that I see exactly what changed instead
    of comparing two separate blocks by eye.
21. As a Target Learner, I want a sentence that two feedback items both quote
    (even partially) to carry both annotations correctly, so that overlapping
    evidence is never dropped or merged into one.

### Practising a Short Mock Session

22. As a Target Learner starting a Short Mock Session, I want a calmer, darker,
    recording-focused room, so that the session feels closer to a real
    interview than the rest of the product.
23. As a Target Learner in the session, I want the question, a waveform, a
    timer and one big record control, so that I can focus on speaking rather
    than on reading a form.
24. As a Target Learner in the session, I want listening mode and skipping to
    work exactly as they do today, so that this redesign does not remove a
    capability the moment it changes the room's colour.
25. As a Target Learner, I want every other screen to stay in the light
    workbench theme, so that the dark room reads as a deliberate, contained
    experience rather than an inconsistent app.

### Fonts, performance and disclosure

26. As a Target Learner on a machine that cannot load Google Fonts, I want the
    interface to still render legibly in system fonts, so that a blocked
    network request never breaks the page.
27. As a Target Learner, I want the redesign to change nothing about what
    service receives my data or when, so that the trust model I already
    understand is unaffected by a visual change.

## Design System

Tokens are defined in `docs/design/mockups/workbench-annotated-feedback/index.html`'s
`:root` (light workbench) and its `.room` block (dark mock room), and carry into
`public/style.css` unchanged in value.

### Light workbench (`:root`)

| Group | Token | Value |
|---|---|---|
| Neutral | `--canvas` | `#FAFAFA` |
| Neutral | `--surface` | `#FFFFFF` |
| Neutral | `--subtle` | `#F4F4F5` |
| Neutral | `--hover` | `#EFEFF1` |
| Neutral | `--border` | `#E4E4E7` |
| Neutral | `--border-strong` | `#D4D4D8` |
| Neutral | `--text` | `#18181B` |
| Neutral | `--text-2` | `#3F3F46` |
| Neutral | `--muted` | `#71717A` |
| Accent (iris) | `--accent` | `#5B5BD6` |
| Accent | `--accent-hover` | `#4E4EC4` |
| Accent | `--accent-text` | `#4343B8` |
| Accent | `--accent-soft` | `#EEEEFC` |
| Accent | `--accent-line` | `#B9B9F2` |
| Semantic (feedback only) | `--ok` / `--ok-bg` / `--ok-line` | `#157A3E` / `#E3F5E9` / `#2F9E5B` |
| Semantic (feedback only) | `--warn` / `--warn-bg` / `--warn-line` | `#A14C06` / `#FDF1D6` / `#D98A0B` |
| Semantic (feedback only) | `--del` / `--del-bg` | `#B42318` / `#FDE7E5` |
| Semantic (feedback only) | `--ins` / `--ins-bg` | `#157A3E` / `#DDF3E4` |
| Type | `--font-ui` | `"Inter","Noto Sans TC",system-ui,-apple-system,"PingFang TC",sans-serif` |
| Type | `--font-zh` | `"Noto Sans TC","Inter","PingFang TC",sans-serif` |
| Type | `--font-mono` | `"JetBrains Mono","Noto Sans TC",ui-monospace,SFMono-Regular,Menlo,monospace` |
| Type scale | `--fs-11 … --fs-32` | `11,12,13,14,16,20,28,32px` |
| Radii | `--r-xs / --r-sm / --r-md` | `4px / 6px / 8px` |
| Spacing (4px base) | `--s-1 … --s-12` | `4,8,12,16,20,24,32,48px` |
| Elevation | `--shadow-pop` | popovers/sheets only — panes use `--hair: 1px solid var(--border)` |
| Layout | rail width | `224px`, collapses to `56px` below 1280px |
| Layout | feedback pane width | `440px`, `400px` below 1280px |
| Layout | control heights | `28 / 32 / 40px` (40 on mobile) |

### Dark mock room (`.room`, scoped to the Short Mock Session only)

| Token | Value |
|---|---|
| `--m-bg` | `#0B0B0E` |
| `--m-surface` | `#141418` |
| `--m-raised` | `#1C1C22` |
| `--m-border` | `#2A2A32` |
| `--m-text` | `#EDEDF0` |
| `--m-muted` | `#9D9DA8` |
| `--m-accent` | `#9A9AF8` |
| `--m-accent-soft` | `#23234A` |
| `--m-rec` | `#F04438` |
| `--m-rec-soft` | `rgb(240 68 56 / .16)` |

The mockup also defines a `.room[data-scheme="system"]` light variant under
`@media (prefers-color-scheme: light)`. It is **not** built in this PRD (see
**Non-goals**); the tokens are recorded here so a later change can pick them up
without re-deriving them.

### Feedback annotation marks (no colour-only distinction)

| Kind | Line style | Text tag | Meaning |
|---|---|---|---|
| Strength | solid underline, `--ok-bg` fill | 優 | The strength quote |
| Priority improvement | wavy underline, `--warn-bg` fill | 改 | The priority-improvement quote |
| Rating evidence | dotted underline, `--accent-line` | 切／據／構／英 | relevance／support／structure／englishExpression quote |

`切`/`據`/`構`/`英` map to `relevance`/`support`/`structure`/`englishExpression`
respectively — the same four dimensions ADR 0006 fixed; no dimension is
renamed or reordered.

## Per-View Requirements

- **App shell / left rail** — Brand mark, primary 開始練習 entry, the current
  job's question list (when inside a practice), and 找職缺／練習紀錄／我的進步
  （NEW ENTRY）／我的履歷 with 設定 pinned at the bottom. Below 1280px the rail
  collapses to a 56px icon strip; below 1024px it is replaced by the mobile
  chrome (compact menu button in the breadcrumb).
- **Practice workbench (desktop)** — Two panes ≥1024px: question + answer on
  the left, annotated feedback on the right with a sticky footer holding the
  primary completion action. A breadcrumb shows the job (truncated title) and
  a step indicator (題目／作答／回饋／追問可選).
- **Practice workbench (mobile, <1024px)** — Question fixed at top; 你的回答／
  回饋 tabs below it, the feedback tab carrying a count badge; 結束並保存 fixed
  to the bottom of the viewport at all times.
- **Annotated feedback pane** — See **Design System** and issue 0024. Applies
  to the single-question Practice Loop, a Practice Record's stored feedback,
  and a Follow-up Question's feedback; the Session Summary and per-question
  Short Mock Session feedback reuse the same pane inside the dark room /
  post-session review.
- **Home** — Five-second-legible hero, a four-step flow strip (貼上職缺／依
  職缺出題／開口回答／逐句回饋), the existing JD textarea and its existing
  label/behaviour unchanged, and a static feedback preview rendered from a
  fixed sample object per decision (5) below. The "continue last practice"
  card keeps its current logic, restyled.
- **練習紀錄 (History)** — Job cards show a truncated job title (existing
  `truncate()` helper, already used elsewhere, applied consistently) instead
  of the raw first line of the JD. See **Further Notes** for why no separate
  "company" field is added.
- **我的進步 (Progress)** — Restyled to the new tokens; reachable via the new
  rail entry; content and logic unchanged.
- **我的履歷 (Evidence), 找職缺 (Discovery), 設定 (Settings)** — Restyled to
  the new tokens and narrow single-column pattern; no content or behaviour
  change.
- **Operations panel/strip** — Restyled; continues to show in-flight/failed
  operations exactly as today.
- **三題短場模擬 (Short Mock Session)** — Dark room per **Design System**;
  everything else (question stage, waveform, timer, record control, listening
  mode, skip, progress dots, category chip, post-session summary) is the
  existing capability, restyled.

## Implementation Decisions

### Trade-off defaults (from the mockup's open questions, confirmed 2026-09-23)

1. **Breakpoints.** Two panes at ≥1024px. The rail collapses to a 56px icon
   strip below 1280px (panes stay two-column, just narrower — 400px feedback
   pane instead of 440px). Panes stack into a single column below 1024px,
   where the mobile tab pattern takes over.
2. **Overlapping quotes.** The transcript is split into segments at every
   quote boundary from every feedback item (strength, priority improvement,
   each rating's evidence quote, each Key-Sentence Correction's `original`).
   A segment that falls inside more than one quote's span carries every
   matching annotation id in `data-notes` (space-separated) and is visually
   the union of its annotation styles; hovering or focusing one annotation
   highlights every segment that carries its id, even a segment it shares
   with another annotation.
3. **Transcript typeface.** Monospace (`--font-mono`, JetBrains Mono with the
   documented fallback chain) as in the mockup, applied to the transcript,
   the JD textarea, and timers only — not to Chinese prose or button labels.
4. **Rating bars.** All four dimensions use the single accent colour
   (`--accent`) rather than a red/yellow/green scale; a 2/4 rating is not
   rendered as if it were failing. The Chinese reason text under an expanded
   bar carries the actual assessment, so a weak rating is still legible from
   its text, just not colour-coded as an alarm.
5. **Home feedback preview.** A small, fixed sample object (question, one
   transcript excerpt, one strength note, one priority-improvement note, and
   the four rating bars) baked into the home view's markup/script. It makes
   no request to any API and is visibly labelled as an example. When the
   annotated-feedback markup changes (issue 0024), the home preview must be
   updated in the same change so it never drifts into a stale mock of a
   feedback layout the app no longer produces.

### Fonts and Content-Security-Policy

`src/server.js:750` currently sends:

```
Content-Security-Policy: default-src 'self'; style-src 'self'; script-src 'self';
connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'none'
```

There is no `font-src` directive, so it falls back to `default-src 'self'`,
and `style-src 'self'` already blocks the Google Fonts `<link
rel="stylesheet">`. Both must change for the mockup's Google Fonts link to
work as written.

**Decision:** use the Google Fonts link as the mockup does (the learner
already accepted this), and widen the CSP by exactly two origins:

```
style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;
```

No other directive changes. `--font-ui`, `--font-zh`, and `--font-mono` each
keep their existing system-font fallback chain (`system-ui`, `-apple-system`,
`"PingFang TC"`, `"Noto Sans TC"`, `ui-monospace`, `SFMono-Regular`, `Menlo`,
`monospace`) unchanged from the mockup, so a blocked or slow font request
degrades to a legible system font rather than invisible text. `README.md` and
`.env.example` (if either mentions outbound network behaviour) should note
that loading the page now fetches CSS/fonts from `fonts.googleapis.com` and
`fonts.gstatic.com` regardless of practice activity — this is a static asset
fetch, not a data-processing provider call, and is unrelated to the existing
speech/model provider disclosure, but it is a new unprompted outbound request
and should be stated plainly rather than left implicit.

### Zero dependencies

No npm package is added. The Google Fonts `<link>` is markup, not a
dependency; everything else is vanilla HTML/CSS/JS exactly as today.

## Responsive Rules

- **≥1280px** — full rail (224px) + two panes (440px feedback pane).
- **1024-1279px** — icon-only rail (56px) + two panes (400px feedback pane);
  step labels in the topbar collapse to icons only.
- **<1024px** — rail hidden, replaced by a menu button in the breadcrumb;
  panes stack into the mobile tab pattern (你的回答／回饋) with 結束並保存
  fixed to the bottom of the viewport.
- **<768px** — tighter spacing and type scale as specified in the mockup's
  `@media (max-width:767px)` block (question/transcript font sizes, gutter
  width, flow-strip reflow to two columns).
- No view may produce horizontal overflow at 390px width — the existing
  `browser-smoke.js` assertion continues to apply everywhere, not only in the
  screens it currently touches.

## Accessibility

- Feedback annotations are distinguished by line style (solid／wavy／dotted)
  and a text tag (優／改／切據構英), never by colour alone.
- Key-Sentence Correction diffs use strikethrough + colour for deletions and
  underline + colour for insertions — style and colour together, not colour
  alone.
- All interactive elements (rail items, tabs, transcript marks, rating bar
  summaries, the mock-room record button, the listening-mode switch) are
  reachable and operable by keyboard, with visible focus rings
  (`:focus-visible`, 2px accent outline as in the mockup).
- Colour contrast meets WCAG AA for text and for the line-style distinctions
  above, checked against both the light workbench and the dark mock room
  palettes.
- The existing listening-mode accessibility behaviour (hidden question text
  removed from the accessibility tree, state change announced — issue 0021)
  is preserved unchanged in both the light practice screen and the dark mock
  room.
- Hovering/focusing a transcript mark or a feedback note must produce an
  equivalent experience for keyboard and screen-reader users, not a
  mouse-only affordance.

## Label Changes

The redesign keeps every existing Traditional Chinese label the
`creator-validation.zh-TW.md` runbook and `test/browser-smoke.js` already rely
on (開始練習／找職缺／練習紀錄／我的履歷／設定／查看全部／選這一題／開始
回答／送出並取得回饋／結束並保存／顯示題目, etc.). No existing label's text
is renamed by this PRD. The changes are additive:

| Change | Where | Why |
|---|---|---|
| New nav entry 「我的進步」 | Left rail / mobile menu | Fixes the missing entry point; reuses the page's own existing heading text (`public/index.html:69`), so no new wording is coined. |
| New tab labels 「你的回答」／「回饋」 | Mobile practice workbench | New mobile-only navigation pattern (issue 0023); the count badge on 回饋 is new UI, not a renamed control. |
| New tag glyphs 優／改／切／據／構／英 | Annotated feedback marks | New inline annotation UI (issue 0024); does not rename `relevance`/`support`/`structure`/`englishExpression`, which keep their existing Chinese labels (切題程度／論據與例子／回答結構／英文表達) in the expandable rating rows. |
| New hero copy (eyebrow, h1, lead, four-step flow) | Home | New first-impression content (issue 0025); does not touch the existing `#jd` textarea's label or placeholder. |

`docs/creator-validation.zh-TW.md` and `test/browser-smoke.js` are updated
only where they reference the previously-missing 「我的進步」 nav path or
selectors whose DOM structure changes (see issue 0028); their existing
label-text assertions are not expected to need textual changes.

## Testing / Verification Decisions

Good tests here assert what a Target Learner can observe on screen and by
keyboard: which controls exist, what they say, what they do, and that no
existing HTTP behaviour changed. No new HTTP endpoint or stored-data seam is
introduced, so no new API test file is needed; `npm test` must keep passing
unmodified (this PRD changes no server code).

- **`npm test`** — run after every issue; must stay green throughout, since
  this PRD makes no contract changes.
- **`npm run test:browser`** — updated incrementally as each issue changes
  DOM structure or adds controls (new rail entry, new mobile tabs, new
  annotation marks, new dark-room controls), and given a final full pass in
  issue 0028. `browser-smoke.js`'s existing hard-coded IDs and button texts
  (see `docs/ui-ux-fixes-2026-09.md`, "Test constraints") must keep matching
  unless an issue explicitly changes one, in which case the same issue updates
  the corresponding assertion.
- **New screenshots** — `docs/verification/` gets a fresh set of desktop
  (1440px) and mobile (390px) screenshots per redesigned view, replacing the
  now-stale `docs/verification/ui-redesign/*.png` and any other pre-redesign
  screenshots referenced from `docs/verification/*.md`, so verification
  evidence matches what actually ships.
- **`docs/creator-validation.zh-TW.md`** — synced in issue 0028 wherever it
  names a nav path, a button, or a screen region whose location or wording
  changed (principally: 我的進步 is now reachable as instructed, and any
  screen-region description tied to the old single-column layout).
- Real-microphone, real-listening-comprehension, and real-model-quality
  acceptance are unaffected by this PRD and remain governed by the existing
  PRDs that introduced them; this redesign does not re-run that evidence.

## Risks

- **`public/app.js` is a single 1500+ line file** that both renders every
  view and owns application state; a redesign that reorganises markup across
  six-plus issues risks accumulating merge friction and duplicated render
  logic if issues are not scoped to distinct render functions. Each issue
  below is scoped to a distinct set of render functions to limit this.
- **Runbook drift.** `docs/creator-validation.zh-TW.md` and
  `docs/ui-ux-fixes-2026-09.md` both hard-code selectors, button text, and
  screen-region descriptions. Every issue must check both documents for
  affected passages before finishing, not only at the end in issue 0028.
- **`agent-browser`/automation click flakiness.** The persona walkthrough
  found that this app's native button clicks are frequently not triggered by
  `agent-browser click`, requiring `element.click()` via `eval` instead
  (`docs/verification/persona-walkthrough-2026-09-23.md`, finding 4). This is
  unrelated to real mouse/keyboard use, but any browser-smoke automation
  written for the new DOM should account for it or note it if encountered.
- **Font loading is a new unprompted outbound request** on every page load
  (see **Fonts and Content-Security-Policy**). If this is judged
  unacceptable after implementation, the fallback is to drop the Google
  Fonts `<link>` and rely on the system-font stacks alone; the tokens already
  support this without further CSS changes.
- **Two-pane 1024-1280px width** was explicitly flagged in the mockup as
  tight (~560px answer column); the confirmed default (icon rail, 400px
  feedback pane) is the mockup's own answer to this, not a novel decision,
  but it should be re-checked visually once real content (not sample data)
  is in the pane.

## Out of Scope

- Any backend, API, model-contract, prompt, or `src/codex-*.js` change.
- Any evaluation suite change.
- A structured "company" field on Job Snapshot, and any UI that implies one
  exists (the mockup's job "company" text is fabricated sample data — see
  **Further Notes**).
- A "貼上 104 網址" job-input mode. The mockup shows a decorative segmented
  control for it; the real app has no URL-fetch capability, and adding one is
  a backend change out of scope for this PRD. The redesigned home page offers
  only the existing "貼上 JD" text path.
- A system-light variant of the dark mock room.
- Gamified visual style (rejected direction C).
- Any change to the Practice Loop, Short Mock Session, follow-up, correction,
  discovery, or evidence *behaviour* — only their presentation.

## Further Notes

- **The mockup's own rail omits 「我的進步」.** The confirmed mockup
  (`index.html:769-780`) lists 開始練習／找職缺／練習紀錄／我的履歷／設定 in
  its illustrative rail — it does not show the fix this PRD requires. Issue
  0022 adds 「我的進步」 as a sixth rail entry; this is a deliberate departure
  from the mockup's sample markup, not an oversight, because the missing entry
  point is a "must fix" called out independently of the mockup.
- **No "company" field exists in the data model.** The mockup's sample data
  (`index.html:574`) invents `company:'香港商六度科技有限公司'` and a `short`
  nickname to fill its breadcrumb/nav-job "company" chip. Searching
  `src/*.js` and `public/app.js` for `company` finds nothing: a Job Snapshot
  has only `title` (learner-editable) and `text` (the raw pasted JD) — see
  `public/app.js:1144`. The Curated Job Shortlist (`public/app.js:1361`)
  carries `title`/`location`/`source`, also no `company`. Extracting a company
  name would require an analysis/model-contract change, which is out of
  scope. This redesign truncates `jobTitle(snapshot)` everywhere it is shown
  (fixing the reported bug) and does not add a company chip anywhere a real
  one cannot be sourced.
- **The mockup's "貼上 104 網址" toggle is decorative.** It is rendered as a
  disabled-looking `.seg` control in the mockup with no working handler and no
  backing feature in the real app (confirmed: no `104` or URL-fetch logic
  anywhere in `src/` or `public/`). It is dropped from the redesigned home
  page rather than shipped as a button that always fails, consistent with
  this product's existing rule (see the listening-mode toggle, issue 0021)
  that a control is never offered for a capability that cannot happen.
- **Sequencing supersedes `ui-direction-discussion.md`.** That document's
  "順序" section previously read "creator validation completes first, no UI
  changes during validation." The user confirmed on 2026-09-23 that the full
  redesign proceeds now, ahead of and independent of the remaining creator
  validation practices; `ui-direction-discussion.md` is updated in the same
  commit as this PRD to record that reversal with today's date, so the two
  documents do not disagree about sequencing.
- Issues 0022-0028 are tracer-bullet vertical slices, each independently
  shippable and independently verifiable, in dependency order. See
  `docs/issues/README.md` for the authoritative table; the same rows are
  reproduced below for convenience.

| Issue | Scope |
|---|---|
| [0022](./issues/0022-design-tokens-and-app-shell.md) | Design tokens, app shell, left rail (with 我的進步), breadcrumb, fonts, CSP |
| [0023](./issues/0023-practice-workbench-two-pane-and-mobile-tabs.md) | Practice screen two-pane workbench, mobile answer/feedback tabs, fixed 結束並保存 |
| [0024](./issues/0024-annotated-feedback.md) | Annotated feedback: transcript marks, linked notes, rating bars, inline correction diff, overlapping quotes |
| [0025](./issues/0025-home-redesign.md) | Home: five-second hero, flow strip, static feedback preview |
| [0026](./issues/0026-remaining-views.md) | 題目集／練習紀錄（含標題截短）／我的進步／我的履歷／找職缺／設定／操作列 restyle |
| [0027](./issues/0027-mock-session-dark-room.md) | Short Mock Session dark room |
| [0028](./issues/0028-verification-and-runbook-sync.md) | Browser smoke update, new screenshots, `creator-validation.zh-TW.md` label sync |
