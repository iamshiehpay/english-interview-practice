# 創作者真實使用驗收 Runbook

這份文件是唯一需要照著做的清單。所有按鈕文字、頁籤名稱都已對照 `public/index.html`、`public/app.js`、`public/voice.js` 的實際中文字串核對過，照上面寫的文字找就對了，不用自己判斷。

## 0. 目的與規則

- [ ] 這五次練習必須是**你本人**親自貼職缺、親自打字或親自開口回答；不能用 AI（包含 Claude／ChatGPT／Codex）幫你生成答案再貼進去。這是要驗證產品在真人使用下是否成立，不是要再測一次模型。
- [ ] 不要把私人資料（履歷全文、身分資訊、公司內部職缺全文如果有保密疑慮）貼到**公開**文件裡。這份 runbook、`evaluation/v3/creator-validation.json` 會進 git／可能公開；後者只會存 `recordId`、`snapshotId`、題目類別、時間戳、`inputMode`、是否有 Experience Gap／induced failure 這些**識別碼與分類**，不存任何回答內容或職缺全文。
- [ ] 練習當下產生的逐字回答、錄音、真實感想，只寫在本機、未進 git 的 `.workspace/validation-notes.md`（第 3 節有模板；`.workspace/` 已整個列在 `.gitignore`）。
- [ ] 三題短場模擬（導覽列看不到，是首頁某些狀態才會出現的「三題短場模擬」流程）**不算**這裡的 Practice Loop，`app.js` 原始碼註解本身也寫明「It is not a Practice Loop and never produces a Focus Point」。五次練習一律走單題練習（貼 JD → 選題 → 回答 → 回饋 → 結束並保存）。

## 1. 事前準備

- [ ] 終端機執行 `npm run codex:status`，確認輸出顯示 ready。
- [ ] 如果不是 ready，執行 `npm run codex:verify`（提醒：改過任何 `src/codex-*.js` 之後也一定要重跑這個，否則之後請求可能收到 Codex 428）。
- [ ] 確認 `~/.config/interview-coach/speech.env` 存在、內容含 `COACH_LANGUAGE_PROVIDER=codex`、`COACH_SPEECH_PROVIDER=openai`、`OPENAI_API_KEY=...`，且權限是 600（`ls -l ~/.config/interview-coach/speech.env` 開頭應為 `-rw-------`）。
- [ ] 執行 `npm run start:speech`。
  - 若 4310 埠已被占用，終端機會印出類似「`127.0.0.1:4310 已經有服務在跑（PID xxxx），新的不會啟動。`」並附上 `kill <PID>` 指令；照著執行後再重新 `npm run start:speech`。
- [ ] 瀏覽器開啟 **http://127.0.0.1:4310**。
- [ ] 點導覽列「**設定**」。「目前使用的服務」區塊應該看到：
  - 題目與回饋那一列的服務名稱以 `Codex / ChatGPT subscription / gpt-5.6-luna / xhigh / fast` 開頭（`fast` 代表 Fast/priority 模式）。
  - 下方會有一個狀態框；若寫「**尚未完成 Codex 登入**」或「**已登入，尚未完成本機驗證**」，先在終端機依 README 完成登入／驗證，回來按狀態框裡的「**重新檢查狀態**」按鈕，直到文字變成「**Codex 訂閱服務已可使用**」才能繼續。
  - 語音轉錄與朗讀那一列的服務名稱要以 **`OpenAI speech`** 開頭（不是「本機示範服務」）；如果顯示本機示範服務，代表語音金鑰沒吃到，回頭檢查 speech.env。
