output "id" {
  description = "Resource id of the Key Vault."
  value       = azurerm_key_vault.this.id
}

output "name" {
  description = "Name of the Key Vault."
  value       = azurerm_key_vault.this.name
}

output "vault_uri" {
  description = "URI used by SDKs to reach the vault, for example https://kv-wehobby-dev.vault.azure.net/."
  value       = azurerm_key_vault.this.vault_uri
}
