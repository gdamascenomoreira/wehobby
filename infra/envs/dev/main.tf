locals {
  name_suffix = "wehobby-${var.environment}"

  tags = {
    project     = "wehobby"
    environment = var.environment
    managed_by  = "terraform"
  }
}

data "azurerm_client_config" "current" {}

# Created once by hand (docs/setup.md), so the deployment identity only needs
# rights inside it.
data "azurerm_resource_group" "this" {
  name = "rg-${local.name_suffix}"
}

module "monitoring" {
  source = "../../modules/monitoring"

  name_suffix         = local.name_suffix
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  tags                = local.tags
}

module "key_vault" {
  source = "../../modules/key_vault"

  name                = coalesce(var.key_vault_name, "kv-${local.name_suffix}")
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  tenant_id           = data.azurerm_client_config.current.tenant_id
  tags                = local.tags
}

module "static_web_app" {
  source = "../../modules/static_web_app"

  name                = "swa-${local.name_suffix}"
  resource_group_name = data.azurerm_resource_group.this.name
  location            = var.location
  custom_domain       = var.web_custom_domain
  tags                = local.tags
}

module "container_app_api" {
  source = "../../modules/container_app_api"

  environment_name           = "cae-${local.name_suffix}"
  app_name                   = "ca-wehobby-api-${var.environment}"
  resource_group_name        = data.azurerm_resource_group.this.name
  location                   = var.location
  log_analytics_workspace_id = module.monitoring.log_analytics_workspace_id
  image                      = "${var.api_image_repository}:${var.api_image_tag}"
  cors_origins               = module.static_web_app.origins
  tags                       = local.tags
}