- [ ] 頁面最上方那條系統列（logo 列下方那一行）文字裡也要同時看到 Codex 字樣與「**語音：OpenAI speech** ...」字樣，這是最快的目視確認方式，不用每次都進設定頁。
- [ ] 決定是否上傳履歷：
  - 要用的話，點導覽列「**我的履歷**」→「**選擇檔案**」上傳 PDF/DOCX/TXT（最多 5 MB）。頁面上會註明「保存在本機；搭配 JD 產題時才會傳送文字給模型」——也就是履歷檔案本身只存在你這台機器，不會整份傳出去，只有在你勾選搭配履歷產題時，履歷的文字內容才會被送給模型。
  - 不想用的話，首頁貼 JD 那一頁如果出現「搭配履歷：...」的勾選框，取消勾選即可只用 JD 出題；沒有履歷時這裡只會顯示提示文字，不影響操作。

## 2. 五次練習

每一次的共同流程（細節見各次段落）：
**首頁貼 JD 或練習紀錄選既有職缺 → 儲存職缺並產生題目（若是新 JD）→ 選一類題目 → 用文字或語音回答 → 送出並取得回饋 → 依該次要求做額外動作（修訂比較／誠實承認沒經驗／檢查有無憑空加要求／取消再重試／存 Focus Point）→ 按「結束並保存」。**

判斷題目類別：每一題頁面標題正上方有一小行「類別標籤」（例如「建議先練｜職務動機與適配」或單純「經驗與專案深度」）。四種類別的中文字樣固定是：

| 類別代碼 | 畫面上的中文字樣 |
|---|---|
| role-fit | 職務動機與適配 |
| experience-depth | 經驗與專案深度 |
| behavioral | 行為與情境判斷 |
| technical-communication | 技術說明 |

若想自己指定類別而不是用系統推薦的題目，在題目頁按「**查看全部（N）**」，會出現「選一題來練習」頁面，題目依上表四類分組（每組標題就是表格右欄的字），挑一題卡片上寫「尚未作答」的，按卡片上的「**選這一題**」。

貼 JD 時：用編輯器開啟對應的 `.workspace/validation-jds/xx-....txt`，**跳過第一行** `# 標題 — 公司 — 網址 — retrieved 日期` 的 header，只複製第二行以後的正文貼進「貼上完整職缺描述」欄位（macOS 可用 `tail -n +2 檔案路徑 | pbcopy` 直接複製到剪貼簿）。「練習深度」下拉維持預設「依職缺要求」即可。按「**儲存職缺並產生題目**」後，頁面上方「操作」區會顯示「產生題目・進行中」；量測到的基準是一行 JD、Fast 模式約 43 秒，這五份是完整職缺全文，預期會更久，請耐心等、不要重新整理或重複點擊。

---

### 練習 1／5 — JD 02（六度科技 AI Engineer）・role-fit・文字

- [ ] 貼 `.workspace/validation-jds/02-liudu-tech-ai-engineer-virtual-insurance.txt`（去掉第一行）產生題目。
- [ ] 若推薦題不是 role-fit（「職務動機與適配」），按「查看全部（N）」在該分類底下選一題，按「選這一題」。
- [ ] 按「**開始回答**」。
- [ ] 在「你的回答」欄位用**文字**親自作答，按「**送出並取得回饋**」。
- [ ] 等回饋（基準約 16–20 秒，實際 JD 可能更久）。
- [ ] 回饋出現後，按「**自己再試一次**」（只有 `attempts.length < 2` 時才會出現這顆按鈕）。
- [ ] 在「修改你的回答」欄位做一次**有意義的修改**（不是隨便加句號），按「**送出修改並取得回饋**」。
- [ ] 第二次回饋出現後，頁面會多一段「看看這次的調整」／「關鍵句前後對照」（兩次文字不同才會顯示對照；相同的話會寫「這次回答尚未修改」，代表這次沒做到比較，之後要重練一次真的有改的版本）。也可以展開「查看回答紀錄（2 個版本）」，用「選擇回答版本」下拉切換看第一次跟第二次各自的回饋。
- [ ] 觀察：兩次回饋卡片裡「你的原句」引用的句子，是不是真的出現在你剛才打的文字裡（逐字比對，不是大意像就好）。
- [ ] 在「下次練習重點（可以修改）」欄位確認或修改內容，按「**結束並保存**」。

