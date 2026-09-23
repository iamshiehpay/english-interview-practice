# 下一批規劃：雲端部署與 DevOps

日期：2026-09-23。狀態：grill-with-docs 討論已於 2026-09-23 完成 Q1–Q10，尚未產生 ADR／PRD／issue；未列在「已確認決策」的選項不視為定案。

## 起點

- 專案主要目的是**求職作品集**；部署到雲端是為了把它做成一個可展示的 DevOps 專案。使用者於 2026-09-23 確認。
- 使用者指示「先完整整個專案」：MVP 驗證（issue 0008：創作者本人 5 次真實 Practice Loop、人工標註、雙語一致性、真實模型評估）排在部署之前。Cloudflare 放到最後再考慮。使用者於 2026-09-23 確認。
- 評估現況見 `portfolio/evaluation-v3-summary.md`：自動檢查 60/60 通過，但 MVP release 仍標示 BLOCKED。

## 現有實作對部署的限制

以下是 2026-09-23 從程式碼確認的事實，規劃必須面對，不能假設不存在。

- **本機優先是既有決策**：ADR 0008（本機執行、雲端模型可替換）與 ADR 0013（最少化且由本機掌控練習資料）。部署到雲端會改變產品邊界，依 `AGENTS.md` 須先寫新 ADR（暫定 0020）。
- **沒有登入機制**：服務假設只有一位受信任的本機使用者。直接公開到網路，任何人都能使用伺服器上的 API key，並讀取履歷、逐字稿與錄音。
- **儲存是單一 JSON 檔**：`.workspace/workspace.json`，以「寫入 .tmp 再 rename」保證原子性（`src/store.js`）；錄音另存於 `.workspace/recordings/`。只能單一行程、單一實例，需要持久化磁碟。無狀態平台（Cloud Run 類）與 FUSE 掛載的物件儲存不保證 rename 原子性，不適合。
- **Codex 訂閱只能在 macOS 執行**：`src/codex-sandbox.js:16` 強制 `process.platform==='darwin'`，靠 `sandbox-exec` 隔離。雲端 Linux 主機無法使用 Codex 訂閱，只能用 OpenAI／Claude API key 或 fake provider。
- **語音固定走 OpenAI API**：轉文字與朗讀在 `src/cloud.js:89`、`:92`，需要 `OPENAI_API_KEY`。使用者已有 OpenAI API key（2026-09-23）。
- **執行環境單純**：Node.js ≥22、零 npm 依賴、無打包步驟，容器化成本低。
- **Repo 現況**：本機只有 `ui-ux-practice-loop-refinements` 一條分支，沒有 `main`，沒有 remote。

## 討論中的起始方案

未定案，列出供逐項確認。

1. **Repo 就緒**：見已確認決策「GitHub repo」（`.env`、`.workspace/`、`.coach-codex/` 已在 `.gitignore`）。
2. **容器化**：多階段 Dockerfile、非 root、健康檢查端點、`WORKSPACE_DIR` 掛 volume。
3. **雲端只部署公開 Demo**（見已確認決策「部署對象」）：只用 fake provider，不接真實 API、不存個人資料，給面試官點開試用。私人站不上雲，本機 `npm start` 照舊。
   - 不做多使用者 SaaS（需要資料庫、帳號、加密，等於重寫並推翻 ADR 0008／0013）。
4. **CI／CD**：GitHub Actions，見已確認決策「CI／CD 範圍」（registry 改為 Artifact Registry）。
5. **託管**：只用 GCP Cloud Run（見已確認決策）；Cloudflare 邊緣層僅在觸發條件出現時才加。
6. **IaC**：Terraform（Google provider）。
7. **維運**：結構化 log、健康檢查與可用性監控、`workspace.json` 與錄音的定期備份。

## 已確認決策

