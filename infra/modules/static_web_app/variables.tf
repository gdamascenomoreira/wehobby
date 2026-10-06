variable "name" {
  description = "Static Web App name, for example \"swa-wehobby-dev\"."
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group to deploy into."
  type        = string
}

variable "location" {
  description = "Region for the Static Web App resource. Must be a region Static Web Apps supports, such as eastus2 or westeurope."
  type        = string
}

variable "custom_domain" {
  description = "Optional custom domain, for example \"dev.wehobby.app\". Its CNAME must already point at the default hostname. Empty disables it."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}