### 練習 2／5 — JD 01（Taiwan AI Labs Senior LLM Engineer）・technical-communication・語音

- [ ] 貼 `.workspace/validation-jds/01-taiwan-ai-labs-senior-llm-engineer.txt`（去掉第一行）產生題目。
- [ ] 在「查看全部」頁「技術說明」分類底下選一題你**確實沒做過**的能力（例如 fine-tuning／RL／大規模評測，若 JD 有寫這類 stretch 要求），按「選這一題」→「開始回答」。
- [ ] 在回答區塊展開「不知道怎麼回答？」，可以先按「**沒有相關經驗的回答框架**」看系統給的中性框架提示（這只是輔助，不算正式作答，不會被存成回答）。
- [ ] 用**語音**親自作答：在「用語音回答」區塊按「**開始錄音**」，誠實地說「我沒有做過 X，但如果要做，我會…」並給一個具體的假設方案（不要編造沒做過的經驗當成做過）；最多錄 3 分鐘，快到上限畫面會提示倒數。
- [ ] 按「**停止並轉成文字**」，等轉錄完成，文字會自動放進「你的回答」欄位。
- [ ] **轉錄完成後、送出前，先檢查並視需要修改文字框內容**（這就是「送出前可編輯逐字稿」的地方）。
- [ ] 確認文字忠實呈現你剛才說的「誠實承認沒經驗＋假設方案」後，按「**送出並取得回饋**」。
- [ ] 回饋出現後檢查：回饋內容有沒有因為誠實承認沒經驗而給低分或語帶懲罰；有沒有建議你「編造」或「假裝有經驗」；正常應該是就你描述的假設方案給建議，而不是要你换成捏造的實績。
- [ ] 按「**結束並保存**」（若要修訂可先按「自己再試一次」，非必要）。

### 練習 3／5 — JD 03（Synopsys Verdi Assistant）・behavioral・文字

- [ ] 貼 `.workspace/validation-jds/03-synopsys-verdi-assistant-llm-mcp-agent.txt`（去掉第一行）產生題目。這份 JD 內文有明講是英文面試，之後回饋內容理論上不會另外幫你加中文面試的假設。
- [ ] 在「查看全部」頁「行為與情境判斷」分類底下選一題，按「選這一題」→「開始回答」。
- [ ] 用**文字**親自作答，按「送出並取得回饋」。
- [ ] 回饋出現後，對照 JD 原文，檢查回饋（含「下次練習重點」與各面向的中文理由 `reasonZh`）有沒有要求 JD 裡根本沒寫的東西（例如 JD 沒提到的證照、工具、年資），若有，記下具體句子到觀察紀錄。
- [ ] 按「結束並保存」。

### 練習 4／5 — 沿用練習 3 的 JD 03 快照・experience-depth・語音・刻意觸發失敗

先示範怎麼「用既有快照重新開一題」而不是重貼 JD：

- [ ] 導覽列點「**練習紀錄**」。
- [ ] 找到 Synopsys 那張職缺卡片，按卡片上的「**開始新練習**」（因為這份 JD 已經產生過題目，按鈕文字會是「開始新練習」而不是「產生題目」；這會沿用同一個 `snapshotId`，不會重新呼叫模型分析職缺）。
- [ ] 會進入推薦題頁，按「查看全部（N）」，在「經驗與專案深度」分類底下選一題**跟練習 3 不同**的題目，按「選這一題」→「開始回答」。
- [ ] 用**語音**作答：按「開始錄音」、說完後按「停止並轉成文字」、確認轉錄文字、按「**送出並取得回饋**」。
- [ ] **送出後立刻**觀察頁面最上方的「操作」區塊：會多一張卡片顯示「**取得回饋・進行中**」，旁邊有「**取消取得回饋**」按鈕。Fast 模式回饋約 16–20 秒完成，所以要在送出後**幾秒內**盡快點下「取消取得回饋」。
- [ ] 確認操作卡片狀態變成「**取得回饋・已取消**」，並且題目頁會顯示「回饋尚未完成，可以重試」與「**重試取得回饋**」按鈕（你剛才的回答本身仍保留，不會遺失）。
  - 若還沒點到取消，回饋就已經完成了，這次**不算**成功案例，記下時間點，換一次作答重來一次（不佔用另一份 JD，同一題再試一次即可）。
