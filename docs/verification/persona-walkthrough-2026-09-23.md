# AI 扮演求職者的流程測試（非創作者本人驗收，不計入 creator-validation ledger）

本文件記錄一次由 AI（Claude）扮演求職者角色、依 `docs/creator-validation.zh-TW.md` runbook 逐步操作的探索性 QA，涵蓋 runbook 第 3 節「五次練習」中的練習 2～5（練習 1 由創作者本人另外完成，這裡額外多跑了一次練習 1 作為暖身與工具校準，其結果一併附上供參考）。**這不是創作者本人的真實使用驗收**，不滿足 runbook 第 0 節「必須本人親自打字/開口回答」的前提，因此其記錄 ID 不應、也未被寫入 `evaluation/v3/creator-validation.json`。

## 測試環境

- 獨立伺服器：`PORT=4311`、`WORKSPACE_DIR=/private/tmp/claude-501/persona-qa/workspace`、`COACH_LANGUAGE_PROVIDER=codex`、`COACH_SPEECH_PROVIDER=fake`（未觸碰創作者在 4310 的真實服務與 `.workspace/`，僅讀取 `.workspace/validation-jds/` 下的 JD 檔案）。
- Provider：`Codex / ChatGPT subscription / gpt-5.6-luna / xhigh / fast`（`npm run codex:status` 確認 `ready:true` 後才開始）。
- 語音以**文字輸入取代**（題目要求語音處的地方一律改用文字作答，本 QA 環境語音為假回聲服務）。
- 操作工具：`agent-browser` CLI，命名 session `persona-qa`。

## Persona：林小安

台北的後端工程師，約 3 年資歷，中型電商公司，Python/FastAPI/PostgreSQL/Redis，少量 Node；工作內副業做過用 LangChain + pgvector 的內部 RAG FAQ bot（約 200 名內部使用者，用自己寫的 50 題試算表人工核對評估）；用過 OpenAI function calling；沒有微調過模型、沒有 RL、沒有 Neo4j、基礎 Docker、沒有 Kubernetes。英文中等，刻意保留一些台灣英文使用者常見的小錯誤（冠詞、第三人稱單數、時態）。誠實作答，經驗落差一律用 runbook 2.3 節的誠實承認句型，不編造沒做過的經驗。

## 各練習總覽

| 練習 | JD | 類別 | 產題耗時 | 回饋耗時 | 結果 | 主要觀察 |
|---|---|---|---|---|---|---|
| 1（暖身，非本次任務要求範圍） | JD 02 六度科技 | role-fit | 第一次 TIMEOUT（~3 分鐘）後重試成功（~2 分鐘） | 首次 ~26s，修訂後 ~38s | 完成，含修訂比較 | 首次 analysis 觸發 `[provider-output-rejected]` 後仍 TIMEOUT；修訂比較正確辨識出「上次的優先改進已解決」 |
| 2 | JD 01 Taiwan AI Labs | technical-communication（Experience Gap） | ~84s | ~29s | 完成 | 誠實承認沒做過 fine-tuning，回饋未因此扣分或要求造假 |
| 3 | JD 03 Synopsys | behavioral | ~106s | ~29s | 完成 | 未發現 JD 沒提到的憑空要求 |
| 4 | JD 03（沿用快照） | experience-depth（刻意觸發取消） | 無需重新產題 | 取消於送出後 ~4 秒；重試 ~22s 成功 | 完成 | 取消/重試流程正常，回答未遺失；切題程度因答案未完全對應題目要求而降到 2/4（合理） |
| 5 | JD 05 優必達 | role-fit | ~76s | ~32s | 完成，含 Focus Point 持久化驗證 | 自訂 Focus Point 在重新整理與**伺服器重啟**後都還在 |

## 依嚴重度排序的發現

### 1（高）「我的進步」頁在目前 UI 完全無法從導覽列到達 —— runbook 步驟無法照做

Runbook 練習 5 最後一步要求「重新整理瀏覽器頁面…確認：導覽列『我的進步』頁能看到同一句 Focus Point」。但實際檢查 `public/index.html` 的 `<nav>` 只有 5 個按鈕（開始練習／找職缺／練習紀錄／我的履歷／設定），完全沒有「我的進步」。程式碼搜尋確認：

- `#progress-view`、`renderProgress()` 都存在且運作正常（`public/app.js` 第 248、1280 行）。
- 但整個程式碼庫**沒有任何元素**帶有 `data-view="progress"`，因此點擊監聽器（`app.js` 第 250 行 `document.querySelectorAll('[data-view]').forEach(...)`）永遠不會被綁到能導向這一頁的按鈕上。

用 DOM workaround（把既有導覽按鈕的 `data-view` 暫時改成 `progress` 再點擊）驗證後，該頁面內容其實完全正確——依時間新到舊列出全部 4 筆已完成記錄的 Focus Point，練習 5 的自訂內容排最上面。**底層功能沒問題，純粹是進入點消失了**，一般使用者（包含創作者本人跑這份 runbook 時）目前完全無法用滑鼠點到這一頁。證據：`docs/verification/persona-walkthrough-2026-09-23/loop5-progress-page-after-reload.png`。

### 2（高，事故揭露）操作過程中誤殺了創作者在 4310 的真實伺服器

