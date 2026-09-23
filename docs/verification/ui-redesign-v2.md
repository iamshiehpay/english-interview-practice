# Workbench UI redesign verification — issues 0022–0028

Date: 2026-09-24. Implemented and automatically verified by agents; visual and
hands-on acceptance by the creator is still pending, so every issue in this
round is `awaiting-human-validation`. This supersedes the screen evidence in
[`ui-redesign.md`](./ui-redesign.md) (2026-09-18, the pre-redesign layout),
which is kept as history. PRD: [`prd-ui-redesign.md`](../prd-ui-redesign.md);
direction: [`ui-direction-discussion.md`](../ui-direction-discussion.md).

## What landed

| Issue | What changed | Screenshots |
|---|---|---|
| [0022](../issues/0022-design-tokens-and-app-shell.md) | Workbench tokens, self-hosted Inter / JetBrains Mono (CSP unchanged), left rail + sticky top bar with breadcrumb and service status, 我的進步 in the rail; icon rail at 1024–1279px, drawer below 1024px | [`ui-redesign-0022/`](./ui-redesign-0022/) |
| [0023](../issues/0023-practice-workbench-two-pane-and-mobile-tabs.md) | Practice as a two-pane workbench (question + answer left, feedback pane right with a sticky footer holding 結束並保存); below 1024px 你的回答／回饋 tabs and a docked footer | [`ui-redesign-0023/`](./ui-redesign-0023/) |
| [0024](../issues/0024-annotated-feedback.md) | Annotated feedback: the answer shown once as numbered sentences, every quote marked on it (優／改／切據構英／±), notes linked both ways, inline correction diffs; `public/annotate.js` | [`ui-redesign-0024/`](./ui-redesign-0024/) |
| [0025](../issues/0025-home-redesign.md) | Home hero, four-step flow strip, inert 範例 feedback preview beside the JD form | [`ui-redesign-0025/`](./ui-redesign-0025/) |
| [0026](../issues/0026-remaining-views.md) | 題目集, 練習紀錄 (truncated job titles), 我的進步 from `/api/progress`, 我的履歷, 找職缺, 設定 and the operations strip on the tokens | [`ui-redesign-0026/`](./ui-redesign-0026/) |
| [0027](../issues/0027-mock-session-dark-room.md) | Short Mock Session in a dark room scoped to `.room` (theme-color switches and reverts), one record control, waveform from the measured input level, dark Session Summary linked to the answers | [`ui-redesign-0027/`](./ui-redesign-0027/) |
| [0028](../issues/0028-verification-and-runbook-sync.md) | Final sweep: two fixes, smoke additions, learner-flow re-baseline, a real-model pass, runbook sync, legacy token aliases removed | [`ui-redesign-0028/`](./ui-redesign-0028/), [`learner-flow/`](./learner-flow/) |

## Issue 0028 changes

- **Tags never split a word.** A quote can stop inside a word (the fake Session
  Summary quotes "…I would aim to l" of "learn"; see the 0027
  `03-summary-linked-1440.png`, where up to eight tags sat between "l" and
  "earn"). The highlight still covers exactly the quote's characters; the tags
  now go after the end of the word containing the quote's last character
  (letters, digits and an apostrophe between letters count as the word;
  whitespace and other punctuation end it; Han/kana are not pushed along) and
  stay on one line with that word and any punctuation after it. More than three
  tags at one spot collapse to the first two plus a `+N` chip; the group's
  accessible name and tooltip list every note (e.g. 「8 則回饋：優 本次做得好的地方、改
  這次優先改進、切 切題程度、…」). Rule: `tagPosition()` / `collapseTags()` in
  `public/annotate.js`; four new tests in `test/annotate.test.js` (mid-word end,
  many tags at one spot, quote ending at punctuation and at the end of the
  text). Rating tags outside a mark are shown through the linked state of their
  `.tags` group. The transcript's text (copy, `textContent` of its sentences)
  is unchanged. After the fix, [`01-mid-word-tags-1440.png`](./ui-redesign-0028/01-mid-word-tags-1440.png)
  shows the same summary as `learn` 優 改 +6.
- **顯示題目 keeps focus.** Revealing the question used to `blur()` the reveal
  button, dropping focus to `body`. Focus now moves to the revealed question
  heading (`tabindex="-1"`). Checked on the question screen, the practice
  screen and the mock room; the smoke asserts it on the question screen.
