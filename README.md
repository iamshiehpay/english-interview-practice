# Adaptive English Interview Coach

Local practice for English interviews in Taiwan technology roles.

目前試行新版：[履歷與單題練習流程](docs/learner-flow-discussion.md)。可上傳 PDF／DOCX／TXT 或貼履歷文字，保存一份目前履歷；貼新 JD 時預設搭配，可取消勾選。產題時凍結選用履歷，替換不影響舊紀錄。PDF 文字擷取需 `pdftotext`（本機已安裝），DOCX 使用 macOS `textutil`；掃描型 PDF 未提供 OCR，可貼文字。

新流程：回答一次 → 具體回饋 → 自己再試／看英文示範／結束保存。中文想法整理與 AI 示範不算正式回答，也不覆寫原文。主要導覽為開始練習、紀錄、履歷；找職缺與舊版經驗確認管理移出主流程。

模型契約已升為 3.0.0，評估輸出寫入 `evaluation/v3`。原 v2 模型品質結果僅供歷史參考，不能當成 v3 的完整穩定度證據。以下舊版 API 說明中，evidence 與 reference 保留相容性，UI 已採用新流程。

Requires Node.js 22 or later. From this directory:

```sh
npm start
# Open http://127.0.0.1:4310
npm test
```

`npm start` reads `process.env` and **never reads a credentials file**. To keep speech credentials in a file instead of exporting them by hand, put them in `~/.config/interview-coach/speech.env` (mode 600) and run `npm run start:speech`, which sources that file into the server process and starts the server; override the path with `COACH_SPEECH_ENV`. The key stays in that process's environment and never reaches the browser, the workspace, test artifacts, Git or a log.

## Start and manually test optional follow-ups

The normal command above uses your existing local practice data in `.workspace/`. To try the interface without changing that data, start a separate workspace instead:

```sh
test_workspace=$(mktemp -d /tmp/interview-coach-followup.XXXXXX)
WORKSPACE_DIR="$test_workspace" PORT=4310 npm start
```

Keep that terminal open, then open <http://127.0.0.1:4310/>. To stop the test server, return to the terminal and press `Ctrl+C`. The temporary directory can then be deleted manually if wanted; it contains only synthetic test practice data.

Manual acceptance path with the default deterministic provider:

1. Paste a short synthetic JD and select **儲存職缺並產生題目**.
2. Select the recommended question, then **開始回答**. You may first open **不知道怎麼回答？**; its generated text is assistance and is not a formal answer.
3. Submit an English primary answer and wait for the Chinese feedback.
4. Select **讓面試官追問**. Confirm the follow-up has an English question and a Chinese meaning.
5. Submit an English follow-up answer. Before feedback finishes, neither the local follow-up controls nor the Focus Point area should offer an end action.
6. After Chinese feedback, select **繼續追問** or **結束並保存**. A second follow-up is the maximum; after its feedback, no third follow-up action appears.
7. Open **練習紀錄** and reopen the record. The primary answer versions and follow-up history should remain visible.

The default provider is a workflow demonstration: its questions and ratings are synthetic, not meaningful coaching. For automated coverage, run `npm test` and `npm run test:browser`; the latter uses an isolated temporary workspace. See [issue 0009 verification](docs/verification/optional-follow-ups-0009.md) for the exact checked behaviours and limits.

No installation, account or cloud credentials are needed for the deterministic demonstration provider. Its fixed ratings demonstrate the workflow and are not meaningful assessments. 繁中操作流程：貼上 JD → 產生練習題 → 推薦一題 → 開始回答 → 送出並取得回饋 → 修改回答 → 比較與保存。職缺會先保存；換一題與查看全部使用已保存題組，不會重新呼叫模型。首頁可繼續最近未完成練習，其他紀錄從練習紀錄開啟。

`GET /api/health` reports health. `WORKSPACE_DIR` overrides the default `.workspace` directory; `PORT` defaults to 4310. Run one application process per workspace. The server binds only to loopback. Personal data lives in `.workspace/workspace.json`, written atomically; keep this directory out of source control.

The HTTP API is the application seam. `POST /api/snapshots` captures `{text}`. `POST /api/snapshots/:id/analysis` generates validated evidence. `POST /api/records` selects `{snapshotId,questionId}`. Records accept `/attempts` with `{transcript}`, `/feedback`, and `/complete` with `{focusPoint}`; GET `/comparison` compares evidence. GET `/reference` is locked until both attempts have feedback. Attempts are saved before inference, so failures can be retried without losing the transcript. Snapshots have no update operation.

