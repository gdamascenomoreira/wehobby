variable "environment" {
  description = "Environment name, used in resource names and tags."
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for all resources. Must be an EU region for GDPR."
  type        = string
  default     = "westeurope"
}

variable "api_image_repository" {
  description = "Container image repository for the API on GitHub Container Registry."
  type        = string
  default     = "ghcr.io/gdamascenomoreira/wehobby-api"
}

variable "api_image_tag" {
  description = "Tag of the API image to deploy, set by the deploy workflow (for example \"sha-abc1234\")."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$", var.api_image_tag))
    error_message = "api_image_tag must be a valid container image tag."
  }
}

variable "key_vault_name" {
  description = "Key Vault name. Defaults to kv-wehobby-<environment>; override with a suffix if that global name is taken."
  type        = string
  default     = null
}

variable "web_custom_domain" {
  description = "Custom domain for the web app, for example \"dev.wehobby.app\". Leave empty until the CNAME record exists."
  type        = string
  default     = ""
}
