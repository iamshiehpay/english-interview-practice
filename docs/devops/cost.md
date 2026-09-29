# Cloud Run demo cost model

Checked against Google Cloud's published pricing on 2026-09-29. Prices are USD and can change. Free usage is usually aggregated across all projects on the same billing account, so this project cannot guarantee a zero bill by itself.

## Expected monthly cost

The target is **USD 0**. The monthly budget uses one unit of the billing account's currency, with notifications at 1%, 50%, and 100%. For the current TWD account, those thresholds are approximately TWD 0.01, TWD 0.50, and TWD 1.00. The budget sends alerts; it does not cap usage or stop resources.

| Service | Configuration | Free allowance and remaining risk |
| --- | --- | --- |
| Cloud Run | `asia-east1`, request-based billing, 1 vCPU, 512 MiB, min 0, max 1 | The request-based free tier includes 180,000 vCPU-seconds, 360,000 GiB-seconds, and 2 million requests per billing account each month. Idle scale-to-zero time is not billed as an active instance. Startup, request handling, and shutdown consume the allowance. Traffic can exceed it. |
| Artifact Registry | Regional Docker repository with cleanup rules | The first 0.5 GiB-month of storage per billing account is free. Older images are deleted after 30 days while the ten most recent versions are retained. Storage over the allowance is billed; same-region pulls to Cloud Run are free. |
| Terraform state | Versioned Standard GCS bucket in `us-central1` | Cloud Storage Always Free includes 5 GB-month Standard storage plus bounded operations in `us-west1`, `us-central1`, and `us-east1`, aggregated across those regions. Version history is limited to ten archived versions. Existing account usage can consume the allowance. |
| Monitoring and Logging | Built-in Cloud Run metrics, one content-free session-count log metric, dashboard, uptime check, three alert policies | Google Cloud metrics are non-chargeable. The user-defined GAUGE metric is metered at 8 bytes per scalar point and shares a 150 MiB monthly Monitoring allowance per billing account before ingestion charges. Its source logs separately share Cloud Logging's first 50 GiB per project each month; deriving the metric does not duplicate the log entry. Uptime checks include 1 million regional executions per project each month; this five-minute check is expected to stay below that allowance, subject to its actual checker regions. Alerting charges are announced for no earlier than 2027-09-01, so pricing must be reviewed before then. External API metric queries can be billed after their own allowance. |
| Billing budget | One billing-currency-unit budget with email notification | The Cloud Billing Budget API is free. Email and cost data can arrive hours after usage. Pub/Sub budget notifications are not enabled. |
| Network | Public HTTPS responses | Ingress and same-region Google Cloud transfer are free. Cloud Run's internet egress free tier is limited to eligible North America traffic and must not be assumed for a Taiwan service. Public response bytes can therefore create a small charge. Static text is gzip-compressed to reduce it. |

Enabling an API has no separate enablement fee listed by Google, but calls and resources provided by that API can be billed. Enabling the required APIs therefore does not make the deployment itself free.

## Cost controls in this repository

- Cloud Run scales to zero and cannot exceed one instance.
- Every anonymous workspace is capped at 2 MB; at most 50 exist in one instance and idle workspaces expire after one hour.
- Only synthetic local providers run, so there is no model or speech API usage.
- Artifact Registry and GCS delete old versions within explicit retention limits.
- The image is pulled from Artifact Registry in the same region as Cloud Run.
- Static text assets use gzip when the client accepts it.
- The first budget threshold is 1% of one billing-account currency unit.

These controls bound common sources of spend but do not create a hard billing cap. Follow the [runbook](runbook.md) as soon as a budget notification arrives.

## Sources

- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud Run billing settings](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
- [Artifact Registry pricing](https://cloud.google.com/artifact-registry/pricing)
- [Cloud Storage pricing and Always Free regions](https://cloud.google.com/storage/pricing#storage-pricing)
- [Google Cloud Observability pricing](https://cloud.google.com/products/observability/pricing)
- [Log-based metric costs](https://docs.cloud.google.com/logging/docs/logs-based-metrics/costs)
- [Cloud Run monitoring](https://docs.cloud.google.com/run/docs/monitoring)
- [Cloud Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Cloud Billing Budget API setup and pricing](https://docs.cloud.google.com/billing/docs/how-to/budget-api-setup)
- [Cloud Run networking cost guidance](https://docs.cloud.google.com/run/docs/configuring/networking-best-practices)
- [Google Cloud network pricing](https://cloud.google.com/vpc/network-pricing)
