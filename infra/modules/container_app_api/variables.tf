variable "environment_name" {
  description = "Container Apps environment name, for example \"cae-wehobby-dev\"."
  type        = string
}

variable "app_name" {
  description = "Container app name, for example \"ca-wehobby-api-dev\"."
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group to deploy into."
  type        = string
}

variable "location" {
  description = "Azure region for the Container Apps environment."
  type        = string
}

variable "log_analytics_workspace_id" {
  description = "Resource id of the Log Analytics workspace that receives container logs."
  type        = string
}

variable "image" {
  description = "Full container image reference, for example \"ghcr.io/owner/wehobby-api:sha-abc1234\". The image must be public."
  type        = string
}

variable "target_port" {
  description = "Port the API listens on inside the container."
  type        = number
  default     = 3000
}

variable "cors_origins" {
  description = "Origins allowed to call the API from a browser (the web app URLs)."
  type        = list(string)

  validation {
    condition     = length(var.cors_origins) > 0 && alltrue([for origin in var.cors_origins : startswith(origin, "https://")])
    error_message = "Provide at least one CORS origin, and use https:// for every origin."
  }
}

variable "log_level" {
  description = "API log level (fatal, error, warn, info, debug, trace)."
  type        = string
  default     = "info"
}

variable "cpu" {
  description = "vCPU per replica. Consumption plan pairs: 0.25/0.5Gi, 0.5/1Gi, ..."
  type        = number
  default     = 0.25
}

variable "memory" {
  description = "Memory per replica, matching the cpu value (for example \"0.5Gi\" for 0.25 vCPU)."
  type        = string
  default     = "0.5Gi"
}

variable "min_replicas" {
  description = "Minimum replicas. 0 lets the app scale to zero when idle."
  type        = number
  default     = 0
}

variable "max_replicas" {
  description = "Maximum replicas."
  type        = number
  default     = 1
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}
