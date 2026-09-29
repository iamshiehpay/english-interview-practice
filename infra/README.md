# GCP infrastructure

The infrastructure is split so a human with project and billing access creates the trust boundary once, then GitHub Actions can deploy application revisions without a service-account key.

## 1. Bootstrap

`bootstrap/` enables the required APIs and creates Artifact Registry, the Cloud Run runtime identity, a versioned GCS state bucket, a GitHub Workload Identity provider restricted to one repository and `main`, a deployer identity, email notifications, and a monthly budget of one unit in the billing account's currency. Its alert thresholds are 1%, 50%, and 100%. A budget sends alerts; it does not stop spending.

Run this from an authenticated local shell. Copy `terraform.tfvars.example` to an ignored `terraform.tfvars`, then:

```sh
terraform -chdir=infra/bootstrap init
terraform -chdir=infra/bootstrap plan
terraform -chdir=infra/bootstrap apply
```

Keep the local bootstrap state private because Terraform state records project and billing resource identifiers. The application state bucket it creates is used by the deployment workflow. No service-account JSON key is created.

## 2. Service

`service/` creates the public Cloud Run service, health checks, alerts, and dashboard. GitHub Actions supplies the immutable image tag and bootstrap outputs. The service uses fake providers, one instance at most, 512 MiB memory, and temporary per-browser workspaces in `/tmp`.

The workflow initializes the backend as:

```sh
terraform -chdir=infra/service init \
  -backend-config="bucket=YOUR_STATE_BUCKET" \
  -backend-config="prefix=interview-coach/service"
```

Do not put API keys, creator data, or a real `.workspace` in Terraform variables or container images.
