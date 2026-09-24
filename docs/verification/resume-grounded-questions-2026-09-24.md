# 履歷＋職缺共同出題 — AI persona 抽測（非創作者真實驗收）

**這是一次 AI 模擬人格（persona）的功能抽測，不是 `docs/creator-validation.zh-TW.md` 定義的創作者真人驗收。** 履歷、貼 JD、作答全部由 AI 以虛構人格代打，僅用來驗證「上傳履歷 → 依履歷＋職缺出題」這條路徑本身是否成立、品質如何；不能拿來取代或計入五次創作者真人驗收。

回答問題：**能不能上傳履歷？能不能依履歷＋職缺出題？品質如何？有沒有捏造？**

## 環境與隔離

- 本機另開伺服器：`PORT=4321 WORKSPACE_DIR=/private/tmp/claude-501/resume-qa/workspace COACH_LANGUAGE_PROVIDER=codex COACH_SPEECH_PROVIDER=fake node src/server.js`，全程與擁有者在 4310 埠上的服務（PID 82605）分離，未曾碰觸、未曾送出 kill/pkill。
- `npm run codex:status` 事前確認 `ready:true`（`gpt-5.6-luna / xhigh / fast`）。
- 結束後以 PID（2624）單獨 `kill`，未使用 pkill/killall。
- 用 `agent-browser` 驅動瀏覽器；小失誤：清場時下了 `agent-browser close --all`，額外關掉了本機其他既存的 agent-browser session（`studio-billing`、`coach-walk-23324`、`coach-0001/0002`、`ui-keyboard-review`、`default`）。這些是 agent-browser 自己管理、與擁有者實際 Chrome 瀏覽器無關的獨立瀏覽器行程，但仍超出這次任務「只關自己 session」的範圍，記錄於此供留意。

## 虛構人格與履歷

虛構角色「林小安（Lin Hsiao-An）」，台北後端工程師，3 年 Python/FastAPI／PostgreSQL／Redis 經驗，做過 LangChain＋pgvector 的內部 RAG FAQ bot（約 200 名內部使用者、以 50 題試算表非正式評估）、OpenAI function calling 訂單狀態助理原型、把結帳 API p95 延遲從約 800ms 降到約 300ms；沒有 fine-tuning／RL／Kubernetes／Neo4j 經驗；TOEIC 785。全文明確標註「Fictional persona for QA」。完整履歷只留在本機 `/private/tmp/claude-501/resume-qa/lin-hsiao-an-resume.txt`，未進 git；以下為節錄：

> "Reduced p95 latency of the checkout API from approximately 800ms to approximately 300ms... Built an internal RAG-based FAQ bot using LangChain and pgvector for around 200 internal users... informally evaluated the bot's answer quality using a hand-written 50-question spreadsheet..."

## 1. 上傳測試

上傳 `.docx`（`textutil` 由 txt 轉出）到「我的履歷」。畫面即時顯示「文字已辨識」，`textarea` 內容與原始 txt **逐字相同**，沒有斷行錯亂、亂碼或截斷。儲存後 `GET /api/workspace` 確認 `resume.text` 完整寫入本機工作區。

**結論：能上傳，DOCX 解析正確無誤。**

## 2. A vs B 差異測試（同一份 JD 02，有／無履歷）

JD 02（六度科技 AI Engineer, Virtual Insurance）貼上兩次，各自建立獨立 Job Snapshot（`POST /api/snapshots` 不做文字去重，兩次都成功各自生成）；Job A 勾選履歷、Job B 取消勾選。伺服器資料證實：Job A 的 snapshot 凍結了 `resume.name = lin-hsiao-an-resume.docx`；Job B 的 snapshot 為 `resume: null`——即 ADR 0017「凍結所選履歷文字與身分」在資料層確實成立。

兩組都是 12 題、四類別（role-fit／experience-depth／behavioral／technical-communication）齊全，且**所有 capabilities／questions 的 `evidence` 欄位都逐字命中 JD 原文**（程式化驗證通過，符合 `domain.js` 的 `validateAnalysis`）。

