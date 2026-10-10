output "environment_id" {
  description = "Resource id of the Container Apps environment."
  value       = azurerm_container_app_environment.this.id
}

output "app_id" {
  description = "Resource id of the API container app."
  value       = azurerm_container_app.this.id
}

output "app_name" {
  description = "Name of the API container app."
  value       = azurerm_container_app.this.name
}

output "url" {
  description = "Public HTTPS URL of the API."
  value       = "https://${azurerm_container_app.this.ingress[0].fqdn}"
}

output "principal_id" {
  description = "Object id of the API's system assigned managed identity, for role assignments."
  value       = azurerm_container_app.this.identity[0].principal_id
}