- 專案定位：求職作品集。2026-09-23。
- 順序：先完成 MVP 驗證，再做部署；Cloudflare 最後考慮。2026-09-23。
- 練習用 Codex 預設改為 `gpt-5.6-luna`、reasoning effort `xhigh`，Codex 逾時提高到 180 秒。已實作於 `914c842`；server 原本拒絕超過 120 秒的逾時，上限改為 300 秒，修正於 `31badc4`。2026-09-23。
- Issue 0010–0021 狀態改為 `awaiting-human-validation`。已提交於 `94614ed`。2026-09-23。
- **部署對象**：雲端只放給面試官／招募者看的公開 Demo，免登入、隨時可開、不含個人資料、不花 API 費用；創作者本人的日常練習留在本機 Mac（使用 Codex 訂閱）。使用者於 2026-09-23 確認（「本來就是這樣」）。
- **Demo 資料隔離**：每位訪客一份獨立的暫存 workspace（以 cookie 區分 session），建立時複製一組種子資料（示範職缺與已完成的練習紀錄），閒置 1 小時自動刪除；頁面顯示「Demo 使用示範模型，請勿輸入真實個人資料」。種子資料先用 fake 模型產生。使用者於 2026-09-23 確認。這需要修改 server 依 session 選擇 store，屬於程式變更，須寫進 ADR 0020。
- **練習用模型維持 Codex 訂閱**：`gpt-5.6-luna`、xhigh、預設開 Fast 模式（service tier `priority`，1.5 倍速、較耗訂閱額度），已實作於 `27a1190`。合成 Practice Loop 從 118 秒降到 78 秒。2026-09-23。
- **不做 Claude 訂閱 provider（暫緩）**：2026-09-23 查證，Claude Agent SDK 文件仍寫明未經核准不得讓第三方產品提供 claude.ai 登入或訂閱額度；2026 年的計費調整已暫停，個人自用 `claude -p` 仍計入訂閱額度。本專案要公開為作品集，把訂閱登入做成功能不合適，且要重做與 Codex 同等的隔離。使用者表示「如果不行就保留 codex」。
- **託管：只用 GCP Cloud Run**。使用者於 2026-09-23 確認；Cloudflare 邊緣層原列為選配，同日討論後改為「有需要才加」。
  - Cloud Run 跑自建的 Docker image（不用 Buildpacks source deploy），`max-instances=1`；Demo 不需要持久化儲存，實例重啟即清空進行中的 Demo，可接受。
  - 訪客隔離在 app 內做（每個 session 一個暫存目錄），不依賴平台；Cloud Run 不保證 sticky routing。
  - Cloudflare 邊緣層（Worker 放在 Cloud Run 前面，負責網址、限流、Turnstile、靜態檔快取，不存 workspace）**暫不做**：多一個平台要多管帳號、權限、Terraform provider、state 與分散的 log，而在 Demo 規模下效益很小（egress 最壞約 $0.05／月且 gzip 可省大半；session 上限已擋住濫用；網址面試官只點一次）。作品集重點是每個元件都講得出存在理由。
  - 觸發條件（任一出現才加邊緣層）：billing budget 告警實際寄出（開始有 egress 費用）、出現濫用使 Demo 常態額滿、購買了網域。
  - 需要的程式變更：`src/server.js:762` 監聽位址寫死 `127.0.0.1`（ADR 0013 的刻意設計），改為 `HOST` 環境變數，本機預設不變，僅容器設 `0.0.0.0`；須寫進 ADR 0020。
  - 不選 Cloudflare Workers 改寫（方案 C）：`src/` 21 個檔案中 11 個使用 `node:fs`／`child_process`／`http`，要維護兩種執行環境並放棄零依賴；列為 DevOps 完成後的獨立架構延伸。`store.js` 抽成可替換介面的重構兩者共用。
- **CI／CD 範圍**（GitHub Actions）。使用者於 2026-09-23 確認。
  - PR／分支 push（只檢查）：`npm test`、`npm run evaluate`（fake provider）、`docker build` 後啟動容器打 `/api/health` smoke、Trivy 映像掃描、hadolint、`terraform fmt`／`validate`／`plan`（結果貼到 PR）。
  - 合併到 `main`（部署）：以上全部 → image 以 git SHA 為 tag 推 Artifact Registry → 以 Workload Identity Federation 部署 Cloud Run（GitHub 不存 GCP 金鑰）→ 對正式網址 smoke → 失敗自動把流量切回上一個 revision。
  - `terraform apply` 不自動執行，需在 GitHub Environment 手動核准。
  - 暫不納入：`test:browser`（需在 CI 安裝 agent-browser 與 Chromium，慢且易不穩定，先留本機）、真實模型評估（花錢、需金鑰，維持本機手動）。
- **GitHub repo**：公開；從目前 HEAD 建立 `main`，保留完整 47 個 commit 歷史（不 squash）；推送前以 gitleaks 掃描完整歷史內容；`main` 設保護（必須經 PR、CI 通過）；合併後刪除 `ui-ux-practice-loop-refinements`。使用者於 2026-09-23 確認。
  - Commit 作者 email 維持 `iamshiehpay@gmail.com`，不改寫歷史：該 email 已出現在使用者至少 4 個公開 repo，改寫換不到隱私且會改變所有 hash。若日後要隱藏，於帳號層級（全域 git 設定＋GitHub「Keep my email addresses private」）處理。使用者於 2026-09-23 接受建議。
  - 推送前由使用者自行確認 `docs/portfolio/demo.webm` 無不想公開的內容。
