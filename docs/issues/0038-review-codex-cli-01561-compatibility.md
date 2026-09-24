---
status: completed
---

# Select a reviewed Codex CLI for future evaluation runs

## Context

Issue 0035's sole authorized v3 run failed before inference because the installed CLI is 0.156.1 and `src/codex-sandbox.js` recognizes reviewed executable hashes for 0.154.0 and 0.155.1 only. See the [attempt evidence](../verification/0035-codex-evaluation-attempt.md).

## Proposed scope

Review the installed build's sandbox/transport compatibility and add supported-build evidence and tests through the existing security review process, or explicitly select an already reviewed compatible installation. Do not blindly add a hash, bypass verification, or change the user's running server. Any `src/codex-*.js` change requires `npm run codex:verify`.

## Authorization boundary

Fixing compatibility does not authorize another evaluation. The 0035 one-shot allowance has been consumed by the failed invocation; a new live evaluation requires fresh explicit authorization.

## Comments

2026-09-24: Filed by coordinating AI after independent verifier and reviewer confirmed the failure. No binary, hash allowlist, or model contract was changed.

2026-09-24: Resolved by selecting the already reviewed, locally installed official Codex CLI 0.155.1 build through `COACH_CODEX_BIN`. Its executable SHA-256 exactly matches the existing approved hash. A disposable, unauthenticated profile passed the application runtime's version, feature and macOS sandbox checks, followed by an initialize-only App Server handshake. See [verification](../verification/0038-reviewed-codex-cli-selection.md) for commands and evidence. No global CLI link or application source was changed. This does not authorize or perform another issue 0035 evaluation.

Independent `test-automator` repeated the no-inference checks successfully, and `reviewer` returned Standards PASS / Spec PASS. The original 0.156.1 build remains unsupported; this resolution explicitly selects the already reviewed side-by-side installation.