文字草稿：`POST /api/records/:id/draft` accepts `{transcript, attemptIndex}` (0 for first answer, 1 for revision), including an empty string. The saved `writtenDraft` is separate from submitted attempts and voice `transcriptDraft`; stale attempt indexes are rejected. The UI saves drafts to the local workspace and only reports success after the write completes. Only the last successful save is guaranteed after a forced browser exit. `/attempts` accepts a stable `{submissionId, attemptIndex, transcript}` to replay a saved submission without duplication; reusing the ID with different content is rejected. Submit saves the answer before requesting feedback; retry feedback without creating another attempt. Deleting records, snapshots or all workspace data also removes their written drafts.

新模型輸出提供題目中文題意與中英回饋，共用評分及原文引文。舊單語紀錄保留原文，不以占位文字冒充翻譯，也不自動重新評分。

Language providers implement `analyze({snapshot})` and `feedback({question,transcript})` and are injected into `createApplication`. Outputs pass structural and exact-source-citation validation before entering local state. The demonstration provider is intentionally limited; subsequent issues add external provider controls.


Question Sets start with 8–12 questions across role fit, experience depth, behavioral judgment and technical communication. GET `/api/snapshots/:id/analysis` returns evidence, per-question practice history and a coverage-based recommendation; any question remains selectable. POST `/api/snapshots/:id/questions` appends up to four questions atomically (40-question workspace limit per snapshot). Duplicate normalized text/IDs, unsupported posting facts, missing citations and broken capability links are rejected. Generated inferences and questions remain visibly subject to learner review: citation presence cannot establish semantic truth. All questions support conceptual, hypothetical, transferable and honest learning-plan answers without score penalties for missing experience.


Voice practice is offered with every speech provider; the deterministic demonstration provider says in the panel that it returns a fixed sample and does not really transcribe, rather than hiding the feature. Configure `COACH_SPEECH_PROVIDER=openai` for real transcription. Record, then review and edit the transcript in the normal answer box before submitting it for feedback — one click submits it as it stands. A recording runs for at most three minutes, shows its elapsed time, warns as the limit approaches, and at the limit stops itself and transcribes everything captured so far. The three-minute budget, the browser byte check and the server-side limit all derive from the constants in `src/speech.js` (`RECORDING_LIMIT_SECONDS`, `RECORDING_MAX_BYTES`), which `GET /api/providers` reports to the browser so the two sides cannot drift; `test/recording-limits.test.js` asserts the budget holds a full-length answer at a generous bitrate. A failed transcription writes neither a file nor a reference.

Per [ADR 0019](docs/adr/0019-retain-local-answer-recordings-for-playback.md), the recording of a **submitted** spoken answer is retained locally as an Answer Recording. Recordings are files under `<workspace>/recordings/`, never base64 in `workspace.json`; the database holds only `{id, mimeType, bytes, capturedAt, recordId, state, attemptId}`. Transcribing registers a `pending` recording, submitting the draft promotes it to `retained` and attaches it to that attempt (with `transcriptEdited` when the learner changed the text), and anything superseded, abandoned, stranded by completion or deleted goes with its owner. Files are unlinked only after the transaction dropping their reference commits, so a crash can leave an unreferenced file — swept at startup along with every `pending` recording — but never a reference without a file. `GET /api/recordings/:id` streams one retained recording with `Cache-Control: no-store` under the same local-host and origin rules as the rest of the API. Nothing is ever uploaded: the only outbound audio remains the transcription request.

Speech providers implement `transcribe({audioPath,mimeType}) -> {transcript}` and are injected into `createApplication({speechProvider})`. `POST /api/records/:id/transcription` accepts `{audio: base64, mimeType}` and returns a persisted transcript draft, without creating an attempt. Confirm with `/attempts` using the reviewed/edited `{transcript, transcriptDraftId}`. The exact edited text becomes the coaching artifact. No pronunciation, accent, emotion or personality scoring is performed.

Every path that accepts an Answer Attempt accepts a spoken one: the primary answer, the same-question revision, each Follow-up Question (`POST /api/records/:id/follow-ups/:followUpId/transcription`, tracked as the `follow-up-transcription` operation) and the fresh question of a Focus Point Continuation. Each transcript draft and Answer Recording belongs to the answer it was made for, so a follow-up recording never lands on the primary attempt.