- **監控與告警**。使用者於 2026-09-23 確認。
  - 限制：Cloud Run 的 `/tmp` 是記憶體檔案系統，訪客 workspace 佔用實例 RAM；滿了會 OOM 重啟並清空所有進行中 Demo。
  - App 端（程式變更）：同時最多 50 個 Demo session，超過先淘汰最久未動者、全部活躍則回「Demo 目前額滿」；每個 workspace 上限 2 MB；log 改為帶 `severity` 的 JSON 行，只記 session 建立／過期／數量，不記使用者輸入。
  - GCP 端（Terraform）：uptime check 每 5 分鐘打 `/api/health`（已存在於 `src/server.js:89`）；email 告警：uptime 失敗、5xx 率 5 分鐘 >5%、記憶體 >80%；billing budget 超過 $0.01 通知；Dashboard（請求數、延遲、錯誤率、記憶體、Demo session 數）。
  - 不自架 Prometheus／Grafana。
- **成本目標：每月 $0**。使用者於 2026-09-23 確認。所有託管、監控、registry、state 儲存選擇須落在免費額度內；會產生費用的項目須先列出並經使用者同意。
- **地區與成本細節**（依 2026-09-23 查詢的 GCP 官方價目，由子代理整理，未逐條複核）。使用者於 2026-09-23 確認。
  - Cloud Run、Artifact Registry 放 `asia-east1`（台灣，延遲最低、同區拉 image 不計費）；Terraform state bucket 放 `us-central1`（Cloud Storage Always Free 僅限 us-west1／us-central1／us-east1）。
  - Artifact Registry 設清理規則，只保留最近 5 個 image（免費 0.5 GB）。
  - 唯一不確定的費用是 egress：Cloud Run 1 GB 免費流量文件寫「北美內」，台灣訪客流量可能計費，估最壞每月約 $0.05。緩解：server 回應加 gzip（程式變更）；若仍產生費用，觸發加 Cloudflare 邊緣層快取靜態檔。
  - Billing budget 門檻改為 $0.01（任何費用即通知）；budget 只通知、不會擋下費用。GCP 必須綁付款方式。
  - 告警政策目前免費，最快 2027-09-01 起每個指標每月 $0.35；2027-08 前重新評估（只留 uptime 告警或全關）。
  - 成本目標因此定義為「預期 $0，最壞每月幾分錢，任何費用立即通知」。真正保證 $0 只有 Cloudflare Workers（方案 C）。
- **網址與冷啟動**。使用者於 2026-09-23 確認。
  - 不買網域，使用 Cloud Run 預設的 `*.run.app` 網址，放在 README 與履歷連結。日後買網域約 $10／年，架構不需變動。
  - 接受冷啟動：`min-instances=0`，閒置縮到 0，第一位訪客等約 1 秒（零依賴，啟動快）。常駐一個實例約 $10+／月，違反成本目標。README 註明此取捨，作為可說明的成本決策。
- **版本與發布**。使用者於 2026-09-23 確認。
  - 每次合併 `main` 仍自動部署，image 以 git SHA 為 tag。
  - 里程碑由使用者手動打 semver tag；CI 將同一個已測試 image 加上版本 tag（不重建），並自動建立 GitHub Release，內容由 Conventional Commits 產生（feat／fix 分類）。
  - 不另維護 `CHANGELOG.md`，GitHub Release 即 changelog。
  - 版本意義綁定 MVP：首次上線打 `v0.9.0`（功能齊但 issue 0008 驗證未過）；創作者 5 次真實練習完成、評估解除 BLOCKED 後打 `v1.0.0`。
- **完成的定義**（達成即打 `v0.9.0`）。使用者於 2026-09-23 確認。每項都要有可查的證據：
  1. README 最上方有 Demo 網址與 CI badge。
  2. README 內有 Mermaid 架構圖（GitHub Actions → Artifact Registry → Cloud Run，含監控）。
  3. Dashboard 截圖。
  4. `infra/` 的 Terraform 能從零建出全部資源，`terraform plan` 無漂移。
  5. 刻意推一個會讓 smoke 失敗的版本，驗證 CI 自動 rollback，過程記錄於 `docs/verification/`。
  6. 觸發一次告警並確認 email 收到。
  7. Trivy 掃描無 HIGH／CRITICAL。
  8. ADR 0020：本機限定改為公開 Demo 的產品邊界變更。
  9. `docs/devops/runbook.md`：部署、rollback、Demo 額滿、budget 告警的處理。
  10. `docs/devops/cost.md`：逐項說明為何是 $0，及 2027 年告警收費的應對。
  - 明確不做：Kubernetes、staging／prod 多環境、Cloudflare（未達觸發條件）、真實模型的 Demo。

## 待討論問題

- 種子資料之後要不要換成真實模型跑出來的紀錄（fake 輸出的說服力較弱）？延後到 `v1.0.0` 之後再決定：屆時已有創作者的真實練習，可評估挑選去識別化的紀錄當種子。
