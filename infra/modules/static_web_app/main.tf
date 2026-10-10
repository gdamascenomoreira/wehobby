resource "azurerm_static_web_app" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Free"
  sku_size            = "Free"

  # Deployments come from GitHub Actions with the deployment token, not from a
  # linked repository, so pull request preview environments are not used.
  preview_environments_enabled = false

  tags = var.tags
}

resource "azurerm_static_web_app_custom_domain" "this" {
  count = var.custom_domain == "" ? 0 : 1

  static_web_app_id = azurerm_static_web_app.this.id
  domain_name       = var.custom_domain
  validation_type   = "cname-delegation"
}
