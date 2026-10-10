output "id" {
  description = "Resource id of the Static Web App."
  value       = azurerm_static_web_app.this.id
}

output "name" {
  description = "Name of the Static Web App."
  value       = azurerm_static_web_app.this.name
}

output "default_host_name" {
  description = "Default hostname, for example <random>.azurestaticapps.net."
  value       = azurerm_static_web_app.this.default_host_name
}

output "origins" {
  description = "HTTPS origins that serve the web app: the default hostname, plus the custom domain when set."
  value = compact([
    "https://${azurerm_static_web_app.this.default_host_name}",
    var.custom_domain == "" ? "" : "https://${var.custom_domain}",
  ])
}

output "url" {
  description = "Public URL of the web app: the custom domain when set, otherwise the default hostname."
  value       = var.custom_domain == "" ? "https://${azurerm_static_web_app.this.default_host_name}" : "https://${var.custom_domain}"
}
