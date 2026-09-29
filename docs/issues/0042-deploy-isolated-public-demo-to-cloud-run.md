---
status: ready-for-human
---

# Deploy an isolated public demo to Cloud Run

## Context

The application is deliberately local-first and currently binds to loopback, rejects a public Host and serves one Local Workspace to every request. The creator has chosen a separate public portfolio demo on Google Cloud Run under [ADR 0021](../adr/0021-host-an-isolated-public-demo-on-cloud-run.md). It must not expose the creator's practice data, provider credentials or one visitor's input to another visitor. The official v1.0.0 evaluation remains independently blocked.

## Scope

- Add a deployment mode that listens on Cloud Run's injected port and public interface while leaving local startup loopback-only.
- Put cookie selection, same-origin validation, synthetic seed copying, one-hour expiry, bounded session eviction and per-workspace storage limits behind one Demo Workspace Gateway interface.
- Force fake language, speech and job providers in the public demo, regardless of provider variables in the environment.
- Label the interface as a temporary synthetic demo and warn visitors not to enter personal data.
- Build a non-root Node 22 container and verify health, static assets, isolation, restart semantics and size limits without using port 4310 or real practice data.
- Add Terraform for Artifact Registry, Cloud Run, Workload Identity Federation, monitoring and a project budget; keep `min=0`, normally `max=1`, `asia-east1`, and no service-account key.
- Add GitHub Actions checks and a manually approved production deployment path with a post-deploy smoke and rollback behavior.
- Add a repeatable setup wizard after the workflow variable names are fixed. Do not put a billing id, password, API key or service-account JSON key in the repository or GitHub variables; keep the bootstrap Terraform state private because it necessarily records managed resource identifiers.

## Acceptance criteria

- A public Host and its matching HTTPS Origin reach the demo; a cross-origin API request is rejected. Local mode still rejects non-local Hosts and binds to loopback by default.
- Two clients receive different HttpOnly, Secure, SameSite cookies and cannot read, change, delete or replay each other's workspace or recordings.
- A new visitor receives only committed synthetic seed data. An idle workspace expires after one hour; at most fifty sessions and 2 MB per workspace are retained. Logs contain event type and counts, never visitor content or the cookie value.
- Health checks do not allocate a session. A full instance restart discards demo state by design.
- Public mode cannot select Codex, OpenAI, Claude or external job providers and exposes no provider secret.
- Tests, offline evaluation, container smoke, Terraform validation and deployment documentation pass. The deployment is labelled v0.9 demo evidence and does not claim that the v1.0.0 model-quality gate passed.

## Blocked by

None for implementation. Creating external GCP and GitHub resources requires the creator's project id, repository identity, authenticated CLI sessions and approval of the concrete Terraform plan.

## Comments

2026-09-29: The creator chose to continue Cloud Run deployment after reviewing the release and hosting blockers. Official Google documentation was rechecked for the container contract, Artifact Registry, Workload Identity Federation and budget behavior. No external resource has been created yet.

2026-09-29: Implementation and local verification are complete. The demo gateway isolates cookie-selected temporary workspaces, forces fake providers, expires and caps sessions, enforces a 2 MB quota, and discards state on restart. The distroless non-root container, Terraform bootstrap/service stacks, monitoring, budget, GitHub OIDC workflows, rollback path, synthetic seed, setup wizard, [runbook](../devops/runbook.md), and [cost model](../devops/cost.md) are ready. See [verification](../verification/0042-cloud-run-demo.md). The remaining step is human review of the concrete Terraform plan and creation of external GCP/GitHub resources through `./scripts/setup-gcp.sh`.

2026-09-29: The first approved bootstrap apply partially succeeded and its state is healthy. It created APIs, Artifact Registry, the state bucket, identities and IAM, the WIF pool, and the email channel, then exposed two missing deployment contracts: the repository-derived WIF provider display name was 43 characters while GCP permits 32, and local ADC did not assign the selected project as its quota project before the Budget API call. The display name is now fixed and short; the wizard now runs `gcloud auth application-default set-quota-project` after project selection. Two regression tests reproduce both failures and the full 279-test suite passes. Rerunning the wizard will reuse the recorded resources and complete the missing provider and budget before configuring GitHub and deploying Cloud Run.

2026-09-29: The second bootstrap apply created the WIF provider, but the Budget API request still used an unrelated quota consumer even though ADC named the selected project and `billingbudgets.googleapis.com` was enabled there. Google provider 7.x requires user ADC budget requests to set both `billing_project` and `user_project_override`; the bootstrap provider now sends the selected project through `X-Goog-User-Project`. A regression test covers this provider contract. The next wizard run should plan only the remaining budget resource before continuing with GitHub variables and the first deployment.
