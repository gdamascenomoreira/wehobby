variable "name_suffix" {
  description = "Suffix used in resource names, for example \"wehobby-dev\"."
  type        = string
}

variable "resource_group_name" {
  description = "Name of the resource group to deploy into."
  type        = string
}

variable "location" {
  description = "Azure region for the resources."
  type        = string
}

variable "retention_in_days" {
  description = "How long logs are kept, in days. 30 days are included in the Log Analytics price."
  type        = number
  default     = 30
}

variable "daily_quota_gb" {
  description = "Daily ingestion cap in GB for Log Analytics, to keep costs predictable. 0.15 keeps a month inside the 5 GB free allowance. -1 means no cap."
  type        = number
  default     = 0.15
}

variable "tags" {
  description = "Tags applied to every resource."
  type        = map(string)
}
