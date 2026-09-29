resource "google_cloud_run_v2_service" "app" {
  project             = var.project_id
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  scaling {
    min_instance_count = 0
    max_instance_count = 1
  }

  template {
    service_account                  = var.runtime_service_account
    timeout                          = "300s"
    max_instance_request_concurrency = 20

    containers {
      name  = "app"
      image = var.container_image

      ports {
        name           = "http1"
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      env {
        name  = "COACH_DEPLOYMENT_MODE"
        value = "demo"
      }

      env {
        name  = "DEMO_WORKSPACE_ROOT"
        value = "/tmp/interview-coach-demo"
      }

      startup_probe {
        initial_delay_seconds = 0
        timeout_seconds       = 3
        period_seconds        = 3
        failure_threshold     = 10

        http_get {
          path = "/api/health"
          port = 8080
        }
      }

      liveness_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 30
        failure_threshold     = 3

        http_get {
          path = "/api/health"
          port = 8080
        }
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = google_cloud_run_v2_service.app.location
  name     = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_monitoring_uptime_check_config" "health" {
  project            = var.project_id
  display_name       = "Interview Coach demo health"
  timeout            = "10s"
  period             = "300s"
  checker_type       = "STATIC_IP_CHECKERS"
  log_check_failures = true

  http_check {
    path           = "/api/health"
    port           = 443
    request_method = "GET"
    use_ssl        = true
    validate_ssl   = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = trimprefix(google_cloud_run_v2_service.app.uri, "https://")
    }
  }

  content_matchers {
    content = "\"status\":\"ok\""
    matcher = "CONTAINS_STRING"
  }

  depends_on = [google_cloud_run_v2_service_iam_member.public]
}

resource "google_monitoring_alert_policy" "uptime" {
  project      = var.project_id
  display_name = "Interview Coach demo is unavailable"
  combiner     = "OR"

  conditions {
    display_name = "Health check failed"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.health.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "120s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_TRUE"
      }
    }
  }

  notification_channels = [var.notification_channel]
  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_monitoring_alert_policy" "http_5xx" {
  project      = var.project_id
  display_name = "Interview Coach demo 5xx rate over 5 percent"
  combiner     = "OR"

  conditions {
    display_name = "Five-minute 5xx ratio"
    condition_threshold {
      filter             = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\" AND metric.label.response_code_class=\"5xx\""
      denominator_filter = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\""
      comparison         = "COMPARISON_GT"
      threshold_value    = 0.05
      duration           = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }

      denominator_aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  notification_channels = [var.notification_channel]
  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_monitoring_alert_policy" "memory" {
  project      = var.project_id
  display_name = "Interview Coach demo memory over 80 percent"
  combiner     = "OR"

  conditions {
    display_name = "Five-minute memory utilization"
    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_PERCENTILE_99"
        cross_series_reducer = "REDUCE_MAX"
      }
    }
  }

  notification_channels = [var.notification_channel]
  alert_strategy {
    auto_close = "1800s"
  }
}

resource "google_logging_metric" "demo_sessions" {
  project = var.project_id
  name    = "interview_coach_demo_sessions"
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.service_name}\" AND (jsonPayload.event=\"demo_session_created\" OR jsonPayload.event=\"demo_session_removed\")"

  metric_descriptor {
    metric_kind  = "DELTA"
    value_type   = "DISTRIBUTION"
    unit         = "1"
    display_name = "Interview Coach observed active demo sessions"
  }

  value_extractor = "EXTRACT(jsonPayload.sessionCount)"

  bucket_options {
    linear_buckets {
      num_finite_buckets = 51
      width              = 1
      offset             = 0
    }
  }
}

resource "google_monitoring_dashboard" "app" {
  project = var.project_id
  dashboard_json = jsonencode({
    displayName = "Interview Coach public demo"
    mosaicLayout = {
      columns = 48
      tiles = [
        {
          xPos = 0, yPos = 0, width = 24, height = 16
          widget = {
            title = "Requests"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                } }
                plotType = "LINE"
              }]
              yAxis = { scale = "LINEAR", label = "requests/s" }
            }
          }
        },
        {
          xPos = 24, yPos = 0, width = 24, height = 16
          widget = {
            title = "Request latency (p95)"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"run.googleapis.com/request_latencies\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_PERCENTILE_95", crossSeriesReducer = "REDUCE_MAX" }
                } }
                plotType = "LINE"
              }]
              yAxis = { scale = "LINEAR", label = "milliseconds" }
            }
          }
        },
        {
          xPos = 0, yPos = 16, width = 24, height = 16
          widget = {
            title = "5xx responses"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\" AND metric.label.response_code_class=\"5xx\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_RATE", crossSeriesReducer = "REDUCE_SUM" }
                } }
                plotType = "LINE"
              }]
              yAxis = { scale = "LINEAR", label = "responses/s" }
            }
          }
        },
        {
          xPos = 24, yPos = 16, width = 24, height = 16
          widget = {
            title = "Memory utilization (p99)"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"run.googleapis.com/container/memory/utilizations\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_PERCENTILE_99", crossSeriesReducer = "REDUCE_MAX" }
                } }
                plotType = "LINE"
              }]
              yAxis = { scale = "LINEAR", label = "utilization" }
            }
          }
        },
        {
          xPos = 0, yPos = 32, width = 48, height = 16
          widget = {
            title = "Observed active demo sessions (p99)"
            xyChart = {
              dataSets = [{
                timeSeriesQuery = { timeSeriesFilter = {
                  filter      = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.demo_sessions.name}\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${var.service_name}\""
                  aggregation = { alignmentPeriod = "60s", perSeriesAligner = "ALIGN_PERCENTILE_99", crossSeriesReducer = "REDUCE_MAX" }
                } }
                plotType = "LINE"
              }]
              yAxis = { scale = "LINEAR", label = "sessions" }
            }
          }
        }
      ]
    }
  })
}
