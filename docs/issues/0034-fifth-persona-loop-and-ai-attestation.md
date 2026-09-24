---
status: completed
---

# Fifth AI persona Practice Loop on the Common Questions, and AI attestation of the ledger

## Parent

[PRD — v1.0.0 readiness: job intake, common questions and the revised MVP gate](../prd-v1-readiness.md)

## User stories covered

42, 44

## Context

Under ADR 0020 (AI-validated v1.0.0) the creator gate needs five AI persona
Practice Loops; 0033 records four from the 2026-09-23 walkthrough. The fifth is
new and deliberately practises a Common Question, so the new feature gets one
real-provider check. The ledger is attested by the AI verifier; `creator` stays
null and nothing is signed in the creator's name.

## What to build

- Start an **own** server (another port, temporary `WORKSPACE_DIR`, real
  language-model provider — Codex — and fake speech), never touching 4310 or
  `.workspace/`.
- A persona agent plays a documented persona (reuse 林小安 from the walkthrough
  or write a new persona card first, background fixed, no invented experience)
  and, driving the UI with agent-browser in its own session, completes one full
  Practice Loop on the self-introduction or a common behavioural question for one
  of the validation JDs (read-only from `.workspace/validation-jds/`).
- Write a verification document in `docs/verification/` (persona card, steps,
  record id, observations, any defects found).
- Add the loop to the ledger (`synthetic: true`, `persona`, `evidence`, real
  record id and values from the temporary workspace), then have an independent
  verifier agent check all five ledger entries against their evidence and set
  `attestedBy` (its agent / model identity) and `attestedAt`.

## Acceptance criteria

- [x] The loop ran on the agent's own server with the real provider; 4310 and `.workspace/` were not touched (except the read-only JD file).
- [x] The verification document exists and matches the ledger entry.
- [x] The ledger has five persona loops, `creator: null`, and AI `attestedBy` / `attestedAt` set by a verifier that did not run the loop.
- [x] The creator-status check passes in `"ai-persona"` mode (`npm run evaluate` shows the creator gate as AI-validated PASS).
- [x] Defects found in the Common Questions are filed as new issues, not fixed silently here.

## Files likely touched

- `docs/verification/persona-common-questions-2026-*.md` (new)
- `evaluation/v3/creator-validation.json`

## How to verify

```sh
npm test
npm run evaluate
```

## Blocked by

- [Issue 0031](./0031-common-questions-self-introduction.md)
- [Issue 0032](./0032-common-behavioural-questions.md)
- [Issue 0033](./0033-adr-0020-revised-creator-gate.md)

## Comments

### 2026-09-24 — Blocked dependency; no live loop performed

- 0031 and 0032 completed, but required predecessor [0033](./0033-adr-0020-revised-creator-gate.md) is `needs-info` after three independent verification/review rounds and debugger confirmation. Its immutable backup does not preserve all provenance required by the literal acceptance criterion.
- The handoff requires every listed blocker to be completed before an issue starts. Accordingly no 0034 persona run, subscription calls, ledger fifth entry or AI attestation was performed. All acceptance items remain unchecked; this is a dependency disposition, not a claim that a practice attempt failed.
- Resume only after 0033 is resolved with authentic evidence or explicitly authorized evidence-source clarification. Keep `creator`, `attestedBy`, and `attestedAt` null meanwhile; no approval is attributed to the user.

### 2026-09-24 — Reopened after approved evidence clarification

The user explicitly approved continuing 0034, and 0033 has now passed independent verification under the approved cross-source rule. Dependencies 0031–0033 are completed. Proceed with a documented AI persona, the reviewed side-by-side Codex CLI and an isolated server; only a different verifier may attest the resulting five-loop ledger. Prior blocked-state notes above remain historical.

### 2026-09-24 — Completed with independent AI attestation

- `persona0034` documented 林小安 before the real Codex UI loop on isolated port 4334; completed the common self-introduction, feedback and Focus Point, then verified persistence after reload. Its server and browser session were closed. See [walkthrough and durable evidence](../verification/persona-common-questions-2026-09-24.md). No confirmed Common Question defect was found.
- Independent `attest0034` verified all five ledger entries against their source evidence, including the approved historical cross-source rule, and set its own AI identity and time. `creator` remains null. See [independent verification](../verification/0034-independent-ai-attestation.md).
- The initial full suite exposed an obsolete four-loop/null-attestation assertion (215/216). The original developer updated that assertion; independent rerun passed 216/216, focused reviewer tests 11/11, and `git diff --check` passed. Offline `npm run evaluate` passed 60/60 constraints, stability 80/80 and creator mode `ai-persona` (5/5).
- `review0031` reported Standards PASS and Spec PASS after the fix. Overall release remains BLOCKED pending 0035/0036; this is AI persona evidence using fake speech, not human or real-speech validation.
