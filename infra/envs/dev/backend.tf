# Remote state in the storage account created once by hand (see docs/setup.md).
# Authentication is Entra ID only: no storage access keys. In GitHub Actions the
# credentials come from OIDC; locally from `az login`.
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-wehobby-tfstate"
    storage_account_name = "stwehobbytfstate"
    container_name       = "tfstate"
    key                  = "dev.terraform.tfstate"
    use_azuread_auth     = true
    use_oidc             = true
  }
}
