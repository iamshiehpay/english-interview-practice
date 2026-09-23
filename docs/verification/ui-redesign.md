> **Superseded (2026-09-24):** these screenshots show the pre-redesign layout. Current screen evidence for the workbench redesign is in [`ui-redesign-v2.md`](./ui-redesign-v2.md); this page is kept as history.

# 中文引導與單題文字練習改版驗證

日期：2026-09-18。狀態：本次改版實作、自動回歸、雙語語義審閱與驗收核對已完成。這不是 MVP 完成宣告；Issue 0008 人工標註與五次真人練習仍待完成。

## 實作與測試證據

| 範圍 | 證據 |
|---|---|
| 貼 JD → 保存 → 推薦一題 | `test/browser-smoke.js` 從空工作區走完整流程；不需要履歷或能力清單 |
| 繼續未完成練習、換題與查看全部 | 首頁按 updatedAt/createdAt 選最近未完成紀錄；瀏覽器驗證換題與回到原草稿，不新增 POST analysis/questions |
| 繁中引導與原文保留 | `public/app.js`、`public/index.html`；題意預設展開，JD/回答/引文原文保留，依據中的事實與推論可展開查看 |
| 雙語契約 | `test/bilingual.test.js`；fake、OpenAI、Codex 契約 v2.0.0，reason/reasonZh 與 text/textZh 共用 level/quote；新輸出缺欄位拒絕 |
| 文字草稿與初答／修訂分離 | `test/written-drafts.test.js`；record.writtenDraft 與 attempts、transcriptDraft 分開，重啟可讀，過期 attemptIndex 拒絕 |
| 保存失敗 | 真實 workspace 寫入故障測試保留最後成功內容；瀏覽器故障後重試及導航恢復驗證 |
| 保存後取回饋、取消與重試 | `test/operations.test.js`、`test/written-drafts.test.js`；submissionId 重送不新增回答；同 kind/target 不接受並行模型請求；操作狀態寫入失敗可恢復 |
| 背景回饋與新草稿 | 瀏覽器將舊題 feedback 延遲後回 503，切換新題輸入，驗證新題仍能 autosave、原回答仍只有一筆 |
| Experience Gap、參考表達及比較 | 四種誠實提示框架；參考 API 在兩次回饋前拒絕；瀏覽器驗證兩版回答、可修改 Focus Point 與完成保存 |
| 舊紀錄及刪除 | 舊單語紀錄原樣讀取且零模型重評；record/snapshot/全部刪除涵蓋草稿，晚到 provider 回應不能復活資料 |
| 手機／桌面、鍵盤及對比 | 390×844 瀏覽器 overflow 檢查；Enter 開啟練習與 details、作答焦點；桌面與手機截圖視覺檢視；焦點及一般文字改用符合對比要求的深色 |

`npm test`：**72/72 通過**。`npm run test:browser`：**PASS**，含草稿與回饋失敗恢復及背景請求不破壞新草稿。JavaScript 語法檢查通過。HTTP 測試需要允許本機 loopback 綁定；受限 sandbox 的 `listen EPERM` 不算功能結果。

畫面證據：[桌面首頁](ui-redesign/desktop.png)、[手機題目頁](ui-redesign/mobile.png)、[桌面雙欄比較](ui-redesign/compare.png)。主代理已檢視最終版本圖片（含「本機示範服務」標示），未見截斷或比較欄過窄。最後另將含已完成紀錄的列表標題更正為「所有練習」，使文字符合實際內容。截圖使用隔離暫存工作區及合成練習資料，不算真人練習證據。

## 實質模型驗證

- 新程式碼 `npm run codex:verify` 通過隔離設定、無工具事件、持久 profile canary 與暫存目錄清除檢查。
- `npm run evaluate -- --codex --accept-subscription-usage --refresh-analysis`：**5 次分析 + 60 次獨立回饋**，三輪相同輸入，**60/60 自動檢查通過；80/80 評分維度相差不超過一級（100%）**。
- [原始 v2 報告](../../evaluation/results/codex-v2.json)、[42 題 frozen analysis](../../evaluation/v2/codex-analysis.json)、[60 份雙語核對資料](../../evaluation/v2/codex-bilingual-audit.json)。原 v1 的 98.75% 結果保留，未拿來代替新契約證據。
- 模型執行後加入的操作互斥 guard 不改模型 prompt/schema/provider；[執行時 source hashes](ui-redesign/model-run-source.json) 保留真實版本。離線 reviewer 會列出後續流程差異，並拒絕已漂移的模型契約檔案。
- 全 42 題（84 組題意／理由）已獨立 AI 審閱；一處「感興趣／最吸引」為自然問句程度差異，未改變作答主題或構成相反建議。60 份回饋、480 組配對亦已逐筆完成獨立 AI 語義審閱，未見實質矛盾；主代理另抽核 9 份回饋。

[獨立語義審閱](../../evaluation/v2/semantic-reviews.json) 與 [離線重驗報告](../../evaluation/results/codex-v2-reviewed.json)：雙語 gate **PASS**、60/60 輸出核對通過；人工標註 **PENDING（0 筆批准）**、真人練習 **PENDING（0 次）**，MVP release **BLOCKED**。

離線重驗命令：`node evaluation/review-report.js`。它不呼叫模型、不改原始報告；只驗證已有輸出、checksums 與獨立語義審閱，產生衍生報告。

## 獨立 review 與保留界線

依使用者指定由唯讀規格分析、測試計畫、初審及高風險複審進行核對。已重現並修復跨 request ID 的重複回饋呼叫、背景回饋清除新草稿，以及語音／文字來源切換問題。初審的 workspace 洩漏疑慮經實際 API 與程式核對後撤回；單一 UI 的 autosave 已序列化，不宣稱多 client 共同編輯同步。

`npm run evaluate:release` 的 fake v2 管線自動檢查通過，仍以 exit 1 阻止 release。fake 固定評分不算模型品質。獨立 AI 雙語審閱也不等於人工標註；`human-labels.json` 與 `creator-validation.json` 保持原有待完成狀態，沒有將合成資料、瀏覽器 smoke 或五次模型呼叫冒充真人練習。

此子專案沒有 Git repository，因此未建立 commit 或 push。
