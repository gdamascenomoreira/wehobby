resource "azurerm_key_vault" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  tenant_id           = var.tenant_id
  sku_name            = "standard"

  # Access is granted with Azure RBAC role assignments, never access policies.
  rbac_authorization_enabled = true

  soft_delete_retention_days = var.soft_delete_retention_days
  purge_protection_enabled   = true

  # No secrets are stored yet. When the API starts reading secrets, revisit the
  # firewall so its managed identity can reach the vault.
  network_acls {
    default_action = "Deny"
    bypass         = "AzureServices"
    ip_rules       = var.allowed_ip_ranges
  }

  tags = var.tags

  lifecycle {
    prevent_destroy = true
  }
}