Reading aloud is optional: a speech provider may additionally implement `speak({text,speed}) -> {audio: Buffer, mimeType}` (OpenAI `gpt-4o-mini-tts` by default, overridable with `COACH_TTS_MODEL` and `COACH_TTS_VOICE`). `GET /api/providers` reports `speech.canSpeak`, and the browser hides the control when it is false. `POST /api/speech` takes a **reference** to stored content — `{snapshotId,questionId}`, `{recordId}`, `{recordId,followUpId}`, `{recordId,coachingId}` for an Illustrative Answer, or `{recordId,attemptId,correctionIndex}` for a Key-Sentence Correction rewrite — plus an optional `speed` of `slow|normal|fast`, and returns `{audio: base64, mimeType, speed}`. Free text is refused: the server resolves the English string from its own stored data, which is what keeps Traditional Chinese fields from ever being sent to the read-aloud service. Audio is never persisted, nothing plays without a learner action, concurrent readings are bounded, and the demonstration provider returns a labelled tone rather than pretending to speak.

Job discovery: expand **Find jobs with your search profile**, edit the six comma-separated preference fields, save, and choose **Discover jobs**. Terms are case-insensitive substrings; roles match titles, locations match location text, seniority/arrangements match posting text. Each nonempty group is required (OR within a group, AND across groups). Exclusions always remove results; priorities only rank results. Unknown/missing wording may exclude a relevant job, so inspect results and adjust terms. The empty profile returns unfiltered results. Selection uses the server-captured posting, not browser-supplied text, and repeated selection of the same result is idempotent.

The default source is synthetic demonstration data. For a real public Greenhouse board:

```sh
GREENHOUSE_BOARD=your_public_board_token npm start
```

