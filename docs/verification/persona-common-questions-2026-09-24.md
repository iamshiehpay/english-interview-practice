# AI persona Common Question Practice Loop — 2026-09-24

## Persona card (fixed before the session)

**林小安** is a Taipei-based backend engineer with about three years of experience at a medium-sized e-commerce company. Her work uses Python, FastAPI, PostgreSQL, Redis and some Node.js. She has built an internal RAG FAQ bot with LangChain and pgvector, and checked it manually against a spreadsheet of 50 questions. She has used OpenAI function calling. She has not fine-tuned models, used reinforcement learning, Neo4j or Kubernetes. Her Docker experience is basic; her English is intermediate. Answers may contain small natural English errors. She must not claim any additional projects, metrics, leadership, production deployments or tools that this card does not establish.

## Planned isolated run

- Job: validation JD 05, Ubitus Junior AI Engineer, read-only source `.workspace/validation-jds/05-ubitus-junior-ai-engineer.txt`.
- Question: the app-authored Common Question “Tell me about yourself.”, category `role-fit`.
- Input: written answer; speech provider configured `fake` but not used.
- Provider: real Codex language provider via the reviewed standalone CLI.
- Browser: `agent-browser` in a dedicated session. The app runs on its own port and temporary `WORKSPACE_DIR`.
- Completion: submit answer, inspect bilingual feedback, optionally revise only if the feedback supports a factual revision, save a Focus Point, reload and verify the completed Practice Record.

## Execution and evidence

The card above was written before any browser practice or model call. The run
used `PORT=4334`, `WORKSPACE_DIR=/private/tmp/coach-0034-persona-QvO61F/workspace`,
`COACH_LANGUAGE_PROVIDER=codex`, `COACH_SPEECH_PROVIDER=fake`, and the reviewed
standalone Codex `0.155.1` binary selected with `COACH_CODEX_BIN`.
The isolated browser session was `persona-0034`. Its provider banner identified
`Codex / ChatGPT subscription / gpt-5.6-luna / xhigh / fast` and fake speech.
The app on 4310 was never called or managed. The only access to the real
`.workspace/` was reading JD 05; its first line was changed **in the browser
input only** to the job title and company.

| UTC time, 2026-09-24 | UI step and observation |
| --- | --- |
| 06:45:55 | Pasted JD 05 on the own server and activated “儲存職缺並產生題目”; snapshot `5efe3008-7a80-4e41-9fc2-35289c2985e3` was saved. |
| 06:47:09 | Real Codex analysis operation succeeded. “查看全部題目” showed the pinned, app-authored “Tell me about yourself.” as a fixed Common Question, separate from the job-grounded questions. [Question Set screenshot](persona-common-questions-2026-09-24/question-set.png). |
| 06:49:57 | Selected that question and started a written Practice Loop; record `88e911ee-047a-4d19-98cc-05a904118e0f` was created. |
| 06:50:58 | Submitted one answer confined to the fixed persona card. [Answer before submission](persona-common-questions-2026-09-24/answer-before-submit.png). It mentioned three years of backend work, the internal LangChain/pgvector RAG FAQ, manual checking with 50 questions, and disclosed absent fine-tuning/Kubernetes experience. |
| 06:51:14 | Real Codex feedback succeeded. The UI showed bilingual strength and priority improvement with quotations from this answer, and ratings of relevance 4/4, support 3/4, structure 4/4, and English expression 4/4. It suggested a more specific account of the RAG bot's purpose and role fit **if the persona had that information**; it did not assert an invented outcome. [Feedback screenshot](persona-common-questions-2026-09-24/feedback.png). |
| 06:51:19 | The optional key-sentence correction operation succeeded and returned no corrections. |
| 06:52:18 | Set the Focus Point to “下次自介說清楚內部 RAG FAQ 的用途及 50 題人工核對方式，並具體連結這個職位的企業 AI 應用；不補造未有的成果或部署經驗。” and activated “結束並保存”. The record became `completed` with one text attempt and no follow-ups. [Completed view](persona-common-questions-2026-09-24/completed.png). |

Revision and follow-up are optional in this Practice Loop. I did not add them
because the feedback did not establish any additional outcome or experience
that the persona could truthfully supply. After reloading the browser, the
homepage displayed the saved Focus Point, the [practice history](persona-common-questions-2026-09-24/history-after-reload.png)
showed one completed main-question practice for JD 05, and [My Progress](persona-common-questions-2026-09-24/progress-after-reload.png)
showed the same Focus Point as a single-practice focus.

The [sanitized, durable workspace copy](persona-common-questions-2026-09-24/workspace.json)
contains only this synthetic JD, analysis, record and operation receipts. It
has no auth profile or token fields. Its top-level keys are `version`,
`snapshots`, `analyses`, `records`, `operations`, and `operationReceipts`.
All three stored real-provider operations (`analysis`, `feedback`, and
`corrections`) have `state: succeeded` and `attempt: 1`; these receipts prove
three successful provider-backed operations. The number of underlying Codex
subscription turns is not separately exposed by this workspace format.

Two initial pointer clicks on the home form's submit control and one pointer
click on the answer submit control did not appear to send a request; focusing
the same controls and pressing Enter did. Subsequent pointer clicks (question
selection, start, completion, navigation) worked. This was not reproduced as
a consistent Common Question defect, and no product defect was confirmed in
this run. The keyboard route was part of the actual UI, not an API shortcut.
