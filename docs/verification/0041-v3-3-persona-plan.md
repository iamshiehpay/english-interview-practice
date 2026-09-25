# Contract 3.3 AI-persona acceptance plan (frozen before live practice)

This plan is for a **new contract 3.3 evidence set** applying ADR 0020's substantive AI-persona Practice Loop criteria. ADR 0020 specifically assigned the older 2026-09-23 loops 2–5 and one Common Question to the v3.0 ledger; those historical records remain there and are not relabeled as contract 3.3. These five additional loops do not change the frozen contract 3.3 evaluation outputs, approved scoring labels, or release thresholds. The existing label and bilingual failures still block release even if these loops pass.

## Fixed synthetic persona

**林小安** is a Taipei backend engineer with about three years at a medium-sized e-commerce company. Her tools are Python, FastAPI, PostgreSQL and Redis, with a little Node.js. She has made an internal RAG FAQ bot using LangChain and pgvector and manually checked it against a 50-question spreadsheet. She has used OpenAI function calling. She has **not** built payment APIs, fine-tuned models, used reinforcement learning, Neo4j or Kubernetes. Her Docker experience is basic and her English is intermediate. She cannot claim deployments, performance gains, project ownership, incident details or business metrics absent from this card. If a question asks for such experience, she must say what she has not done and explain a plausible approach or adjacent work as hypothetical, without presenting it as a result.

## Five planned UI loops

Use only the existing synthetic `backend` and `ai` job descriptions in `evaluation/v1/manifest.json`, pasted into the real local app UI. The browser drives the app; no record, analysis or feedback API is called directly to manufacture evidence. All answers use text, with fake speech configured and unused. Select a generated question matching each category and the stated topic; record the exact question and answer in the walkthrough before interpreting feedback.

| Loop | Snapshot | Question category | Answer boundary / observation |
| --- | --- | --- | --- |
| 1 | Backend | `role-fit` | State relevant FastAPI/PostgreSQL experience and explicitly disclose the payment-API experience gap. Check whether feedback handles the honest gap without asking for fabrication. |
| 2 | Backend | `behavioral` | Discuss how she would collaborate on an incident review without inventing a specific past incident or outcome. Check JD grounding. |
| 3 | Backend | `experience-depth` | Describe only supported database/testing experience; disclose unavailable project details. Cancel the pending feedback operation through the UI, then retry it and check that the answer and record survive. |
| 4 | AI | `technical-communication` | Explain the internal RAG FAQ and its limited 50-question manual check. Distinguish that from formal model evaluation or fine-tuning. |
| 5 | AI | `role-fit` | Connect backend work to Python inference-service tasks without claiming a production AI deployment. Save a concrete Focus Point, reload the browser, and verify the completed record and Focus Point. |

The question sets are model-generated, so choose the closest question in the required category and keep the answer within the card. If the set lacks a suitable question, stop that loop and document the limitation rather than changing the persona or fabricating a fit. A full loop is question selection → answer → real Codex feedback → finish and save → completed Practice Record.

## Isolation, usage and evidence

Run `scripts/persona-acceptance.js` with the reviewed Codex binary, the existing verified `.coach-codex` profile, fake speech, **one explicit temporary `PERSONA_WORKSPACE_DIR` reused on every restart**, and an ephemeral loopback port. The launcher refuses port 4310, never opens the real `.workspace`, and atomically creates a numbered directory under `persona-model-attempts/` before each model request, even across processes. A separate fake-provider browser rehearsal precedes live use and does not count toward acceptance. The live run requires `--accept-subscription-usage` and an explicit request cap. Target operations are two analyses, five successful feedback calls, five automatically requested key-sentence corrections, and one intentionally cancelled feedback attempt; validation retries or failures consume the same cap. The proposed hard cap is **28 new Codex subscription requests**. Only actual reservations count, and any unused allowance is not spent. This is a new budget separate from the exhausted 66/66 contract 3.3 evaluation budget.

The designated empty live workspace is `/private/var/folders/lc/z_86_zqs0rn4gm3vtjfrfsjr0000gn/T/coach-v33-persona-0041-6NQB75`. Use this exact path if restarting; never create another workspace for the same approved run. The prepared launch command, **to be used only after model-usage approval**, is:

```sh
COACH_LANGUAGE_PROVIDER=codex COACH_SPEECH_PROVIDER=fake \
COACH_CODEX_BIN=/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex \
PERSONA_WORKSPACE_DIR=/private/var/folders/lc/z_86_zqs0rn4gm3vtjfrfsjr0000gn/T/coach-v33-persona-0041-6NQB75 \
PERSONA_MODEL_REQUEST_CAP=28 \
node scripts/persona-acceptance.js --accept-subscription-usage
```

For each loop, save the browser steps, provider operation receipts, exact record/snapshot IDs, category, timestamps, text-input mode, persona claims, and observed quote/translation/JD-grounding issues in a new `docs/verification/` walkthrough. Preserve a sanitized copy of the synthetic temporary workspace, the model-attempt slots, and evidence screenshots. Each resulting ledger entry must have `completed: true`, `synthetic: true`, `inputMode: "text"`, `persona: "林小安"`, and a `docs/verification/` evidence path, as well as the actual record/snapshot/category/completion data. Then ask an independent AI reviewer to verify the five walkthroughs against the records and sign `evaluation/v3-3/creator-validation.json` as `ai-persona`, with `creator: null`. No attestation is written before that check. Finally rerun the offline evaluation report to distinguish the persona gate from the already failed label and bilingual release gates.

## Pre-approval rehearsal and readiness

On 2026-09-25, a dedicated `agent-browser` session completed one fake-provider UI loop using the synthetic Backend fixture on ephemeral port `58603`. The temporary workspace at `/private/var/folders/lc/z_86_zqs0rn4gm3vtjfrfsjr0000gn/T/coach-v33-persona-VMMVN3` holds completed record `616a7a19-8009-41ba-b1e7-fe1bf6cc2c80`; operation receipts show successful `analysis`, `feedback` and automatically loaded `corrections`. This rehearsal is **not** one of the five real-provider acceptance loops. The browser session and its server were closed by their own identifiers. The reviewed standalone Codex CLI reported `authenticated: true`, `verified: true`, `ready: true` through the account/status path, which made no model turn. No new subscription model request has been made for persona acceptance.
