# Issue 0042 verification: isolated Cloud Run demo

Date: 2026-09-29

## Automated evidence

- `npm test`: 277/277 tests pass, including public Host/same-origin behavior, direct loopback container review, secure cookie isolation, parallel capacity, one-hour idle semantics, storage quota rollback, process restart data loss, and unchanged local Host rejection.
- `npm run evaluate` in a clean `/tmp` repository copy: automatic evaluation passes with 80/80 stable dimensions. Release status remains `BLOCKED` by the existing semantic/label/live-quality gates.
- `docker build -t interview-coach:cloud-run-check .`: builds from the Node 22 Debian 13 distroless non-root image.
- Container smoke on an ephemeral host port: `/api/health` reports demo mode, `/` serves the public warning, `/api/providers` reports only fake providers, gzip works, and the configured user is `65532:65532`.
- Hadolint 2.15.1: passes.
- Trivy 0.74.0 with `--ignore-unfixed --severity HIGH,CRITICAL`: zero findings in the final image.
- Gitleaks 8.29.1: all 153 commits, including the deployment commit, contain no detected secret.
- Terraform 1.14.6 with Google provider 7.46.1: `fmt -check` and `validate` pass for `infra/bootstrap` and `infra/service`.
- `bash -n scripts/setup-gcp.sh`: passes; the repeatable wizard is executable. The GitHub workflow files parse as YAML.

## Boundaries checked

- The image contains the committed synthetic seed and excludes `.workspace`, `.coach-codex`, tests, evaluation artifacts, docs, local environment files, and Git metadata.
- Public mode constructs fake providers directly and ignores provider-selection environment variables.
- Health checks do not create a visitor session.
- Logs include only event type, error code/status, reason, and aggregate session count. They do not include cookie values or visitor content.
- GitHub deploys with Workload Identity Federation restricted to the configured repository and `main`; no service-account JSON key is created or stored.
- The deploy workflow runs only after successful `main` checks or a manually dispatched run, waits on the `production` environment, smokes the deployed URL, and restores traffic to the prior revision on failure.

## Human step still required

No GCP or GitHub resource was created during local verification. Run `./scripts/setup-gcp.sh`, inspect the Terraform plan, approve it, configure the `production` reviewer, and approve the first workflow deployment. Record the resulting `run.app` URL after its live smoke passes, then follow the [runbook](../devops/runbook.md) to capture the remaining production evidence.
