variable "project_id" {
  description = "Existing GCP project id with billing enabled."
  type        = string
}

variable "region" {
  description = "Cloud Run and Artifact Registry region."
  type        = string
  default     = "asia-east1"
}

variable "github_owner" {
  description = "GitHub user or organization that owns the repository."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository name without the owner."
  type        = string
}

variable "deploy_branch" {
  description = "Only this branch may exchange GitHub OIDC tokens for GCP credentials."
  type        = string
  default     = "main"
}

variable "billing_account_id" {
  description = "Billing account id used for the one-dollar monthly alert budget."
  type        = string
}

variable "notification_email" {
  description = "Email address for budget and runtime alerts."
  type        = string
}

variable "artifact_repository" {
  description = "Artifact Registry Docker repository name."
  type        = string
  default     = "interview-coach"
}

variable "state_bucket_name" {
  description = "Globally unique GCS bucket name. Empty uses PROJECT_ID-interview-coach-tfstate."
  type        = string
  default     = ""
}
