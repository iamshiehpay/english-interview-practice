# Goal：以 $implement 實作 issue 0029–0036，每張實作後獨立驗證，loop 到全部完成

建立日期：2026-09-24。給 Codex（codex-cli 0.155.1）使用；subagent 對應 `~/.codex/agents/` 的自訂角色。

## 背景
- 本輪 PRD：`docs/prd-v1-readiness.md`；issue：`docs/issues/0029`–`0036`；索引：`docs/issues/README.md`。
- v1.0.0 是 **AI-validated release**（見 `docs/next-steps-discussion.md` 最後一條決策）：沒有任何「本人」關卡。persona 練習和標註都由 AI 完成，而且一律誠實標成 AI，**絕不用使用者的名義簽署或核准**。
- 使用者已**事先授權** 0035 的 Codex 評估：只跑一次，約 65 次訂閱呼叫。失敗時記錄原因，不得自動重跑。
- 全程不需要問使用者。只有遇到下方「停止條件」才停下並回報。

## 開始前（交給 subagent 讀，主 agent 只收摘要）
- 用 `repo-scout` 讀 PRD、8 張 issue、`AGENTS.md`、`CONTEXT.md`、`docs/agents/issue-tracker.md`，以及 `docs/next-steps-discussion.md` 的作業規則，回傳摘要。
- 主 agent 只負責協調：排程、派工、判斷驗證結果、更新 issue 狀態、commit。**不直接寫功能程式碼**。回報用繁體中文。

## Subagent 對應（~/.codex/agents）

| 用途 | agent | 模型 |
|---|---|---|
| 協調 | 主 session | `gpt-5.6-terra`（預設） |
| 前端實作（`public/`） | `frontend-developer` | `gpt-5.6-sol` high |
| 後端／評估程式實作（`src/`、`evaluation/`） | `backend-developer` | `gpt-5.6-sol` high |
| 跑測試、browser smoke、收集驗證證據 | `test-automator` | `gpt-5.6-terra` medium |
| `$code-review`、語意審查、標註核准 | `reviewer` | `gpt-5.6-sol` high（read-only） |
| 找檔、讀檔 | `repo-scout` | `gpt-5.6-luna` low |
| 改之前先摸清程式路徑 | `code-mapper` | `gpt-5.6-terra` medium |
| 修正兩輪仍失敗時找根因 | `debugger` | `gpt-5.6-sol` high |

- 任務分派：
  - `frontend-developer`：0029、0031 的 UI 部分、0032。
  - `backend-developer`：0031 的 server 部分、0033、0035 步驟 1、0036 的 label check。
- persona 類工作（0034 的 persona 練習、0036 的評分者 persona 起草）：先寫 persona 卡再開工。起草的人和核准的人必須是**不同的 agent**。
- 同時最多 3 個 subagent 在跑。**0029、0031、0032 都會改 `public/app.js` 和 `test/browser-smoke.js`，必須依序做**，不能平行。

## 排程
- 軌道 A（依序）：0029 → 0031 → 0032 → 0034
- 軌道 B（和 A 平行）：0033（0034 也要等它完成）
- 軌道 C（和 A 平行）：0030 → 0035 → 0036
- 每張 issue 開工前，先確認它的 Blocked by 都已經 `completed`。

## 每張 issue 的 loop
1. **實作**：派對應的 developer agent，brief 只放 PRD 和**該張 issue 全文**，以及下方的硬性規則。
   - 要求它用 `$implement`：能用 `$tdd` 就用，seam 依 PRD 的 Testing Decisions；過程中跑單一測試檔，最後跑完整 `npm test`。UI 相關的另外跑 `node --check public/app.js` 和 `npm run test:browser`。
   - **先不要 commit**。回報內容：改了哪些檔、新增哪些測試、每條 acceptance criterion 的證據。
2. **驗證**：派 `test-automator` 獨立重跑所有驗證指令。
   - UI issue 要用 `$agent-browser`，在自己的 port 和暫存 `WORKSPACE_DIR` 實際操作畫面，包含 360px 寬度。
   - 逐條核對 acceptance criteria，每條都附可重現的證據（測試名稱、指令輸出、檔案與行號）。
   - 同時派 `reviewer` 跑 `$code-review`，基準點是這張 issue 開工前的 commit。
   - 兩者都 PASS，才算通過。
