# Prod environment (placeholder)

Not created yet. When WeHobby is ready for production, this folder gets the same files as `../dev/`:

* `backend.tf` with `key = "prod.terraform.tfstate"`,
* `rg-wehobby-prod` as the resource group,
* the apex domain `wehobby.app` for the web app,
* a `prod` GitHub environment with required reviewers, so every `terraform apply` needs manual approval.
