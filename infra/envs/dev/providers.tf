# The subscription, tenant and client ids come from ARM_* environment variables
# (OIDC in GitHub Actions, `az login` locally), never from committed files.
provider "azurerm" {
  # The deployment identity only has rights on the resource group, so it cannot
  # register resource providers. They are registered once in docs/setup.md.
  resource_provider_registrations = "none"

  storage_use_azuread = true

  features {
    key_vault {
      # Purge protection is on, so a destroyed vault stays recoverable.
      purge_soft_delete_on_destroy    = false
      recover_soft_deleted_key_vaults = true
    }
  }
}