- **Browser smoke additions.** Home is light (no `.room`, no `room-mode`,
  theme-color `#FAFAFA`); in the mock session `.room` exists only inside
  `#mock-view` with `color-scheme: dark` and a switched theme-color; after
  leaving it theme-color is back to `#FAFAFA`, `room-mode` is gone and 練習紀錄 is
  not dark; `#mock-record` is named 開始錄音 and renamed 停止並轉成文字 on
  start; 我的進步 opens from the rail (breadcrumb + `aria-current`) and its four
  counts (需加強／改善中／已解決／單次重點) add up to `/api/progress`; no horizontal
  overflow at 390px on home, in the mock room, and (already) on practice and
  練習紀錄; a job renamed to a 98-character title shows at most 60 characters +
  「…」 on its 練習紀錄 card with the full title as the tooltip; listening mode in
  the room hides the question on play and 顯示題目 reveals and focuses it. The
  home preview check (inert, labelled 範例) is kept.
- **Screenshot re-baseline.** Full-page captures of a sticky shell clipped the
  feedback pane (it scrolls inside itself). For the capture only, the smoke
  adopts a constructed stylesheet (an injected `<style>` is blocked by the CSP)
  that lays the rail, top bar, tabs, feedback pane and footer out statically,
  and removes it straight after; no assertion runs against it. The
  [`learner-flow/`](./learner-flow/) PNGs (home, feedback, mobile, and a new
  mock-room shot) are the deliberate re-baseline of this round.
- **Legacy tokens removed.** No `--ink`, `--paper`, `--mist`, `--teal`,
  `--coral`, `--yellow` (or `--sky`, `--line`, `--mint`, `--shadow`) remains in
  `public/`; each use names the token it aliased. The re-run smoke produced
  byte-identical screenshots.
- **Runbook.** [`creator-validation.zh-TW.md`](../creator-validation.zh-TW.md)
  walked against the fake-provider UI and re-worded where it described the old
  layout (see the 0028 issue comment). The 我的進步 step works from the rail with
  no workaround.

## Real-model pass (issue 0028)

Codex (`gpt-5.6-luna`, Fast) on an isolated temporary workspace, fake speech,
three Codex operations in total (analysis, feedback on its first attempt,
corrections). JD 02 (六度科技 AI Engineer, first header line omitted); question
generation took about 2 min 45 s. One typed role-fit answer (156 words, with
"our operation team spend" and "I build" as slips).

- All eight quotes (strength, priority, four ratings, two corrections) were
  found verbatim and linked (eight 「↳ 第 N 句」 controls, no unlinked quote
  shown, so no `console.warn`). None ended mid-word; tags sat after the quote's
  last character (e.g. `emails.` 英 ±). Several ratings quoted whole
  sentences, two of them the same three-sentence span.
- The sentences' text equals the stored transcript exactly; no horizontal
  overflow at 390px; the 回饋 tab reads 「回饋（8 則）」.
- Screenshots: [`02-codex-feedback-1440.png`](./ui-redesign-0028/02-codex-feedback-1440.png),
  [`03-codex-linked-rating-1440.png`](./ui-redesign-0028/03-codex-linked-rating-1440.png)
  (a focused rating mark and its note), [`04-codex-answer-390.png`](./ui-redesign-0028/04-codex-answer-390.png),
  [`05-codex-feedback-390.png`](./ui-redesign-0028/05-codex-feedback-390.png).

## Results

`npm test` **191/191** pass; `npm run test:browser` **PASS**.

## Known limits

- Not accepted by the creator yet; visual acceptance of 0022–0028 is pending.
- The mock-room waveform with a real microphone is unverified (headless audio
  reports level 0), as is real read-aloud playback.
- Only Chromium (agent-browser) was used; Safari and Firefox are untested,
  including `100dvh` and `backdrop-filter`.
- The real-model pass covered one text answer; follow-ups, a revision, the mock
  session and voice with a real speech provider ran only on fake providers.
- The job title comes from the JD's first line; with the runbook's "skip the
  header" instruction JD 02's title shows as 「[Job Overview]」 until renamed.
- During the real-model run the page was found on home with an empty JD after
  generation finished (the analysis itself succeeded and the job opened from
  練習紀錄 without another model call). It coincided with an agent-browser
  daemon error on a long-running script, so it is most likely the tool
  reloading the page; not reproduced.