- [ ] 按「**重試取得回饋**」，等待這次成功取得回饋。
- [ ] 在觀察紀錄記下：取消後的畫面文字、重試後是否正常完成、有沒有任何資料看起來遺失或重複。
- [ ] 按「結束並保存」。

### 練習 5／5 — JD 05（優必達）或 JD 04（Vpin）・自選類別・文字・驗證 Focus Point 持久化

- [ ] 任選 `.workspace/validation-jds/05-ubitus-junior-ai-engineer.txt` 或 `.workspace/validation-jds/04-vpin-ai-engineer-knowledge-graph-rag.txt`（去掉第一行）貼上、產生題目。
- [ ] 任選一類題目作答（文字），送出並取得回饋。
- [ ] 完成畫面會在「完成這次練習」區塊看到「**下次練習重點（可以修改）**」文字框，裡面預先帶入系統建議的重點文字。**動手修改成你自己真的想寫的一句話**（這個文字框的內容送出後就是這次練習存下來的 Focus Point）。
- [ ] 按「**結束並保存**」。
- [ ] 完成後畫面「下次可以接著練」區塊應該會顯示你剛剛寫的那句 Focus Point 文字。
- [ ] **重新整理瀏覽器頁面**（F5／Cmd+R），確認：導覽列「**我的進步**」頁能看到同一句 Focus Point；「練習紀錄」裡這筆記錄仍在、狀態是已完成。
- [ ] **完全關閉並重啟伺服器**：回到終端機按 `Ctrl+C` 停掉 `npm run start:speech`，再重新執行一次 `npm run start:speech`，重新整理瀏覽器。
- [ ] 再次確認「我的進步」頁與「練習紀錄」裡這筆 Focus Point 與練習記錄都還在（本機資料存在 `.workspace/` 底下的檔案，不是只存在記憶體，重啟應該不會消失）。

---

## 3. 每次練習的觀察紀錄表（私人檔案，不進 git）

在專案根目錄建立 `.workspace/validation-notes.md`（`.workspace/` 已整個列在 `.gitignore`，不會被送進版本控制），用下面模板記錄五次練習：

```markdown
# 創作者驗收觀察紀錄（私人，不進 git）

## 練習 1 — JD 02 六度 / role-fit / 文字
- 開始時間／結束時間：
- 花費時間（貼 JD 到產生題目、送出到拿到回饋，各記一次）：
- 回饋引文是否真的是我說/打的原句（逐字核對「你的原句」欄位）：
- 中英文意思是否一致（有沒有哪一句中文翻譯感覺跟英文不同調）：
- 有沒有憑空要求 JD 沒提到的東西：
- 遇到的 bug／卡住／看不懂的地方：
- 其他感想：

## 練習 2 — JD 01 AI Labs / technical-communication（Experience Gap） / 語音
（同上欄位，額外記錄：語音轉錄準不準、有沒有因為誠實承認沒經驗被扣分或被建議造假）

## 練習 3 — JD 03 Synopsys / behavioral / 文字
（同上欄位）

## 練習 4 — JD 03（沿用） / experience-depth / 語音（含刻意觸發失敗）
（同上欄位，額外記錄：取消當下畫面文字、重試後是否正常、有無資料遺失）

## 練習 5 — JD 05 或 04 / 自選類別 / 文字（含 Focus Point 持久化）
（同上欄位，額外記錄：重新整理後 Focus Point 是否還在、重啟伺服器後是否還在）

## 整體結論
- 是否有任何一次覺得「這其實是真人會卡住、不會用的地方」：
- 是否有任何回饋內容讓我不放心拿去給真的面試準備使用：
```

