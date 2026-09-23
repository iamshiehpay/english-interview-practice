# 下一批規劃：雲端部署與 DevOps

日期：2026-09-23。狀態：使用者要求以 grill-with-docs 討論，尚未產生 ADR／PRD／issue，未確認的選項不視為定案。

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
5. **託管**：GCP Cloud Run ＋ 選配 Cloudflare Worker 邊緣層（見已確認決策）。
6. **IaC**：Terraform（Google provider；邊緣層加 Cloudflare provider）。
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
- **託管：GCP Cloud Run（主）＋ Cloudflare Worker 邊緣層（選配、最後階段）**。使用者於 2026-09-23 確認。
  - Cloud Run 跑自建的 Docker image（不用 Buildpacks source deploy），`max-instances=1`；Demo 不需要持久化儲存，實例重啟即清空進行中的 Demo，可接受。
  - 訪客隔離在 app 內做（每個 session 一個暫存目錄），不依賴平台；Cloud Run 不保證 sticky routing。
  - Cloudflare Worker 放在 Cloud Run 前面，負責自訂網域、限流、Turnstile 防濫用、靜態檔快取；不存 workspace。拿掉不影響主架構。
  - 需要的程式變更：`src/server.js:762` 監聽位址寫死 `127.0.0.1`（ADR 0013 的刻意設計），改為 `HOST` 環境變數，本機預設不變，僅容器設 `0.0.0.0`；須寫進 ADR 0020。
  - 不選 Cloudflare Workers 改寫（方案 C）：`src/` 21 個檔案中 11 個使用 `node:fs`／`child_process`／`http`，要維護兩種執行環境並放棄零依賴；列為 DevOps 完成後的獨立架構延伸。`store.js` 抽成可替換介面的重構兩者共用。
- **CI／CD 範圍**（GitHub Actions）。使用者於 2026-09-23 確認。
  - PR／分支 push（只檢查）：`npm test`、`npm run evaluate`（fake provider）、`docker build` 後啟動容器打 `/api/providers` smoke、Trivy 映像掃描、hadolint、`terraform fmt`／`validate`／`plan`（結果貼到 PR）。
  - 合併到 `main`（部署）：以上全部 → image 以 git SHA 為 tag 推 Artifact Registry → 以 Workload Identity Federation 部署 Cloud Run（GitHub 不存 GCP 金鑰）→ 對正式網址 smoke → 失敗自動把流量切回上一個 revision。
  - `terraform apply` 不自動執行，需在 GitHub Environment 手動核准。
  - 暫不納入：`test:browser`（需在 CI 安裝 agent-browser 與 Chromium，慢且易不穩定，先留本機）、真實模型評估（花錢、需金鑰，維持本機手動）。
- **GitHub repo**：公開；從目前 HEAD 建立 `main`，保留完整 47 個 commit 歷史（不 squash）；推送前以 gitleaks 掃描完整歷史內容；`main` 設保護（必須經 PR、CI 通過）；合併後刪除 `ui-ux-practice-loop-refinements`。使用者於 2026-09-23 確認。
  - Commit 作者 email 維持 `iamshiehpay@gmail.com`，不改寫歷史：該 email 已出現在使用者至少 4 個公開 repo，改寫換不到隱私且會改變所有 hash。若日後要隱藏，於帳號層級（全域 git 設定＋GitHub「Keep my email addresses private」）處理。使用者於 2026-09-23 接受建議。
  - 推送前由使用者自行確認 `docs/portfolio/demo.webm` 無不想公開的內容。

## 待討論問題

- 種子資料之後要不要換成真實模型跑出來的紀錄（fake 輸出的說服力較弱）？
- 每月預算上限？是否購買網域？
- 服務需要 24 小時在線嗎？
- 完成的定義是什麼：能展示哪些 DevOps 成果（CI badge、IaC、監控截圖、架構圖、runbook）才算做完？
- 版本與發布策略：tag、changelog、image 版本號。