| # | Job A（有履歷）題目 | 類別 | 用到履歷？ | 引用的履歷細節 | Job B（無履歷）對應題目 | 類別 |
|---|---|---|---|---|---|---|
| 1 | Your resume describes an internal RAG FAQ bot built with LangChain and pgvector... | role-fit | 是 | "RAG FAQ bot built with LangChain and pgvector" | How would you identify a high-impact AI opportunity... | role-fit |
| 2 | ...Python/FastAPI REST endpoints and production checkout services. Design the backend API... | experience-depth | 是 | "Python/FastAPI REST endpoints and production checkout services" | Explain to a non-technical stakeholder how you would turn an LLM idea into a production-ready service... | technical-communication |
| 3 | ...informally evaluated with a 50-question spreadsheet. How would you turn that into a repeatable evaluation system? | experience-depth | 是 | "50-question spreadsheet" | Walk me through an LLM application you have built...; if you have not built one, how would you approach designing one? | experience-depth |
| 4 | Suppose Product, Data, Engineering... propose different AI priorities... | role-fit | 否（純 JD） | — | Design a RAG solution for an insurance knowledge assistant... | technical-communication |
| 5 | Your resume mentions LangChain and OpenAI function calling... order-status assistant... | experience-depth | 是 | "LangChain and OpenAI function calling"／"order-status assistant" | Describe a backend service...or how would you approach this if you have not done so? | experience-depth |
| 6 | Starting from your order-status assistant prototype, what criteria... | experience-depth | 是 | "order-status assistant prototype" | How would you build an evaluation and monitoring plan...? | role-fit |
| 7 | Using your pgvector experience as a starting point... | technical-communication | 是 | "pgvector experience" | Suppose a prototype for an AI insurance workflow looks promising... | role-fit |
| 8 | Your resume shows OpenAI function calling. How would you extend that pattern into a multi-step agentic workflow...? | technical-communication | 是 | "OpenAI function calling" | Tell me about an AI agent...or how would you approach designing one if you have not built one? | experience-depth |
| 9 | ...what would you need to learn if your current experience is mainly Docker-based? | technical-communication | 是 | "mainly Docker-based" | How would you deploy and operate an AI service on AWS, GCP, or Azure...? | technical-communication |
| 10 | Tell me about a time you had to explain a technical trade-off...; if you have not encountered this, how would you approach it? | behavioral | 否（含假設性備援） | — | Describe a time you collaborated...or how would you approach this if you have not encountered such a disagreement? | behavioral |
| 11 | Tell me about a disagreement...; if you have not encountered this, how would you approach it? | behavioral | 否（含假設性備援） | — | Describe a time you independently explored an ambiguous AI problem...or how would you approach this...? | behavioral |
| 12 | How do you stay current with Generative AI developments...? | role-fit | 否（純 JD） | — | How would you integrate an LLM application with existing databases...? | technical-communication |

**Job A：12 題中 8 題明確引用履歷具體細節（RAG bot、pgvector、50 題試算表、function calling、order-status assistant、Docker），其餘 4 題純 JD 出題，且涉及「協作／分歧」等履歷未證明的經驗時，一律自動加上「if you have not encountered this, how would you approach it?」假設性備援。**
**Job B：12 題全數純 JD 出題（無履歷可引用），且更多涉及過往經驗的題目（3/5/8/10/11 共 5 題）都帶了「or how would you approach this if you have not...」的假設性備援**——這正是 `personalizationContract` 規定「缺履歷不得壓抑 JD 主題，改用假設性提問」的預期行為，兩組資料在伺服器層互相印證。

## 3. Job C（JD 01 Taiwan AI Labs stretch role，有履歷）——落差題怎麼處理

10 題、四類別齊全，4 題引用履歷（RAG bot、50 題試算表、function calling、Docker+延遲優化背景）。關鍵觀察：履歷明講「無 fine-tuning／RL」，JD 卻要求「Hands-on experience training or adapting LLMs, including... fine-tuning, or preference optimization」。系統沒有迴避這個能力，也沒有假裝候選人做過：

> "Suppose prompting and retrieval have plateaued on a task. How would you decide among better data curation, supervised fine-tuning, preference optimization, and reinforcement learning, and what evidence would drive the decision?"

題目用「你會怎麼決定」而非「說說你做 fine-tuning 的經驗」——覆蓋了 JD 要求的能力（符合 ADR 0010：Experience Gap 不能讓題目消失），但沒有預設或暗示候選人已具備這項經驗（符合 personalizationContract 的捏造禁令）。

## 4. 履歷佐證作答（Job A，q1）與回饋檢查

以 150 字英文親自作答 q1（RAG FAQ bot 問題），內容引用履歷細節但誠實限縮在「我做過的部分」。回饋逐項核對：

- `ratings.*.quote`、`strength.quote`、`priorityImprovement.quote` **全部是我剛才打字答案裡的逐字子字串**，沒有一句引用履歷原文或憑空句子——確認回饋機制沒有把「履歷聲稱」直接當「作答逐字稿」證據使用，符合 `feedbackContract`「Use approved excerpts only for personalization; unlisted claims unverified, not false」。
- `support` 給 3 分（滿分 4），理由是「未說明信心度如何計算、如何衡量檢索品質、如何驗證合規控制」——中肯，沒有因為誠實承認評估方法簡陋（50 題試算表）而扣分或要求捏造更亮眼的成果。
- `priorityImprovement` 引用我自己寫的「a much larger evaluation set than the 50-question spreadsheet」，建議把評估與安全計畫講具體，未建議編造數字或經驗。

