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

1. **Repo 就緒**：建立 `main`、推上 GitHub；推送前掃描機密（`.env`、`.workspace/`、`.coach-codex/` 已在 `.gitignore`）。
2. **容器化**：多階段 Dockerfile、非 root、健康檢查端點、`WORKSPACE_DIR` 掛 volume。
3. **雲端只部署公開 Demo**（見已確認決策「部署對象」）：只用 fake provider，不接真實 API、不存個人資料，給面試官點開試用。私人站不上雲，本機 `npm start` 照舊。
   - 不做多使用者 SaaS（需要資料庫、帳號、加密，等於重寫並推翻 ADR 0008／0013）。
4. **CI／CD**：GitHub Actions — 測試 → 建 image → 推 GHCR → 部署；IaC 變更跑 `plan`。
5. **託管候選**（待決）：
   - Cloudflare Tunnel + Access：app 留在本機 Mac，保留 Codex 訂閱；免費；Mac 關機即離線；正式網址需要 Cloudflare 上的網域。
   - 免費或小型 VM（Oracle Cloud Always Free、AWS Lightsail／EC2、GCP e2）＋ Docker ＋ Caddy：24 小時在線，但無法用 Codex 訂閱。
   - Fly.io ＋ volume。
6. **IaC**：Terraform（依託管選擇用 Cloudflare 或雲端 provider）。
7. **維運**：結構化 log、健康檢查與可用性監控、`workspace.json` 與錄音的定期備份。

## 已確認決策

- 專案定位：求職作品集。2026-09-23。
- 順序：先完成 MVP 驗證，再做部署；Cloudflare 最後考慮。2026-09-23。
- 練習用 Codex 預設改為 `gpt-5.6-luna`、reasoning effort `xhigh`，Codex 逾時提高到 180 秒。已實作於 `914c842`。2026-09-23。
- Issue 0010–0021 狀態改為 `awaiting-human-validation`。已提交於 `94614ed`。2026-09-23。
- **部署對象**：雲端只放給面試官／招募者看的公開 Demo，免登入、隨時可開、不含個人資料、不花 API 費用；創作者本人的日常練習留在本機 Mac（使用 Codex 訂閱）。使用者於 2026-09-23 確認（「本來就是這樣」）。

## 待討論問題

- 作品集想展示哪個雲端平台的能力（AWS／GCP／Cloudflare）？這會決定託管與 IaC 選擇。
- 公開 Demo 的資料：fake provider 的示範輸出夠不夠說服面試官？是否需要預先放一組「真實模型跑過的」唯讀示範紀錄？
- 每月預算上限？是否購買網域？
- 服務需要 24 小時在線嗎？
- 完成的定義是什麼：能展示哪些 DevOps 成果（CI badge、IaC、監控截圖、架構圖、runbook）才算做完？
- 版本與發布策略：tag、changelog、image 版本號。
