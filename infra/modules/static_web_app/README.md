# Module: static_web_app

Creates an Azure Static Web App on the **Free** plan, with an optional custom domain.

* The app is deployed by GitHub Actions. The workflow reads the deployment token at run time with the Azure CLI, so the token is never stored as a GitHub secret.
* `custom_domain` uses CNAME validation. The CNAME record (for example `dev` pointing at `default_host_name`) must exist at the DNS provider **before** you set the variable. Azure then issues a free managed certificate.

See `variables.tf` for inputs and `outputs.tf` for outputs.
