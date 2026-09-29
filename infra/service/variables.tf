variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-east1"
}

variable "service_name" {
  type    = string
  default = "adaptive-english-interview-coach"
}

variable "container_image" {
  description = "Immutable Artifact Registry image including a git SHA tag."
  type        = string
}

variable "runtime_service_account" {
  type = string
}

variable "notification_channel" {
  description = "Full Monitoring notification channel id created by bootstrap."
  type        = string
}
