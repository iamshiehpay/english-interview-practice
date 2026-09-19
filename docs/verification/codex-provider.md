# Codex subscription provider verification

Status: independently accepted subscription text integration. Three-repeat quality evaluation passed; human creator/label gates remain open.

Scope authorized by creator: add official Codex/ChatGPT subscription authentication for question generation and text feedback; keep human-labelled evaluation and five creator loops as separate gates.

Read-only specification and test-plan agents reviewed provider/operation/evaluation code, issue0007/0008 criteria, official auth/App Server documentation and locally generated Codex0.154.0 protocol schemas. Main owns implementation.

Implemented: dedicated profile/official OAuth login, protocol adapter, structured schemas, minimal DTOs, fresh ephemeral processes, output bounds, timeout/abort cleanup, tool-event rejection, provider selector/status UI and separate opt-in subscription evaluation output.

Evidence so far:

- `npm test`:52/52, including protocol/API, stale audit, identity and path-scope tests; no live inference.
- Real installed CLI empty-thread inspection (no model turn) confirms ephemeral=true, path=null, empty instructionSources/workspace roots/environments, readOnly/no-network, expected model, explicitRequestOnly multi-agent mode, no active permission-profile override.
- Official browser login completed. Keyring access failed only inside the extra OS sandbox; after disclosure, a second official login completed using the dedicated plaintext0600 auth file, with no token copying/reading by the app. Sandboxed status now confirms authenticated=true.
- Effective-feature audit found `unified_exec` remains true despite disabling it. It is not credited as disabled. Compensating macOS file-content and fork/exec restrictions are enforced; exact binary hash is pinned, and positive/negative OS probes pass before every App Server/model/status session. All other requested deny flags report false, host skill discovery skip reports true.

Historical checkpoint before retention approval: synthetic verification and independent review were still pending. See the accepted result below.

Reviewer fixes: login executable bound to validated absolute path; exact binary read replaces parent-directory grant; login logs redirected to disposable directory and previous own login log removed without inspection; code checksum includes audit/sandbox; audit/status/path-boundary tests added. Initial automatic approval rejected an ambiguous home-read policy; static actual-path inspection plus synthetic OS probes established the narrower dedicated-profile boundary, and subsequent status probes were approved. No user-home-wide content access is granted.

Historical finding: the first live synthetic canary found temporary retention and correctly blocked readiness; runtime was removed, persistent profile had no sentinel. A subsequent synthetic request passed exact feedback and retention checks. Added per-request opaque-marker retention checks so readiness alone cannot bypass a later observed retention failure. Full creator/model quality gates remain pending.

Historical checkpoint before creator approval:52/52 automated tests pass after moving the opaque marker into the same `turn/start.input` JSON as the coaching context. Repeated live synthetic audit reproduced input in disposable `state/logs_2.sqlite-wal`; denying writes to this database prevents App Server initialization. Runtime cleanup completed; no real creator input was sent. Readiness remains blocked by the current audit contract. Awaiting the creator's explicit choice on temporary local retention before changing that contract. Independent reviewer confirms the existing requirements do not mandate zero temporary working-state bytes, but require private temporary storage, verified cleanup, persistent-profile exclusion and accurate disclosure.

## Accepted temporary retention and live evidence

Creator explicitly accepted temporary local diagnostics and requested cleanup/disclosure. The provider now uses a profile-specific private runtime root and unique0700 request directories. Each stores parent/child ownership metadata. Subsequent sessions remove only demonstrably inactive owned directories; live children, unknown ownership and malformed entries fail closed. Normal terminal paths await child exit, remove the full runtime and verify absence. Unknown/non-exiting processes retain files for safe recovery rather than deleting under a live process. Login also registers its child before awaiting exit. Power loss or forced parent termination can leave plaintext temporary data until recovery; deletion is not forensic erasure.

- `npm test`:55/55 PASS, including inactive/live/unknown-owner recovery and non-exiting child preservation.
- `npm run test:browser`:PASS complete fake-provider workflow.
- `npm run codex:verify`:PASS synthetic real subscription feedback, expected isolation settings, no observed tool use, persistent-profile marker exclusion and verified runtime deletion.
- `node scripts/codex-smoke.js --accept-subscription-usage`:PASS synthetic JD produced10 questions; two real feedback responses passed strict quote/schema validation; comparison and completed Focus Point persisted in a disposable HTTP workspace. This is not creator evidence.
- `node scripts/codex-cancel-smoke.js --accept-subscription-usage`:PASS cancellation after real turn/started; child PID no longer exists and runtime directory is absent.
- Three-repeat Codex evaluation:60/60 case runs pass;65 subscription calls (5 analyses +60 feedbacks),79/80 stable dimensions (98.75%), zero automatic failures. Human labels and five creator loops remain pending.

The previous zero-temporary-retention check was stricter than the supported CLI behavior. It was replaced following the explicit creator decision, not bypassed or represented as a zero-retention success. Both the README and provider UI disclose local transient text storage. Authentication stays separate from practice data.

Residual cleanup limit: if removal fails while the parent server is still alive, ownership checks conservatively preserve that directory; the request fails and restart/manual recovery is needed before scavenging retries. This is documented in README, not claimed as successful deletion. Independent reviewer reran55/55 tests; unknown/live owner preservation and login registration blockers are resolved.

Independent final reviewer: PASS all nine Issue0007 acceptance criteria under the creator-accepted temporary-storage model; no blocking defect remains. Reviewer independently ran55/55 tests and syntax checks. An additional root-permission/symlink rejection test passed afterward (three runtime tests total). Review distinguishes main-observed live evidence from independently executed offline tests. Issue0008 is still pending human labels, creator loops and the final live-quality result.

Final main regression:56/56 PASS, including runtime root permission/symlink rejection; browser smoke remains PASS.

Final temporary-state check after evaluation: zero runtime directories remain for the dedicated provider profile. Local app status reports authenticated=true, verified=true, ready=true. One measured unstable dimension is `ai-experience-depth / englishExpression` with levels4,2,4; aggregate stability still exceeds90%, and semantic correctness awaits human review. See [live report](../portfolio/codex-evaluation-summary.md).

Independent live-artifact review PASS: five valid frozen analyses,20 distinct review cases,60 feedbacks and unique case/repeat pairs, identical per-case questions/checksums,79/80 stability, source checksum match. No artifact defect. Issue0008 AC5 accepted; only human labels and five creator loops block release.
