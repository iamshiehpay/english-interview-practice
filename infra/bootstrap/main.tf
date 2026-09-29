locals {
  repository        = "${var.github_owner}/${var.github_repository}"
  state_bucket_name = var.state_bucket_name != "" ? var.state_bucket_name : "${var.project_id}-interview-coach-tfstate"
  required_services = toset([
    "artifactregistry.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "serviceusage.googleapis.com",
    "sts.googleapis.com",
  ])
  deployer_project_roles = toset([
    "roles/artifactregistry.writer",
    "roles/logging.configWriter",
    "roles/monitoring.editor",
    "roles/run.admin",
  ])
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each = local.required_services
  project  = var.project_id
  service  = each.value

  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "app" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repository
  description   = "Adaptive English Interview Coach public demo images"
  format        = "DOCKER"

  cleanup_policies {
    id     = "keep-recent-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old-versions"
    action = "DELETE"
    condition {
      older_than = "2592000s"
    }
  }

  depends_on = [google_project_service.required]
}

resource "google_storage_bucket" "terraform_state" {
  project                     = var.project_id
  name                        = local.state_bucket_name
  location                    = "US-CENTRAL1"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 10
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "interview-coach-runtime"
  display_name = "Interview Coach Cloud Run runtime"
}

resource "google_service_account" "github_deployer" {
  project      = var.project_id
  account_id   = "interview-coach-deployer"
  display_name = "Interview Coach GitHub deployer"
}

resource "google_project_iam_member" "deployer" {
  for_each = local.deployer_project_roles
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.github_deployer.email}"
}

resource "google_service_account_iam_member" "deployer_uses_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deployer.email}"
}

resource "google_storage_bucket_iam_member" "deployer_state" {
  bucket = google_storage_bucket.terraform_state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.github_deployer.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "Keyless deployment from ${local.repository}"

  depends_on = [google_project_service.required]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub Actions deploy"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.owner"      = "assertion.repository_owner"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository_owner == '${var.github_owner}' && assertion.repository == '${local.repository}' && assertion.ref == 'refs/heads/${var.deploy_branch}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_federation" {
  service_account_id = google_service_account.github_deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${local.repository}"
}

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "Interview Coach operator email"
  type         = "email"
  labels = {
    email_address = var.notification_email
  }

  depends_on = [google_project_service.required]
}

resource "google_billing_budget" "project" {
  billing_account = var.billing_account_id
  display_name    = "Interview Coach demo monthly budget"

  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "1"
    }
  }

  threshold_rules {
    threshold_percent = 0.01
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.5
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    monitoring_notification_channels = [google_monitoring_notification_channel.email.id]
    disable_default_iam_recipients   = false
  }

  depends_on = [google_project_service.required]
}
