# UI/UX Fixes — 2026-09

Plan for the seven UI/UX issues found in the browser walkthrough (deterministic
demonstration provider). Decisions were locked in a grilling session; each item
records the chosen direction and the concrete implementation.

Guiding domain fact (from `CONTEXT.md`): **completing a Practice Loop *is*
selecting a Focus Point** (the default Focus Point = the Feedback Report's
priority improvement). A follow-up and a revision are *optional* branches. So the
post-feedback screen has exactly one completion, plus optional branches — the
UI must reflect that hierarchy.

## Test constraints (must not break)

`test/browser-smoke.js` hard-codes selectors and button text in the areas being
changed. These must survive verbatim:

- IDs: `#complete-practice`, `#resume-file`, `#answer`, `#submit-answer`,
  `#draft-status`, `#next-question`, `#recommended-question`, `#save-resume`,
  `#practice-complete`, `#feedback-actions`, `#follow-up-actions`,
  `#follow-up-answer`, `#submit-follow-up`, `#follow-up-feedback-title`,
  `#rewrite-result`, `#ideas-result`.
- Button texts: `結束並保存` (inside `#follow-up-actions`), `自己再試一次`,
  `幫我講得更自然`, `讓面試官追問`, `繼續追問`.
- `browser-smoke.js:74` asserts **no mobile horizontal overflow**.

Therefore the post-feedback rework is CSS + regrouping + removing *one* button —
**not** renaming buttons or containers.

Run after every change: `npm test` (84 API cases) and `npm run test:browser`.

---

## 1. 🔴 Desktop vertical-text bug — job-line / "查看職缺原文"

**Cause:** `app.js:217` `title = firstLine(snapshot.text)`. A JD pasted as one
block makes "first line" = the whole JD, which fills the `.job-line` flex row
(`style.css:186`) and squeezes the `<summary>` toggle into one char per line.
The full JD then also appears inside the toggle (duplication).

**Decision (Q2): compact, collapsed single line.**
Render `職缺：{短標題…} ▸ 查看原文` as one line.

- `app.js:218`: change the `.job-line` markup so the label is a short title
  (first line truncated to ~50 chars) + the `<details>` toggle; drop the bold
  full-first-line.
- `style.css`: `.job-line strong { min-width:0; overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }` and
  `.job-line details, .job-line summary { flex:0 0 auto; white-space:nowrap; }`.
  (`min-width:0`/`overflow:hidden` are required so the ellipsis never forces
  width → no mobile overflow.)

## 2. 🟠 Post-feedback action overload

**Cause:** 5 actions across 3 same-colored cards; **two** end buttons that both
call `finish()` — `直接結束並保存` (`app.js:787`) and `結束並保存`
(`app.js:765`) show simultaneously when no follow-up has started.

**Decision (Q1): one "接下來" section, single completion button, optional
branches demoted.**

- **Remove** `直接結束並保存` (`app.js:787`) — the pre-follow-up duplicate.
  `#complete-practice` in the focus-box becomes the single end button.
  (Safe: smoke never clicks `直接結束並保存`. The `結束並保存` button that lives
  inside `#follow-up-actions` *during* the follow-up flow — `app.js:792,802` —
  stays, because smoke depends on it and its pending-feedback gating.)
- Group the optional actions (`讓面試官追問`, `自己再試一次`, `幫我講得更自然`)
  under one "接下來" heading, styled clearly **secondary** (ghost/secondary).
- Give the completion block the only visual accent; stop rendering three
  competing filled peach cards (CSS: neutralize the extra card backgrounds,
  keep one accent on the focus-box / completion action).
- Keep the Focus Point editor inline, directly above `#complete-practice`.

## 3. 🟠 Huge question + whole-JD echo

