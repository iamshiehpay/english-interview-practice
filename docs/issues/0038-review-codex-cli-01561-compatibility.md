---
status: needs-triage
---

# Review Codex CLI 0.156.1 compatibility before future model runs

## Context

Issue 0035's sole authorized v3 run failed before inference because the installed CLI is 0.156.1 and `src/codex-sandbox.js` recognizes reviewed executable hashes for 0.154.0 and 0.155.1 only. See the [attempt evidence](../verification/0035-codex-evaluation-attempt.md).

## Proposed scope

Review the installed build's sandbox/transport compatibility and add supported-build evidence and tests through the existing security review process, or explicitly select an already reviewed compatible installation. Do not blindly add a hash, bypass verification, or change the user's running server. Any `src/codex-*.js` change requires `npm run codex:verify`.

## Authorization boundary

Fixing compatibility does not authorize another evaluation. The 0035 one-shot allowance has been consumed by the failed invocation; a new live evaluation requires fresh explicit authorization.

## Comments

2026-09-24: Filed by coordinating AI after independent verifier and reviewer confirmed the failure. No binary, hash allowlist, or model contract was changed.
