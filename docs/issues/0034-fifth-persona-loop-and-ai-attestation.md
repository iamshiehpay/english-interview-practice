---
status: ready-for-agent
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

- [ ] The loop ran on the agent's own server with the real provider; 4310 and `.workspace/` were not touched (except the read-only JD file).
- [ ] The verification document exists and matches the ledger entry.
- [ ] The ledger has five persona loops, `creator: null`, and AI `attestedBy` / `attestedAt` set by a verifier that did not run the loop.
- [ ] The creator-status check passes in `"ai-persona"` mode (`npm run evaluate` shows the creator gate as AI-validated PASS).
- [ ] Defects found in the Common Questions are filed as new issues, not fixed silently here.

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