3. **修正**：任一方 FAIL，就把具體清單交回**同一個** developer agent 修正，再回到步驟 2。
   - 第 2 輪仍 FAIL，先派 `debugger` 找根因。
   - 第 3 輪仍 FAIL，這張 issue 標 `needs-info`，在 `## Comments` 寫清楚卡在哪裡，然後跳到其他不受影響的 issue。
4. **收尾**（由主 agent 做）：
   - acceptance criteria 打勾 `- [x]`，在 `## Comments` 追加：日期、驗證指令與結果摘要、已知限制、這一輪發現但不在範圍內的問題。
   - front matter 的 `status` 改成 `completed`，同步更新 `docs/issues/README.md` 的狀態欄。
   - 範圍外的問題另開新的 issue 檔（`docs/issues/0037-…` 起，狀態 `needs-triage`），不要順手修。
   - 每張 issue 一個 commit（規則見下方）。
5. 繼續下一張，直到 0029–0036 全部 `completed`，或只剩 `needs-info` 的 issue。

## 各 issue 的特別注意事項
- **0030**：實跑驗收要打到 **agent 自己開的測試 server**（另一個 port、暫存 `WORKSPACE_DIR`、JD 存到暫存資料夾），不能打 4310。skill 的 base URL 要能覆寫。
- **0033**：ledger 的每個欄位都要從 `.workspace/persona-qa-2026-09-23/workspace.json` 核對（**只讀**），不能照文件描述填。`creator`、`attestedBy`、`attestedAt` 保持 null。
- **0034**：在自己的 server 用真實的 Codex provider、fake speech，由 persona 用 `$agent-browser` 跑一次完整的常見題練習。只有**沒跑這次練習的** verifier 可以填 `attestedBy`／`attestedAt`，`creator` 永遠是 null。
- **0035**：先讓 `evaluation/review-report.js` 支援 v3，並補上測試；再跑**唯一一次** `npm run evaluate -- --codex --accept-subscription-usage`。
  - 語意審查由 `reviewer` 做，不能是跑評估的那個 agent。
  - 需要網路或 codex binary 權限時，照正常流程申請權限提升，不要繞過 sandbox。
- **0036**：
  - 起草由評分者 persona 做；核准由 `reviewer` 逐題進行，並標 `reviewerType: "ai"`。不可以批次核准，也不可以宣稱是人工標註。
  - 最後跑 `node evaluation/review-report.js`，這一步**不呼叫模型**。
  - 摘要中的發布狀態只能寫「AI-validated」，並列出 v1.0.0 之後待做的人工驗證。
  - **不要打 v1.0.0 tag**。

## 硬性規則（每個 subagent 的 brief 都要原文附上）
- 使用者的 app 跑在 127.0.0.1:4310：**不得停止、重啟或呼叫它**。禁止 `pkill`／`killall` 等以名稱比對結束程序。測試用自己的 port 和暫存 `WORKSPACE_DIR`，只用自己的 PID 停止。
- agent-browser 只關自己的 `--session`，不用 `close --all`。
- 除非 issue 明確要求只讀，否則不讀寫 `.workspace/`。不刪除或修改任何真實的履歷、職缺快照、練習紀錄。
- 修改任何 `src/codex-*.js` 後，必須執行 `npm run codex:verify`。
- 改了 `src/server.js` 的靜態檔白名單，要在最後的總結**提醒使用者重啟 4310**。
- 除非 issue 明確要求（0035），否則不改模型 contract、不呼叫付費或訂閱模型。
- 新功能必須有新測試，不能拿舊的 PASS 當驗收。測試失敗要照實回報輸出。

## Commit 規則（Codex 這邊沒有 hook，要自己遵守）
- Conventional Commits，格式 `type: Capitalized description`（type 為 feat｜fix｜refactor｜docs｜chore｜perf｜revert），首字大寫，結尾不加句點。
- **不加** Co-Authored-By 或任何 AI trailer。
- `git add` 和 `git commit` 分開執行，`git commit` 單獨一個指令。有內文時寫進暫存檔，再用 `git commit -F <檔案>`。
- 只 commit 到目前的 branch，不 push、不打 tag。

## 停止條件與最後回報
全部完成，或只剩 `needs-info` 的 issue 時停止，用繁體中文回報：
- 每張 issue 的狀態、commit hash、驗證證據摘要，以及用到的 agent 與模型
- 0035 的評估結果、四個關卡（automated／semantic／labels／creator）的狀態，以及發布狀態
- 需要使用者處理的事（例如重啟 4310），以及新開的 0037 之後的 issue
