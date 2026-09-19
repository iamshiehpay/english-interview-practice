# Interview Coach 第二輪改進交接

## 專案與狀態

根目錄：`/Users/shiehpay/Desktop/resume/side-projects/adaptive-english-interview-coach`。目前不是 Git repository，沒有 branch/PR/remote；不要自動 git init 或捏造 commit。Node.js 後端＋原生 JavaScript/CSS 前端，保留現有技術，不遷移 React。

已完成 v3：JD 或 JD＋可選履歷出題、履歷 PDF/DOCX/TXT/文字、版本凍結、文字草稿恢復、首次回饋即可結束、可選修改、AI 協助、暖色 headspace-meditation 風格。最近完成回饋只顯示中文（英文題目、原句、示範保留）、回答歷史版本選單與 `examples/fictional-backend-resume.txt`。

第二輪只完成討論及文件，追問、紀錄頁重排、句子修正與重點練習尚未實作。不要因文件有決策就宣稱功能已完成。

## 必讀文件

- `docs/learner-flow-discussion.md`：以末尾第二輪全部定案覆蓋較早「待確認」。使用者接受全部 10 項建議。
- `CONTEXT.md` 與 `docs/adr/`：詞彙與歷史決策，尤其目前主問同題修訂與新追問的區別。
- `docs/verification/learner-flow-v3.md`：既有驗證及尚未通過的 release gate。

## 已定案需求

1. 每道主問最多 2 次可選追問，可提前結束；每次回答後中文回饋，再由使用者決定追問。滿兩次收束，不無限延伸。追問取最近正式提交回答及上下文，不以 AI 示範當作使用者回答。
2. 保留同題修訂。開始追問時保存原回答版本，後來修改不覆寫既有追問脈絡。答不出來可提示、假設回答或結束，不編造經驗。
3. 收束只顯示一項整體優點、一項下次重點與下一步；完整紀錄按需看。
4. 每次最多 1–2 個有必要改的英文句子：原句、改寫、中文理由。保留事實，無須修改時不硬湊。整段示範仍按需開啟。
5. 「練這個重點」在同 JD 下出新情境題，記錄來源並回饋是否改善，不讓使用者管理能力清單。
6. 紀錄頁保留暖色圓角，改單欄依職缺列表，頂部最近未完成一筆；其餘透過篩選、搜尋、分頁，依最近活動排序。簡短職稱可改名，刪除放更多選單。無練習職缺也保留開始入口。
7. 職缺詳情按練習列出摘要。主問與其追問在同一筆；完成數按完成主問練習計，追問不充數。詳細回答不全量展開，選看一题／一版本。
8. 同 JD 重貼提示沿用或另建，不默默合併不同履歷版本。再練同題建立新練習不覆蓋舊回答；沿用當次履歷，新履歷需明示新出題版本。
9. 作答前入口「不知道怎麼回答？」：題目特定提示、中文想法轉英文、無經驗框架；可先用再自行提交，AI 文字不自動算正式作答。
10. 三題短場模擬與真實語音是後續階段，不納入這輪。

## Skills 與 subagents

ask-matt 已讀；適合路線是 handoff → to-prd → to-issues → 每個切片 implement；UI 使用 web-design-engineer（既有 headspace-meditation 方向已授權），結束以 code-review 與適當瀏覽器驗證。`implement`、`setup-matt-pocock-skills` 存在於 `/Users/shiehpay/.agents/skills/`，即使 catalog 未列出也先查本機。

專案沒有 docs/agents 或已配置的 tracker；正式 to-prd/to-issues 前先讀 setup skill。建議 local Markdown tracker，沿用現有 glossary/ADR。不必為用 subagents 安裝任何角色包。未安裝 VoltAgent repo，也未變更全域 Codex 設定。

使用者明確要求 subagents。按當下執行上限，建議主代理整合＋最多三個子代理；檔案責任明確，不同代理不要同時修改 public/app.js 或共享 model/schema 檔。先對齊 API/狀態契約，再平行前後端，驗證者獨立檢查。若需要 review agent 槽位，等實作者完成再開，不需要常駐每個角色。

## 現有程式重點與驗證

- `public/app.js` renderHistory 目前仍雙欄來源，records 以 snapshotId 關聯；src/server.js 每題 attempts 最多兩次是原題初答／修訂，不可直接當兩個追問名額。
- 保留草稿序列、取消／重試／刪除晚到結果隔離、履歷版本凍結與舊紀錄讀取。
- 原先 `npm test` 78/78；最近 UI 變更 `node --check public/app.js` 及 `npm run test:browser` PASS。新功能需新測試，不能沿用舊通過當新驗收。
- `npm run start:codex` 預設127.0.0.1:4310，先查 health/port，避免重啟撞 EADDRINUSE，不任意 kill 無關程序。
- 測試使用隔離資料，不刪真實履歷／練習。speech fake 不提供真實錄音。
- 人工標註、五次真人練習仍未完成，v3 release BLOCKED；自動測試不等同真人／模型品質評估。

## 下一步

1. 核對程式與交接，補齊本機 tracker 配置後將已定案討論轉成 PRD 與垂直切片任務；不要重啟需求訪談。
2. 依使用者已接受順序先做追問完整切片；紀錄頁重排在 API 契約明確、檔案所有權不衝突時可獨立並行。
3. 後續按追問 → 句子修正 → 重點練習；紀錄頁可在契約明確後獨立並行。每切片完成程式、測試、review、交接。