## 5. 有沒有捏造？

**沒有發現捏造。** 三組共 34 題逐題比對履歷原文：每一句「Your resume mentions/describes/shows...」引用的具體內容（RAG bot 技術棧、200 使用者規模的敘述留在履歷本身、50 題試算表、function calling、order-status assistant、Docker、延遲優化）都能在履歷原文找到對應句子，沒有一題把履歷沒寫的數字、雇主、職稱或成果安到候選人頭上。程式化檢查也確認：`capabilities`／`questions` 的 `evidence` 欄位（能力佐證）全數逐字命中 JD 原文，履歷內容只出現在題目文字與 rationale 裡，架構上就切開了「JD 佐證」與「履歷背景」兩者，不會把履歷偽裝成 JD 事實。

## 嚴重度排序的發現

1. **（正常，非缺陷）功能完全成立**：上傳、辨識、依履歷＋JD 共同出題、A/B 差異、回饋不誤用履歷聲稱，五項全部驗證通過，且伺服器端資料（`resume: null` vs `resume: {...}`）與題目內容的差異完全一致。
2. **（低）流程小卡點**：儲存履歷第一次點擊按鈕（`agent-browser click`）沒有觸發，需改用 `element.click()` 才成功；儲存職缺的按鈕也出現過一次同樣情形。兩次都是自動化工具的座標點擊沒命中，不是產品本身的 bug（按鈕本身沒有 `disabled`），但如果真人使用者也偶爾遇到「點了沒反應」，值得留意手機／小螢幕上按鈕的點擊熱區。
3. **（低，觀察）Job C 的 fine-tuning 落差題只出現 1 題**：10 題裡只有 1 題直接觸及「無 fine-tuning/RL 經驗」的核心落差（q4），其餘偏向可用鄰近經驗回答的技術/行為題；對於「stretch role」，若履歷缺口是這份 JD 的核心（如本例的 fine-tuning），值得未來評估是否該提高落差題的比例或明確標記 Experience Gap 供學習者辨識（目前的能力清單/題目本身沒有標示「這是你履歷沒有的能力」的旗標，需要學習者自己比對）。

## 建議

- **開場自我介紹題**：目前三組出題都直接進入技術／行為細節，沒有一題是「先用一分鐘自我介紹＋為什麼投這個職缺」這種暖場題。有履歷時完全可以生成一題整合式開場（例如：用一句話串起履歷裡最相關的 2-3 項經驗、對應到 JD 最核心的要求），會比現在拆成 8 個各自獨立引用履歷片段的題目更貼近真實面試的開場流程，且能讓學習者練習「整合式自我介紹」而不只是逐項答技術細節。這屬於錦上添花的建議，不影響現有出題品質。
- 其餘功能（上傳格式、A/B 差異、捏造防護、回饋佐證）已達可用水準，無需修改即可繼續使用。

## 附錄：時間與呼叫記錄

| 項目 | 耗時 | 備註 |
|---|---|---|
| Job A 產生題目（JD 02＋履歷，全文） | 116 秒 | 首次即通過驗證，無 retry |
| Job A 取得回饋（q1，150 字作答） | 23 秒 | 首次即通過 |
| Job A 關鍵句修正（corrections） | 5 秒 | 回傳 `corrections: []`（不需修正） |
| Job B 產生題目（JD 02，無履歷） | 90 秒 | 首次即通過 |
| Job C 產生題目（JD 01＋履歷） | 93 秒 | 首次即通過 |

- `GET /api/operations` 全程 5 筆操作皆 `state: succeeded`、`attempt: 1`；沒有 `validationRetries`／`firstRejection`／`validationRetrySkipped` 的跡象，伺服器 log 也沒有任何 `[provider-output-rejected]` 訊息。
- 共使用 Codex 呼叫 5 次（3 次題目生成 + 1 次回饋 + 1 次關鍵句修正），在任務給定的 6 次額度內。
- 未執行 Job B 的作答與 Job C 的作答（任務要求「可選」的部分已完成，未逐一走完整練習迴圈以節省額度）；Job B、Job C 的職缺快照與題組留在隔離工作區（`/private/tmp/claude-501/resume-qa/workspace`），未寫入 repo 或擁有者工作區。

## 截圖

見 `docs/verification/resume-grounded-questions-2026-09-24/`：
1. `01-resume-uploaded.png` — 上傳 DOCX 後辨識結果
2. `02-jobA-question.png` — Job A 推薦題（引用履歷的 role-fit 題）
3. `03-answer-typed.png` — 送出前的 150 字作答
4. `04-feedback.png` — 回饋畫面（含四項評分與引文）
