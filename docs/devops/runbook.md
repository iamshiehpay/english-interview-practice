# Cloud Run demo runbook

This runbook covers the public synthetic demo only. The creator's local workspace and real providers are outside this deployment.

## First deployment

1. Put the full repository history on a public GitHub repository whose deployment branch is `main`.
2. Run `./scripts/setup-gcp.sh` from the repository root.
3. Review the bootstrap Terraform plan before answering `y`. Confirm the project id, GitHub repository, region, identities, USD 1 budget, state bucket, and Artifact Registry repository.
4. In the GitHub `production` environment, enable a required reviewer. Approve the workflow when the wizard opens it.
5. Open the reported `run.app` URL and verify that the public Demo warning appears. Do not enter personal information.
6. Record the URL, successful workflow run, dashboard screenshot, alert test, and rollback exercise in `docs/verification/` before calling the v0.9 deployment complete.

The setup wizard can be rerun. It keeps non-secret setup values in the ignored `.gcp-deploy.env` file and never creates a service-account key.

## Normal deployment

A successful `Checks` run for a push to `main` starts `deploy.yml`. The `production` environment pauses it for human approval. The workflow then:

1. authenticates with GitHub OIDC and Google Workload Identity Federation;
2. rebuilds and tests the exact commit;
3. pushes an image tagged with the Git SHA;
4. applies the Cloud Run and monitoring Terraform stack;
5. checks `/api/health` on the deployed URL.

If the smoke fails after a prior revision exists, the workflow sends all traffic back to that revision.

## Manual rollback

Set the shell values first:

```sh
PROJECT_ID=your-project-id
REGION=asia-east1
SERVICE=adaptive-english-interview-coach
```

List revisions and identify the last known good one:

```sh
gcloud run revisions list \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service "$SERVICE"
```

Move all traffic to it:

```sh
gcloud run services update-traffic "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --to-revisions "GOOD_REVISION=100"
```

Confirm `/api/health`, the home page warning, and `/api/providers`. Fix the failing commit and deploy it through the normal workflow; Terraform will restore traffic to the newest healthy revision.

## Demo is full

When all 50 workspaces have active requests, new visitors receive HTTP 503. Inactive workspaces are evicted automatically, and every workspace expires after one idle hour.

1. Check Cloud Run request count, latency, 5xx, and memory on the `Interview Coach public demo` dashboard.
2. Read only the structured lifecycle events. They contain event names, status or error codes, reasons, and aggregate session counts; they should contain no visitor content or cookie value.
3. Wait for active requests to finish. The gateway evicts the oldest inactive workspace for the next visitor.
4. If traffic is abusive or memory remains high, temporarily remove public invocation:

```sh
gcloud run services remove-iam-policy-binding "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --member allUsers \
  --role roles/run.invoker
```

Restore access after investigating by applying `infra/service` through the next approved deploy. Repeated capacity abuse is the recorded trigger for adding a rate-limiting edge layer.

## Availability, 5xx, or memory alert

1. Open Cloud Monitoring and identify which alert condition fired.
2. Check the uptime result and Cloud Run revision health before reading logs.
3. For a new bad revision, use the rollback procedure.
4. For memory over 80%, check session lifecycle counts and request volume. Visitor workspaces are bounded to 2 MB, but Cloud Run `/tmp` consumes instance memory.
5. For repeated unexplained 5xx errors, keep the last good revision serving and open a local issue with timestamps, revision name, aggregate metric evidence, and content-free error codes.

## Budget alert

A budget alert does not cap or stop spending.

1. Open Cloud Billing reports for this project and group the cost by service and SKU.
2. Check Cloud Run requests and network egress, Artifact Registry stored images, state bucket storage, and Monitoring charges.
3. Confirm Artifact Registry cleanup is deleting old versions and that Cloud Run still has `min_instance_count = 0` and `max_instance_count = 1`.
4. If charges must stop immediately, remove the public invoker binding using the command above. This stops public requests but does not remove stored images or Terraform state.
5. Record the billed SKU and amount. Add an edge cache only when measured egress or abuse meets the decision trigger in `docs/devops-discussion.md`.

Never put billing identifiers, access tokens, visitor data, `.workspace`, or provider credentials in an issue, workflow log, screenshot, or committed Terraform variables.
