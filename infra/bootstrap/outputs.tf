output "artifact_repository" {
  value = google_artifact_registry_repository.app.repository_id
}

output "artifact_registry_host" {
  value = "${var.region}-docker.pkg.dev"
}

output "runtime_service_account" {
  value = google_service_account.runtime.email
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "workload_identity_service_account" {
  value = google_service_account.github_deployer.email
}

output "terraform_state_bucket" {
  value = google_storage_bucket.terraform_state.name
}

output "notification_channel" {
  value = google_monitoring_notification_channel.email.id
}
