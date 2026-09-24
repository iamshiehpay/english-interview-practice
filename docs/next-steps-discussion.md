# 下一批規劃：104、自我介紹、中文模式與 MVP 驗收門檻

日期：2026-09-24。狀態：已確認方向，尚未產生 PRD／issue；下一步在新 session 以 `/to-prd` → `/to-issues` 展開。

## 起點

- MVP release 仍標示 BLOCKED（`docs/portfolio/evaluation-v3-summary.md`）。
- 本 session（2026-09-22 → 2026-09-24）交付：
  - Codex provider 改用 `gpt-5.6-luna`、reasoning effort `xhigh`、預設 Fast 模式（`914c842`、`27a1190`），以及對應的逾時上限修正（`31badc4`）。
  - 回饋驗證失敗時自動重試一次，並回報欄位層級的診斷訊息（`8dee4b7`）。
  - 依操作類型設定獨立的生成時間預算，讓題目生成能容納一次驗證重試（`936a6df`）。
  - 工作台 UI 全面改版 issue 0022–0028，擁有者已於 2026-09-24 驗收通過（`25b10ef`，`docs/verification/ui-redesign-v2.md`）。
  - 創作者驗收 runbook（`docs/creator-validation.zh-TW.md`）。
  - AI persona 走查（`docs/verification/persona-walkthrough-2026-09-23.md`）。
  - 履歷共同出題的 AI persona 抽測（`074001b`，`docs/verification/resume-grounded-questions-2026-09-24.md`）：能上傳履歷；同一份 JD 有履歷時 12 題中 8 題明確引用履歷細節，無履歷時 0/12；未發現捏造；履歷缺口一律以假設性提問處理（「if you have not encountered this, how would you approach it?」），不預設學習者已具備該經驗。
- 其他已記錄但不在本文件範圍的規劃：`docs/devops-discussion.md`（雲端部署，排在 MVP 完成之後）、`docs/ui-direction-discussion.md`（改版已完成）。

## 已確認決策

使用者於 2026-09-24 確認，除非另行標註。

1. **104 職缺**：app 的「找職缺」只搜尋 Greenhouse 公開職缺板（`src/jobs.js`）。104 未支援的原因見 `docs/prd-curated-job-discovery.md` 約第 260 行：104 只能從開發者的 agent 工具（MCP）存取，本機 app 沒有免帳密的公開介面可用。決定：找職缺頁加一行說明「目前只搜尋 Greenhouse；104、LinkedIn、Cake 的職缺請直接貼上 JD」。不做 app 自行抓取 104 頁面（網站結構常變、使用條款很可能禁止自動化抓取）。不需要、也不應為此建立 email／帳號給 AI 使用：2026-09-23 用 job104 MCP 搜尋時未登入；把帳密放進 app 或對話違反 ADR 0013。

2. **新增專案 skill `/find-104-jobs`**（放 `.claude/skills/find-104-jobs/`，依 writing-great-skills 撰寫）：用 job104 MCP 搜尋 → 挑職缺 → 把 JD 存成帶乾淨標題行（「職稱 — 公司」）的檔案到 `.workspace/`（gitignored）→ 直接呼叫本機 app 的 `POST /api/snapshots` 建立職缺（只寫入職缺，不代替作答，不影響驗收規則；預設不產生題目，由使用者按「產生題目」）。第一次呼叫本機 4310 可能需要使用者允許權限。

3. **自我介紹**：步驟 1——每份職缺的題目集最前面由 app 固定加入「Tell me about yourself」（附中文題意），不由模型產生 → 不改模型契約、不需重跑評估（ADR 0014）；歸在 role-fit；回饋走現有流程。步驟 2（只對自我介紹允許依履歷追問，且追問引用履歷時必須逐字引用並驗證）延到 v1.0.0 之後，需新 ADR、契約 v3→v4、重跑評估。

4. **本輪不做**：履歷缺口提示（使用者於 2026-09-24 決定不加入）、「用範例職缺試試」按鈕、操作列的重試按鈕。

5. **中文面試模式**：使用者動機是「在台灣求職時，面試不見得都是英文」。決定做，但排在 v1.0.0 之後作為 v1.1。設計草案：每份職缺選「英文面試／中文面試」（預設依 JD 語言）；中文模式題目、作答、回饋皆中文；引文仍須是學習者原句逐字；允許中英夾雜（例如「我用 Redis 做 cache」）；「英文表達」改為「表達清晰度」；語音轉文字改中文、朗讀用中文聲音。需要：新 ADR（改變 ADR 0001 的產品範圍）、契約 v4、中文評估案例與人工標註。受影響點見 `src/domain.js`（`hasLatin` 檢查）、`src/model-contracts.js`（"natural English" 等字樣）、`src/cloud.js`／`src/speech.js`。

