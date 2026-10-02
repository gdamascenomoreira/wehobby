variable "name" {
  description = "Key Vault name (3 to 24 characters, globally unique), for example \"kv-wehobby-dev\"."
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$", var.name))
    error_message = "Key Vault names are 3 to 24 letters, digits and hyphens, start with a letter and do not end with a hyphen."
  }
}

variable "resource_group_name" {
  description = "Name of the resource group to deploy into."
  type        = string
}

variable "location" {
  description = "Azure region for the Key Vault."
  type        = string
}

variable "tenant_id" {
  description = "Entra ID tenant id that authenticates requests to the vault."
  type        = string
}

variable "soft_delete_retention_days" {
  description = "Days a deleted vault or secret can be recovered (7 to 90)."
  type        = number
  default     = 7
}

variable "allowed_ip_ranges" {
  description = "Public IP ranges (CIDR) allowed through the vault firewall. Empty means only trusted Azure services."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}