## 4. 取得 ID 並填寫 ledger

### 4.1 從本機 API 取出五次記錄的 ID

伺服器要保持在跑（`npm run start:speech`）。這個 repo 零依賴，直接用內建的 `node` 解析 JSON，不需要 `jq`：

```sh
curl -s http://127.0.0.1:4310/api/workspace -o /tmp/workspace.json
node -e '
const fs = require("fs");
const w = JSON.parse(fs.readFileSync("/tmp/workspace.json", "utf8"));
for (const r of Object.values(w.records || {})) {
  if (r.status !== "completed") continue;
  const voice = (r.attempts || []).some(a => a.inputMode === "voice");
  console.log(JSON.stringify({
    recordId: r.id,
    snapshotId: r.snapshotId,
    category: r.question.category,
    completedAt: r.completedAt,
    voiceUsed: voice
  }));
}
'
```

這會為每一筆**已完成**（`status === "completed"`）的練習記錄印出一行 JSON，包含 `recordId`、`snapshotId`、題目類別 `category`、完成時間 `completedAt`，以及這筆記錄的作答有沒有用到語音 `voiceUsed`。核對這五行跟你剛才實際做的五次練習一一對得上（時間順序、類別）。

### 4.2 填寫 `evaluation/v3/creator-validation.json`

目前檔案內容是空殼：

```json
{
  "schemaVersion": 2,
  "contractVersion": "3.0.0",
  "creator": null,
  "attestedAt": null,
  "loops": []
}
```

依上一步印出的資料，把 `loops` 填成五筆（範例形狀如下，`category` 必須是 `role-fit`／`experience-depth`／`behavioral`／`technical-communication` 其中之一，`inputMode` 必須是 `"text"` 或 `"voice"`）：

```json
{
  "schemaVersion": 2,
  "contractVersion": "3.0.0",
  "creator": null,
  "attestedAt": null,
  "loops": [
    {
      "recordId": "<練習1 的 recordId>",
      "snapshotId": "<練習1 的 snapshotId>",
      "category": "role-fit",
      "completedAt": "<練習1 的 completedAt>",
      "completed": true,
      "synthetic": false,
      "inputMode": "text",
      "experienceGap": false,
      "inducedFailure": null
    },
    {
      "recordId": "<練習2 的 recordId>",
      "snapshotId": "<練習2 的 snapshotId>",
      "category": "technical-communication",
      "completedAt": "<練習2 的 completedAt>",
      "completed": true,
      "synthetic": false,
      "inputMode": "voice",
      "experienceGap": true,
      "inducedFailure": null
    },
    {
      "recordId": "<練習3 的 recordId>",
      "snapshotId": "<練習3 的 snapshotId>",
      "category": "behavioral",
      "completedAt": "<練習3 的 completedAt>",
      "completed": true,
      "synthetic": false,
      "inputMode": "text",
      "experienceGap": false,
      "inducedFailure": null
    },
    {
      "recordId": "<練習4 的 recordId>",
      "snapshotId": "<練習4 的 snapshotId，應與練習3相同>",
      "category": "experience-depth",
      "completedAt": "<練習4 的 completedAt>",
      "completed": true,
      "synthetic": false,
      "inputMode": "voice",
      "experienceGap": false,
      "inducedFailure": {"type": "cancelled feedback operation while pending, then retried to success", "recovered": true}
    },
    {
      "recordId": "<練習5 的 recordId>",
      "snapshotId": "<練習5 的 snapshotId>",
      "category": "<練習5 實際選的類別>",
      "completedAt": "<練習5 的 completedAt>",
      "completed": true,
      "synthetic": false,
      "inputMode": "text",
      "experienceGap": false,
      "inducedFailure": null
    }
  ]
}
```

