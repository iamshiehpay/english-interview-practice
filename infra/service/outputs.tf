output "service_url" {
  value = google_cloud_run_v2_service.app.uri
}

output "revision" {
  value = google_cloud_run_v2_service.app.latest_ready_revision
}
