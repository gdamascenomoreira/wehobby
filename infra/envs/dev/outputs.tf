output "web_url" {
  description = "Public URL of the web app."
  value       = module.static_web_app.url
}

output "web_default_host_name" {
  description = "Default Static Web Apps hostname. Point the custom domain CNAME here."
  value       = module.static_web_app.default_host_name
}

output "static_web_app_name" {
  description = "Name of the Static Web App, used by the deploy workflow."
  value       = module.static_web_app.name
}

output "api_url" {
  description = "Public URL of the API."
  value       = module.container_app_api.url
}

output "key_vault_name" {
  description = "Name of the Key Vault."
  value       = module.key_vault.name
}
