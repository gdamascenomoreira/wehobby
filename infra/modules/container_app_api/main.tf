resource "azurerm_container_app_environment" "this" {
  name                       = var.environment_name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  logs_destination           = "log-analytics"
  log_analytics_workspace_id = var.log_analytics_workspace_id
  tags                       = var.tags
}

resource "azurerm_container_app" "this" {
  name                         = var.app_name
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  revision_mode                = "Single"

  # Used later to read Key Vault secrets and reach other Azure services
  # without credentials.
  identity {
    type = "SystemAssigned"
  }

  ingress {
    external_enabled = true
    target_port      = var.target_port
    transport        = "auto"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    http_scale_rule {
      name                = "http"
      concurrent_requests = "50"
    }

    container {
      name   = "api"
      image  = var.image
      cpu    = var.cpu
      memory = var.memory

      env {
        name  = "PORT"
        value = tostring(var.target_port)
      }

      env {
        name  = "LOG_LEVEL"
        value = var.log_level
      }

      env {
        name  = "CORS_ORIGIN"
        value = join(",", var.cors_origins)
      }

      startup_probe {
        transport               = "HTTP"
        port                    = var.target_port
        path                    = "/health"
        interval_seconds        = 3
        failure_count_threshold = 10
      }

      liveness_probe {
        transport        = "HTTP"
        port             = var.target_port
        path             = "/health"
        interval_seconds = 30
      }

      readiness_probe {
        transport        = "HTTP"
        port             = var.target_port
        path             = "/health"
        interval_seconds = 10
      }
    }
  }

  tags = var.tags
}