`experienceGap: true` 只標在練習 2（真的誠實承認沒經驗、給假設方案的那次）；`inducedFailure` 只標在練習 4（真的親眼觀察到取消與重試成功的那次），其他四筆維持 `null`。

**最後一步，也只有這一步，等你本人親自檢查過上面五筆記錄內容都真實無誤之後才做**：在檔案最上層填入

```json
"creator": "你的名字或代號",
"attestedAt": "填寫當下的 ISO8601 時間，例如 2026-09-23T12:00:00+08:00"
```

### 4.3 跑檢查

```sh
npm run evaluate -- --release
```

**預期輸出**：這次跑完，`creator` 這一關會 PASS（因為 ledger 已經有 5 筆、涵蓋 ≥2 個 snapshotId、≥2 個類別、至少一個 experienceGap、至少一個 inducedFailure，且 `creator`／`attestedAt` 都已填），但整體 `releaseStatus` 仍會是 `BLOCKED`，因為人工標註（human labels）跟獨立雙語語意審查（semantic review）這兩關本來就還沒做，屬於預期中會擋住的部分，不代表創作者驗收本身有問題。`blockers` 陣列裡不應該再出現「Creator five-loop real-use validation pending」。

## 5. 完成後告訴 Claude 什麼

五次都做完、`evaluation/v3/creator-validation.json` 也填完（含 `creator`／`attestedAt`）之後，回來跟 Claude 說「完成」，或直接貼 `.workspace/validation-notes.md` 的整體結論段落。接下來 Claude 會接手：跑 Codex 訂閱評估（`npm run evaluate -- --codex --accept-subscription-usage`）、安排 AI 語意審查（`v3` 的雙語一致性）、準備人工標註（human labels）所需的 review packet，這些都是創作者驗收以外的另外兩道關卡。

## 6. 疑難排解

- **回饋或產生題目失敗，訊息提到「isolation verification」或系統提示要跑 `codex:verify`**：這是 Codex 428（本機隔離驗證失效）。畫面上會顯示「Codex 需要重新完成本機隔離驗證：請在專案終端執行 npm run codex:verify，完成後再重試」。照做，完成後回到畫面重試原本那個操作即可，不用重貼 JD。
- **設定頁顯示「尚未完成 Codex 登入」，或操作失敗訊息是「請先到設定完成 Codex 登入與驗證」**：這是 401／未登入。終端機執行 `npm run codex:login` 完成登入，再回設定頁按「重新檢查狀態」。
- **操作卡在「進行中」很久，或錯誤訊息是「服務等待逾時。已保存的內容不受影響，請重試原操作。」**：屬於 timeout。已保存的回答不會不見，直接在題目頁按對應的「重試」按鈕（例如「重試取得回饋」）即可，不用重新輸入。
- **`npm run start:speech` 一啟動就報埠號被占用**：終端機會印出「127.0.0.1:4310 已經有服務在跑（PID xxxx），新的不會啟動。」並附上 `kill <PID>` 指令；先 kill 掉舊的行程，或改用 `PORT=4311 npm run start:speech` 換一個埠。
- **語音失敗，畫面在錄音區塊顯示原因**：
  - 「這段錄音沒有辨識到內容。可能是講話太小聲、麥克風選錯輸入來源，或這段其實沒有錄到聲音。建議重新錄一次，或改用文字。」→ 對應沒偵測到語音；可以先播放剛才的錄音預覽、看輸入音量再決定重錄或改文字。
  - 「這個瀏覽器錄出來的音訊格式不支援。請改用 Chrome 或 Safari，或改用文字回答。」→ 換瀏覽器再試。
  - 「語音服務回報這段音訊有問題。請看終端機的 [provider] 訊息了解原因，或重新錄一次。」→ 回終端機看 `[provider]` 開頭的訊息。
  - 錄音區塊本身失敗時也會給「重試語音轉錄」「重新錄音」「捨棄錄音，改用文字」這幾個選項，錄音檔在成功轉錄前都還留在頁面上，不會因為失敗就消失。