Only the configured board is accessed. Search performs one GET, at most 100 source jobs and 30 matches, a 10-second timeout and a 4 MB response limit. No retries occur automatically. Supported URL intake accepts `https://job-boards.greenhouse.io/<board>/jobs/<numeric-id>` or `https://boards.greenhouse.io/<board>/jobs/<numeric-id>`. Other URLs use the paste fallback. No credentials, applications or external writes are involved. See [Greenhouse's official Job Board API](https://docs.greenhouse.io/job-board.html).

`GET/POST /api/job-search-profile` reads/replaces `{roles,locations,seniority,workArrangements,priorities,exclusions}` arrays. `POST /api/discovery` stores a bounded captured run; `POST /api/discovery/:id/select` with `{resultId}` creates a snapshot without fetching again. `POST /api/snapshots/from-url` accepts `{url}` for the configured source. Snapshot reads/analysis never refresh the live posting.

Only the three most recent discovery runs are retained; previously selected snapshots remain independent and immutable. A result from an expired run must be discovered again. Rate-limit errors permit explicit learner retry but never retry automatically.

Candidate Evidence is optional. Expand **Optional candidate evidence** and paste plain text, one statement per line (up to100 lines/100,000 characters). Imports append a new source and unverified claims; no approval is transferred from an earlier import. Inspect the source, select the relevant capability checkboxes and explicitly confirm or reject each statement. Links include the Job Snapshot and capability, so identically numbered capabilities from different jobs cannot be confused. Claim wording stays verbatim and cannot be rewritten through the approval endpoint.

Practice automatically surfaces possible first-person factual statements for review; this conservative detector is not a complete claim extractor or a truth checker. Unlisted claims are unverified, never labelled false. Hypothetical framing is not reused as personal history. Only approved, question-linked excerpts enter feedback context; raw resumes, rejected/unverified claims and unrelated evidence do not. Approved evidence appears beside the practice question and may guide suggestions, without changing Question Set coverage or lowering gap ratings. A gap means no approved evidence is linked, not lack of ability. The four honest answer frames remain available.

`POST /api/evidence/import` accepts `{text}`; `GET /api/evidence` returns sources/claims. `POST /api/evidence/:id` accepts `{status: "approved"|"rejected", capabilityLinks:[{snapshotId,capabilityId}]}`. Rejection clears links; a later explicit confirmation may approve it again. GET `/api/records/:id/evidence-context` returns approved excerpts and gaps for that question. Imported text and reviewed evidence persist locally.

Evidence bounds: at most20 imported sources and1,000 candidate statements; each excerpt is at most2,000 characters. Feedback receives at most10 relevant approved excerpts (20,000 characters maximum). Statements beyond the automatic detector's bounds are not extracted; they are never treated as false. Import capacity errors leave prior data intact. The original text stays local; only approved excerpts linked to the current question may be sent to a configured language provider.

Progress: each completed Practice Loop has one immutable primary Focus Point. Exact normalized wording (Unicode normalization, case, punctuation and whitespace) groups patterns; synonyms are never merged automatically. One completed record is a one-off. Two distinct completed records promote a Recurring Weakness, or you can explicitly confirm one earlier. Rejecting a pattern suppresses automatic promotion until you explicitly confirm it again. Active/improving/resolved status and confirmation history persist. Inspect the supporting Practice Loops before changing status; recommendations consider unresolved Focus Points, while manual selection is always available.

`GET /api/progress` returns evidence-backed patterns; `POST /api/progress/:id` accepts `{action:"confirm"|"reject"}` or `{action:"status",status:"active"|"improving"|"resolved"}`. `DELETE /api/records/:id` removes the record and answer-derived Candidate Evidence, then repairs progress atomically. Auto-promoted patterns demote if fewer than two records survive; explicit confirmations may remain with surviving evidence. No-evidence patterns disappear. Resume-derived evidence is preserved.

In **Focus Points and progress**, type the exact phrase `DELETE ALL LOCAL DATA` to enable the explicit deletion request. `POST /api/workspace/delete` with `{confirmation:"DELETE ALL LOCAL DATA"}` removes snapshots, analyses, records, profiles, discovery runs, evidence and progress; it also clears temporary audio. The local app remains usable after deletion. Provider credentials are not stored in this data file.

Provider configuration (optional): default startup uses deterministic local language/speech providers and synthetic jobs. To use your own OpenAI account, set `OPENAI_API_KEY` in your shell or secret manager, then enable either adapter:

```sh
COACH_LANGUAGE_PROVIDER=openai COACH_SPEECH_PROVIDER=openai npm start
```

`COACH_MODEL` defaults to `gpt-4.1-mini`; `COACH_SPEECH_MODEL` defaults to `gpt-4o-mini-transcribe`. Selecting OpenAI without a key fails explicitly. Keys remain in process environment/private adapter fields, are never saved in workspace data, and are never entered in the UI. External calls may incur provider charges; no live calls run in the default test suite. Model JSON mode is followed by strict local schema/citation checks; semantic coaching quality requires the evaluation/real-use gate. Reference: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [file transcription](https://developers.openai.com/api/docs/guides/speech-to-text).

To use an Anthropic Claude account instead, set `ANTHROPIC_API_KEY` and select the Claude adapter:

```sh
COACH_LANGUAGE_PROVIDER=claude npm start
```

`COACH_CLAUDE_MODEL` defaults to `claude-sonnet-5` and `COACH_CLAUDE_EFFORT` to `high`; use `claude-opus-5` for maximum quality or `claude-haiku-4-5` for the lowest cost. Haiku does not accept an effort setting, so pair it with `COACH_CLAUDE_EFFORT=` (empty) to omit it. Selecting Claude without a key fails explicitly. The Claude adapter calls the Anthropic [Messages API](https://docs.anthropic.com/en/api/messages) directly (no SDK dependency), returns a single JSON object, and passes the same strict local schema/citation checks as the OpenAI adapter. The language operation timeout is raised to 90 s for this provider (180 s for Codex) to allow for reasoning. Speech is unaffected — configure it separately. Keys stay in the process environment, never in workspace data or the UI.

**Providers and data leaving this machine** shows each active provider and outbound categories before use. Model analysis sends JD text; additions send the JD and existing question/capability set; feedback sends only the current question/transcript and at most10 relevant approved excerpts. Speech sends audio only. Greenhouse filtering stays local. Provider retention policies remain external to this local app; `store:false` is set for model calls.

Operations persist metadata only and show pending/succeeded/failed/cancelled states. Cancel a pending operation in the interface; retry from its original action. `COACH_TIMEOUT_MS` defaults to30000 (10–120000 allowed). All operations have finite timeouts; no automatic paid retries occur. API clients should retain an `X-Request-Id` (8–100 alphanumeric/underscore/hyphen characters) across retries. The UI does this in memory: identical pending requests conflict, failed/cancelled requests can retry, and successful receipts replay existing artifacts rather than duplicating them. On restart, interrupted operations become failed/retryable. At most100 detailed operation records are retained. Compact success receipts persist until local data deletion, so old successful request IDs cannot silently repeat side effects. Expired discovery results return a conflict instead of being searched again. At mostfour operations may be pending concurrently. Operations contain no prompts, transcripts, resumes, audio or credentials.

`GET /api/operations` lists status metadata; `POST /api/operations/:id/cancel` cancels. `GET /api/providers` provides safe disclosure. `DELETE /api/snapshots/:id` cancels related work, removes its analysis and Practice Records, removes answer-derived evidence/progress, and clears resume capability links while retaining resume sources. Cancellation is checked again during the same transaction that commits output and marks the operation successful, so late results cannot restore deleted state.

Browser smoke prerequisite: install the `agent-browser` CLI and its supported Chrome browser, then run:

```sh
npm run test:browser
```

The smoke starts an isolated local server and temporary workspace, uses a real browser with DOM click events to complete the text Practice Loop, reloads and reopens the saved record, then cleans up browser/server/data even on failure. It requires no microphone, provider credentials or external API. `npm test` remains the dependency-free API regression suite.

## Evaluation and portfolio

Run `npm run evaluate` for the isolated, versioned five-JD/twenty-answer regression (three repeats). `npm run evaluate:release` additionally enforces pending release gates. Default fake ratings do not measure live coaching quality.

See the [evaluation workflow](evaluation/README.md), [current summary](docs/portfolio/evaluation-summary.md), [architecture](docs/portfolio/architecture.md), [known limitations](docs/portfolio/limitations.md), [synthetic before/after](docs/portfolio/before-after.md), and [2:30 demo script](docs/portfolio/demo.md). Human labels and creator real-use evidence remain required; the portfolio is not yet an accepted MVP release.

## ChatGPT subscription text coaching (experimental)

The optional Codex provider uses official ChatGPT sign-in, independently of the direct OpenAI API adapter. It supports analysis, additional questions and transcript feedback. Speech remains separately configured; start with text answers. Subscription access and usage limits depend on your account; it is not unlimited or an API-credit substitute. See official [authentication](https://learn.chatgpt.com/docs/auth) and [App Server](https://learn.chatgpt.com/docs/app-server) documentation.

Requires macOS and the reviewed **Codex CLI0.154.0 Apple Silicon binary** (SHA256 pinned by the adapter). The default executable is `~/.local/bin/codex`; login and inference use its verified absolute target. In this project directory:

```sh
npm run codex:login
npm run codex:status
npm run codex:verify
npm run start:codex
```

Complete the browser's official login yourself. Codex stores OAuth credentials as a **plaintext owner-only (0600) `auth.json`** in the dedicated0700 `.coach-codex` directory. This directory is ignored by Git and separate from `.workspace` practice data. Keyring storage was tested but could not be accessed inside the additional macOS sandbox; the official file login avoids granting access to the broader keychain. The app does not read or copy tokens, use your normal Codex profile, or accept a ChatGPT token as an API key. Set `COACH_CODEX_HOME` to a dedicated absolute directory named `.coach-codex` if desired; never point it at your normal Codex home. `COACH_CODEX_BIN` selects the installed executable; `COACH_CODEX_MODEL` defaults to `gpt-5.6-luna` and must be available to your account; `COACH_CODEX_EFFORT` sets the reasoning effort (default `xhigh`). Changing the model requires re-running `npm run codex:verify`. There is no silent model/provider fallback. Status exposes only login readiness, never account identity. The UI's provider panel has a **檢查登入狀態** button.

Every request starts a separate process and ephemeral thread in an empty temporary directory. The integration pins the CLI, checks effective feature settings, disables known shell/code/browser/app/plugin/MCP-related surfaces where supported, excludes inherited API tokens and host configuration environment variables, verifies empty instruction sources and workspace roots, and rejects unexpected tool/approval events. It uses read-only/no-network turn sandboxing and structured output followed by the same source/quote validators. Codex0.154 reports `unified_exec=true` even when disabled; this is not credited as a disabled tool. An additional macOS sandbox denies child-process creation/other executable launches and file contents outside the exact binary, dedicated profile, disposable runtime, system library/configuration paths and two exact Apple encoding/keychain-preference files. It allows reading the root directory itself for the loader, not root descendants. Positive/negative OS probes run before every App Server/model/status session. Version/features checks and the explicit official login run outside this extra sandbox and receive no JD/transcript. The OAuth file is readable by Codex itself, as necessary for authentication; the application never reads it. These version-specific controls do not claim a universal future-proof tool registry. A synthetic live isolation/retention check must pass before private creator transcripts are used.

Codex may write full submitted text to a private (0700) per-request temporary SQLite/log directory. This local temporary retention is explicitly accepted by the creator. Cleanup removes the directory after process termination and verifies removal; a later request scavenges inactive crash leftovers before sending input. A still-running orphan or unverifiable ownership blocks reuse rather than risking deletion of active files. A filesystem cleanup error blocks that result and can require a server restart/manual recovery before leftovers are retried; a still-live parent is conservatively preserved. A hard crash can leave plaintext files until that cleanup, and deletion is not forensic erasure. Histories are disabled; ephemeral responses must have no rollout path. Credentials remain in the separate `.coach-codex/auth.json` after deleting practice data; remove that dedicated profile when retiring this integration. Logs and protocol payloads are not written by the adapter. Cancellation requests interrupt/delete, then terminates the process with a bounded forced-kill fallback. It cannot retract data already sent or restore subscription quota already consumed.

The synthetic `codex:verify` command consumes one subscription request, checks a prompt-injection canary and persistent-profile retention and temporary-directory deletion, then records a source/model-bound readiness marker. Missing/stale verification blocks coaching before model input. Each real coaching request also includes an opaque retention marker and rejects observed retention in the persistent profile before accepting its output; runtime cleanup runs on success and failure. This observed canary check supplements OS enforcement rather than proving all possible prompt behavior.

Synthetic subscription analysis, a two-answer Practice Loop, and real turn cancellation have passed; see [subscription verification](docs/verification/codex-provider.md) for actual tested versus pending evidence. The original fake-provider demo and offline tests do not require Codex or login.

Creator text validation: [五次文字練習步驟](docs/creator-text-validation.zh-TW.md). Historical monolingual subscription regression: [live evaluation report](docs/portfolio/codex-evaluation-summary.md),60/60 automatic cases and98.75% rating stability. This is not evidence for the new bilingual contract; see [redesign verification](docs/verification/ui-redesign.md). Human labels and creator practice remain separate pending gates.

### Short Mock Session

A Short Mock Session is three Job-grounded Interview Questions from one Job Snapshot, answered in a row with no feedback or coaching in between and assessed once at the end. Sessions live in their own `mockSessions` collection, not as three Practice Records, so the Practice Loop keeps its invariants (feedback after every attempt, completion requires a Focus Point, at most two attempts) and existing records are never touched. `POST /api/mock-sessions {snapshotId}` draws one question from each of three different Question Categories, preferring unpractised ones, with no model call; `/answer`, `/skip` and `/entries/:entryId/transcription` advance it, and `/summary` produces the Session Summary — exactly one overall strength and one overall priority improvement, each quoting a session answer verbatim, rejected as invalid provider output otherwise. An all-skipped session completes with an explicit nothing-to-assess state and no model call. `/entries/:entryId/feedback|corrections|coaching` are refused while a session runs and use the existing validated contracts once it has finished. A session never produces a Focus Point and contributes nothing to the progress view.

### Curated job discovery

`POST /api/discovery/interpret {request}` turns the learner's own sentence into a proposed Job Search Profile — every field the learner did not state comes back empty, never guessed — and the proposal is shown for confirmation; only a `POST /api/job-search-profile` write saves it. The profile has seven list fields (`roles, locations, seniority, workArrangements, priorities, exclusions, salary`); a profile written before `salary` existed still validates.

`POST /api/discovery` queries every configured source (`GREENHOUSE_BOARDS` takes a comma-separated list; a single `GREENHOUSE_BOARD` still works), reports per-source status so one outage does not void the run, and de-duplicates on canonical URL and on employer-plus-title. Filtering against the profile happens entirely locally — **the Practice Resume never reaches a job board** — and each surviving candidate is tagged `taiwan`, `taiwan-remote`, `remote` or `unknown` from its own text. Up to twelve survivors, each trimmed to a bounded excerpt, plus the resume then go to the language model, which returns **at most five** entries, each with a Traditional Chinese rationale and a four-part Fit Breakdown (matched / transferable / gaps / unknown). Validation rejects an unsupplied candidate id, a duplicate, more than five entries, a non-Chinese rationale, an over-long list, and any number that appears in neither the posting excerpt nor the resume. Fewer than five is correct; padding is refused, and no fit score is produced. With no qualifying result the run names the conditions that removed the most candidates and offers one-click relaxations, with no model call. Selecting a result creates a Job Snapshot carrying the source, URL and retrieval time, honours the resume choice and question depth, and reuses the snapshot on a second selection.

Shipping sources are Greenhouse boards plus the deterministic demonstration source. 104 was investigated and is **not** shipped: it is reachable only through developer-side agent tooling, not from the local server, and offers no credential-free contract this application can depend on.
