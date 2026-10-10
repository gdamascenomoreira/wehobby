variable "environment" {
  description = "Environment name, used in resource names and tags."
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region for all resources except the Static Web App. North Europe for every environment (see docs/conventions/region.md)."
  type        = string
  default     = "northeurope"
}

variable "static_web_app_location" {
  description = "Region for the Static Web App resource. Static Web Apps is not offered in North Europe, so it uses the closest EU region. The site itself is served from a global edge."
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