**Cause:** two levers.
(a) `.question-text` is `clamp(24px, 3.3vw, 34px)` — hero-sized (`style.css:190`).
(b) Demo provider builds `text = "{prompt} Focus: {c.evidence}"` (`providers.js:55`)
and `c.evidence` is the capability citation drawn from the first 4 JD lines
(`providers.js:14`); a one-line JD makes it the entire JD, flooding the question,
the 中文題意, and the feedback quotes.

**Decision (Q3): fix both.**

- **Provider:** trim each capability's `evidence` to a short, realistic citation
  (first sentence / ~80 chars ending on a word or punctuation boundary) in
  `providers.js`. It must remain a **verbatim substring** of `snapshot.text`
  (validator `domain.js:30` requires `snapshot.text.includes(q.evidence)`) and
  non-empty. This shortens the question, the 中文題意, and `transcript`-based
  quotes across every screen, so the demo reads like the real product.
- **CSS:** `.question-text` max `34px → 28px` (e.g. `clamp(22px, 2.6vw, 28px)`),
  still clearly larger than body, calmer for long questions.
- Re-run `npm test`; no test pins the exact demo question text, and tests only
  mutate provider output to exercise validators, so trimming is low-risk.

## 4. 🟠 Post-submit lands at page top

**Cause:** `showRecord` re-renders and leaves scroll at the top (the big
question); the user must scroll past it to reach feedback.

**Decision (Q5): scroll to & focus the feedback heading, only on fresh feedback.**

- Give the `給這次回答的一點建議` `<h2>` an id + `tabindex="-1"`.
- Pass a flag from the submit/feedback handler (e.g. `showRecord(id,
  {focusFeedback:true})`); after render, `scrollIntoView` + `focus()` that
  heading. Opening a saved record (no flag) still lands at the top.
- Mirrors the existing follow-up pattern (`#follow-up-feedback-title`,
  `app.js:696,725`).

## 5. 🟠 Repeated citation per rating dimension

**Note:** lower severity than first thought — the four ratings are already inside
a collapsed `<details>` (`查看四項評分與理由`, `app.js:374-375`), so only 2
quotes (strength + priority) show by default. Q3 also shortens the quotes.

**Decision (Q4): compact scorecard + dedupe quotes.**

- In `feedbackHtml` (`app.js:374`), render each dimension as a compact row
  (dimension + `n/4` + one-line reason).
- Show a rating's `評分依據原句` only when its quote differs from the
  strength/priority quotes already shown above and from earlier ratings; dedupe
  identical quotes.
- `feedbackHtml` is shared by follow-up / history / legacy callers — keep all
  paths rendering correctly (legacy records lack `textZh`/`reasonZh`).

## 6. 🟡 Native file input

**Cause:** `app.js:873` uses a bare `<input type="file" id="resume-file">` →
unstyled "Choose File".

**Decision (Q6): styled button + filename display.**

- Visually hide `#resume-file` (keep the element and its `change` handler — smoke
  sets `.files` on it at `browser-smoke.js:29,31`).
- Add a `<label for="resume-file">` styled as a `選擇檔案` button + an inline
  filename readout updated on `change`.

## 7. 🟡 Nav overflow — deferred

**Decision (Q7): no change this round.** All 4 nav items fit at desktop and
402px mobile; `overflow-x:auto` (`style.css:67`) is adequate. Revisit only if
nav items are added. Recorded here as a known future consideration.

---

## Suggested sequencing

1. #1 job-line (small, isolated CSS + one markup line).
2. #6 file input (isolated).
3. #3 provider evidence trim + font — run `npm test` immediately after the
   provider change.
4. #5 feedbackHtml compaction/dedupe (shared function — test all callers).
5. #2 post-feedback restructure (largest; depends on #5 living inside it).
6. #4 scroll-to-feedback (touches the submit/showRecord path from #2).
7. Full `npm test` + `npm run test:browser`; re-walk the browser flow.

No `CONTEXT.md` change (these are presentation, not domain language). An ADR for
"single completion action" is optional and not written unless requested.