6. **MVP 驗收規則正式調整為「創作者 1 次真實練習 ＋ 4 次 AI persona 練習」**：寫新 ADR 0020（說明為何降低門檻與風險）；`docs/devops-discussion.md` 原本暫定的 ADR 0020 改為 0021（同步修改該文件，見下方「連帶修改」）；更新 `docs/MVP-ACCEPTANCE.md` 與 `evaluation/checks.js` 的 `creatorStatus`（至少 1 次真實，其餘 AI persona 須標 `synthetic: true` 並連結 `docs/verification/persona-walkthrough-2026-09-23.md`；現行 `creatorStatus` 要求全部 5 筆 `synthetic===false`，需放寬）；ledger（`evaluation/v3/creator-validation.json`，目前 `loops: []`）如實填寫；`creator`、`attestedAt` 仍由使用者本人確認後填寫。

7. **人工標註 20 個案例**（`evaluation/v3/human-labels.json`，5 份 JD × 4 題型，每案例填四項分數範圍、理由、引文、必須／禁止的回饋內容、雙語一致性）：由 AI subagent 先擬草稿，使用者逐一檢查、修改、核可；reviewer 是使用者本人；文件註明草稿經 AI 協助。雙語語意審查（60 份輸出）規則允許 AI 審查（`reviewerType: "ai"`，見 `evaluation/checks.js` 的 `semanticReviewStatus`），需先跑一次 Codex 評估（約 65 次訂閱呼叫：`npm run evaluate -- --codex --accept-subscription-usage`）。

8. **流程**：依 `/ask-matt` 的主流程——本 session 已遠超約 120k token 的 smart zone；記錄本文件 → 使用者執行 `/handoff` → 新 session 載入 handoff 檔 → `/to-prd` → `/to-issues` → 每個 issue 開新 session 用 `/implement`。

## 建議順序

| 順序 | 項目 | 大小 | 備註 |
|---|---|---|---|
| 1 | 找職缺頁 104 說明 | 極小 | |
| 2 | `/find-104-jobs` skill | 小 | |
| 3 | 自我介紹步驟 1 | 小 | |
| 4 | MVP 規則調整：ADR 0020 + `checks.js` + ledger | 小～中 | |
| 5 | 人工標註草稿 + 使用者核可 | 中 | 需使用者約 1 小時 |
| 6 | Codex 評估 + AI 語意審查 | 中 | 約 65 次訂閱呼叫 |
| — | 打 `v1.0.0`（見 `docs/devops-discussion.md` 版本決策） | | |
| 之後 | 中文面試模式 v1.1、自我介紹步驟 2、DevOps 部署（`docs/devops-discussion.md`） | | |

## 作業規則（本 session 學到的，給之後的 subagent）

- 使用者的 app 跑在 127.0.0.1:4310：subagent 不得停止它；禁止 `pkill`／`killall` 等以名稱比對的方式結束程序（2026-09-23 曾以 `pkill -f "node src/server.js"` 誤殺使用者的 server）；測試用自己的 port 與暫存 `WORKSPACE_DIR`，只用自己的 PID 停止。
- agent-browser 只關閉自己的 session，不用 `close --all`（2026-09-24 曾誤關其他 session）。
- 修改任何 `src/codex-*.js` 後須執行 `npm run codex:verify`，否則 Codex 呼叫回 428。
- 前端檔案由 4310 即時提供；改 `src/server.js` 的靜態檔白名單後需重啟 server 才生效。
- Commit 規則：Conventional Commits、首字大寫、無句點、無 AI trailer；`git commit` 單獨一個指令。

## 待討論問題

- 自我介紹固定題的英文措辭與中文題意、是否每份職缺都顯示、是否計入 8–12 題的數量。
- `/find-104-jobs` 的 JD 檔存放路徑（沿用 `.workspace/validation-jds/` 或另開 `.workspace/jds/`）與一次匯入幾筆。
- ADR 0020 中「AI persona 練習」的定義與最低要求（例如必須涵蓋 Experience Gap 與失敗恢復）。
