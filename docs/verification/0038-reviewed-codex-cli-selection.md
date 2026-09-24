# Issue 0038 — select an already reviewed Codex CLI build

Date: 2026-09-24. This resolves executable compatibility for a **future, separately authorized** model run; it is not a new evaluation or a successful issue 0035 result.

The user's default `/Users/shiehpay/.local/bin/codex` resolves to Codex CLI 0.156.1. The current `verifiedBinary` guard rejects it with HTTP 503: `Codex executable does not match any reviewed macOS build`. This reproduces the cause recorded in [the failed issue 0035 attempt](0035-codex-evaluation-attempt.md).

An official standalone 0.155.1 release is already installed at:

```text
/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex
```

The adjacent `codex-package.json` reports `version: 0.155.1`, `target: aarch64-apple-darwin`, and `entrypoint: bin/codex`. Executing that file with `--version` reports `codex-cli 0.155.1`. `shasum -a 256` reports `8eaf1ad12fe6bf89b1710330f58900014322c7c5af677e43be116d8ac5fc0a9e`, exactly the previously reviewed 0.155.1 value in `src/codex-sandbox.js`. `verifiedBinary` accepted this absolute path; it rejected the current default CLI. No hash or version gate was changed.

Using a newly created, disposable `.coach-codex` profile with no credentials, `runtimeProfile({profile, binary: absolutePath})` passed the actual application preflight: executable hash, `--version`, effective feature flags, and the macOS sandbox positive and negative file/process probes. This was run with host permission because the outer tool sandbox cannot itself run nested `sandbox-exec` (`sandbox_apply: Operation not permitted`); the same probe passed under the approved host execution. The runtime returned `/usr/bin/sandbox-exec` as the App Server launcher. An App Server `initialize` / `initialized` handshake through that launcher then passed in the disposable profile. It made zero account, thread, turn, or model requests. The disposable profile and request directory were removed afterward.

`evaluation/run.js` passes `process.env.COACH_CODEX_BIN || 'codex'` to `CodexLanguageModel`; `src/cloud.js`, `scripts/codex-account.js`, and `scripts/codex-verify.js` support the same variable. For a future approved issue 0035 evaluation, set the binary for that one command rather than changing the global CLI:

```sh
COACH_CODEX_BIN=/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex npm run evaluate -- --codex --accept-subscription-usage
```

**Do not run the command under the original issue 0035 authorization:** its single allowed attempt was consumed. Before a new authorized run, recheck that the path exists and its SHA-256 still equals the reviewed value. The temporary preflight proves the binary and sandbox transport, not authentication, model availability, feedback quality, or evaluation gates. The existing issue 0035 failure record remains unchanged.

## Independent verification evidence

A separate `test-automator` repeated the checks from the repository root with host execution permission (required for nested `sandbox-exec`). It used no existing profile or credentials. The exact inline harness below exited 0; it sends only `initialize` and `initialized`, then closes its own process and removes its temporary directories. It does not execute the evaluation command above.

```sh
node --input-type=module -e 'import {verifiedBinary} from "./src/codex-sandbox.js"; import {runtimeProfile} from "./src/codex-profile.js"; import {CodexRPC} from "./src/codex-rpc.js"; import {mkdtemp,rm} from "node:fs/promises"; import {tmpdir} from "node:os"; import {join} from "node:path"; const path="/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex"; const root=await mkdtemp(join(tmpdir(),"coach-0038-independent-")); let runtime,rpc; try { const accepted=await verifiedBinary(path); let defaultRejected=false; try {await verifiedBinary("codex");} catch(e) {defaultRejected=e.status===503&&e.message.includes("does not match any reviewed");} if(!defaultRejected) throw Error("default binary was not rejected"); runtime=await runtimeProfile({profile:join(root,".coach-codex"),binary:path}); if(runtime.binary!=="/usr/bin/sandbox-exec") throw Error("runtime did not select sandbox"); rpc=new CodexRPC({binary:runtime.binary,args:runtime.args,cwd:runtime.cwd,env:runtime.env,timeoutMs:10000}); await runtime.register(rpc.child.pid); await rpc.request("initialize",{clientInfo:{name:"adaptive_interview_coach",version:"1.0.0"},capabilities:{experimentalApi:true}}); rpc.send({method:"initialized",params:{}}); console.log(JSON.stringify({accepted,defaultRejected,preflight:true,sandbox:runtime.binary,initialized:true,modelRequests:0})); } finally {if(rpc) await rpc.close(); if(runtime) await runtime.cleanup(); await rm(root,{recursive:true,force:true});}'
```

Captured stdout:

```json
{"accepted":"/Users/shiehpay/.codex/packages/standalone/releases/0.155.1-aarch64-apple-darwin/bin/codex","defaultRejected":true,"preflight":true,"sandbox":"/usr/bin/sandbox-exec","initialized":true,"modelRequests":0}
```

An independent `reviewer` confirmed the allowed reviewed-installation route, unchanged trust checks, and preserved authorization boundary. No production app access or full-model verification is claimed.