為了完成練習 5「完全關閉並重啟伺服器」，執行了 `pkill -f "node src/server.js"`。這是字串比對，同時殺掉了我自己 4311 的行程，**也殺掉了創作者在 4310 執行中的真實伺服器**（因為兩者都是 `node src/server.js`）。發現後立刻用 `npm run start:speech`（runbook 自己教的指令）重啟 4310，讀回創作者真實的 `~/.config/interview-coach/speech.env`、預設 `WORKSPACE_DIR`／`PORT`，啟動 log 確認已重新監聽 4310。之後沒有再對 4310 送出任何請求（權限系統也主動擋下了一次對 4310 的 curl，正確發揮隔離作用）。由於這個 app 的資料本來就是落地到 `.workspace/` 檔案（練習 5 本身測的就是這個特性），一次短暫的行程重啟理論上不會遺失任何已保存資料；但如果創作者當下剛好有操作卡在「進行中」，回來會看到那筆變成失敗/可重試狀態。**這件事必須另外告知使用者／創作者**，不能只寫在這份報告裡。

### 3（中）「不知道怎麼回答？」裡的「沒有相關經驗的回答框架」會實際呼叫模型，runbook 沒有說明

Runbook 練習 2 說這個框架提示「只是輔助，不算正式作答」，用詞給人的印象是本機或低成本操作。實測點下去後畫面顯示「正在整理適合這一題的建議…」，`/api/operations` 多出一筆 `kind:"coaching"` 的操作、耗時約 12 秒，確實呼叫了 Codex。內容本身沒問題（中性診斷框架，未建議造假），但這會消耗訂閱用量與時間，建議 runbook 註明。

### 4（中）`agent-browser` 對這個 app 的原生按鈕點擊經常不生效，只有直接 JS `element.click()` 才可靠

這是自動化工具與此 app 的相容性問題，不是產品本身的 bug（不影響真人滑鼠點擊），但值得記錄：整段測試中，`儲存職缺並產生題目`、`開始回答`、`送出並取得回饋`、`<summary>` 展開、`結束並保存` 等按鈕透過 `agent-browser click <ref>` 幾乎每次都不觸發任何網路請求，改用 `eval` 直接呼叫 DOM `.click()` 才成功。若之後有其他自動化 QA 要用同一支 CLI 測這個 app，建議直接採用 eval-click 或改用 `find role button click --name "..."`。

### 5（低，屬正常/預期行為，列出供對照）第一次題目產生 TIMEOUT + `[provider-output-rejected]`

練習 1 的 `analysis` 操作第一次嘗試耗時約 3 分鐘後回報 `errorCode:"TIMEOUT"`，`validationRetries:1`，`firstRejection:"Invalid provider output: analysis capabilities[8].evidence not in job snapshot"`（伺服器 log 對應一行 `[provider-output-rejected] analysis attempt 1 of 2: ...`）。UI 正確顯示「產生題目・失敗・可從原操作重試」與「不需要重新貼上職缺」的重試按鈕，重試後第二次嘗試（~2 分鐘）成功，職缺文字未遺失。這正是 runbook 第 7 節疑難排解描述的正常復原路徑，記錄於此作為 timeout/重試機制運作正常的證據，非新發現的 bug。

## 逐項驗證結果

- **回饋引文逐字比對**：5 次練習中，所有 `你的原句`（強項引文、優先改進引文、四項評分依據引文、關鍵句修正原句）逐一人工核對，全部是打字答案裡的逐字子字串，無一例外。
- **中英文語意一致性**：所有 `reasonZh` 中文理由與對應英文評分理由方向一致，未發現「中文比較嚴厲/英文比較寬鬆」或相反的落差。
- **有無憑空加要求**：練習 3（依 runbook 要求特別檢查）與其餘四次都未發現回饋或優先改進提到 JD 未提及的證照、工具或年資。
- **經驗落差（練習 2）**：誠實承認沒做過 fine-tuning，回饋切題程度/論據/結構皆 4/4/4，英文表達 3/4（純文法問題），優先改進要求「更明確拆解 trade-off」，沒有任何要求造假或因誠實而被扣分的跡象。
- **修訂比較（練習 1 額外驗證）**：針對第一次回饋的優先改進點做針對性修改後，第二次回饋明確寫出「前一項優先改進在這次回答中已獲得解決」並給出新的優先改進，「關鍵句前後對照」正確標出變動段落。
- **取消／重試（練習 4）**：送出後 ~4 秒內成功取消（早於 Fast 模式 16–20 秒的完成時間），畫面文字「取得回饋・已取消・可從原操作重試」、「回答已保存，但回饋尚未完成：操作已取消；先前保存的內容仍在本機」與 runbook 描述的「回饋尚未完成，可以重試」相符（UI 文字更完整）；重試後回答無需重打、內容完整、無重複送出紀錄（`/api/operations` 顯示同一 `feedback` op id 底下 attempt 1 cancelled、attempt 2 succeeded，無重複 record）。
- **Focus Point 持久化（練習 5）**：自訂 Focus Point 文字在「重新整理瀏覽器」與「完全重啟伺服器（同一 `WORKSPACE_DIR`）」後，首頁「下次，接著練這裡」與「練習紀錄」都仍正確顯示；「我的進步」頁內容也正確（見發現 1 的說明），只是進入點缺失。

## 用量

- 使用的 Codex 呼叫數：約 19 次（分析 6 次含 1 次失敗重試、回饋 6 次、修正建議 6 次、框架提示 1 次），在 25 次的預算內。
- 未跑額外的題組，僅練習 1 因第一次 timeout 多重試了一次分析。

## 附圖

- `loop1-timeout.png`：練習 1 首次產題 TIMEOUT 的畫面。
- `loop1-revision-feedback.png`：修訂比較正確辨識已解決的優先改進。
- `loop2-feedback.png`：Experience Gap 誠實承認未被扣分的完整回饋畫面。
- `loop4-cancelled.png`：取消取得回饋後的畫面狀態。
- `loop5-progress-page-after-reload.png`：用 DOM workaround 進入「我的進步」頁，確認內容正確但無導覽入口。
- `loop5-history-after-server-restart.png`：伺服器重啟後練習紀錄仍存在。
