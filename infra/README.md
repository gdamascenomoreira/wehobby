# Infrastructure

Terraform (`azurerm` provider) for WeHobby on Azure. One reusable module per concern, and one root configuration per environment.

```
infra/
├── .tflint.hcl              tflint config (terraform + azurerm rulesets)
├── modules/
│   ├── monitoring/          Log Analytics workspace + Application Insights
│   ├── key_vault/           Key Vault with RBAC authorization
│   ├── container_app_api/   Container Apps environment + API container app
│   └── static_web_app/      Static Web App (Free) + optional custom domain
└── envs/
    ├── dev/                 root configuration for dev (composes the modules)
    └── prod/                placeholder
```

## What dev creates

Dev is a lab with test data only, so it runs in `eastus2` (low cost, and the dev subscription cannot create resources in West Europe). Prod will use an EU region.

All in `rg-wehobby-dev`, which you create by hand (see [`docs/setup.md`](../docs/setup.md)), and all tagged `project = "wehobby"`, `environment = "dev"`, `managed_by = "terraform"`.

| Resource | Name | Notes |
| --- | --- | --- |
| Log Analytics workspace | `log-wehobby-dev` | 30 day retention, 0.15 GB per day cap (inside the free 5 GB per month) |
| Application Insights | `appi-wehobby-dev` | Workspace based |
| Key Vault | `kv-wehobby-dev` | RBAC, purge protection, firewall denies by default |
| Container Apps environment | `cae-wehobby-dev` | Consumption plan, logs to Log Analytics |
| Container app | `ca-wehobby-api-dev` | 0 to 1 replicas, image from ghcr.io, system assigned identity |
| Static Web App | `swa-wehobby-dev` | Free plan, optional custom domain |

Outputs: `web_url`, `api_url`, `web_default_host_name`, `static_web_app_name`, `key_vault_name`.

## State and authentication

* Remote state lives in the `tfstate` container of `stwehobbytfstate` (in `rg-wehobby-tfstate`), one key per environment (`dev.terraform.tfstate`).
* Authentication is **Entra ID only** (`use_azuread_auth = true`). The storage account has shared key access disabled.
* In GitHub Actions, Terraform logs in with OIDC (`ARM_USE_OIDC=true`, `ARM_CLIENT_ID`, `ARM_TENANT_ID`, `ARM_SUBSCRIPTION_ID`). There are no stored Azure secrets.

## How it runs in CI

| Workflow | When | What |
| --- | --- | --- |
| `terraform-ci.yml` | Pull requests that touch `infra/` | `fmt -check`, `validate`, `tflint`, `trivy config`, then `plan` for dev, posted as a pull request comment |
| `deploy-dev.yml` | Push to `main`, or manual | Push the API image, `terraform apply` for dev with the new image tag, deploy the web app |

`terraform apply` only ever runs from `deploy-dev.yml`.

## Run a plan locally

You need Terraform 1.16, the Azure CLI, and the optional "Storage Blob Data Contributor" role on the state container (`docs/setup.md`, step 5).

```bash
az login
export ARM_SUBSCRIPTION_ID="$(az account show --query id --output tsv)"

cd infra/envs/dev
cp terraform.tfvars.example terraform.tfvars   # git ignored; edit if needed

# The backend is configured for OIDC (GitHub Actions). Locally, turn it off so
# the Azure CLI login is used instead.
terraform init -backend-config="use_oidc=false"
terraform plan
```

Do not run `terraform apply` locally. Changes go through a pull request and the deploy workflow.

## Checks before every commit

From the `infra/` folder:

```bash
terraform fmt -recursive
(cd envs/dev && terraform init -backend=false && terraform validate)
tflint --init && tflint --recursive --config "$PWD/.tflint.hcl"
trivy config .
```

No local tflint or trivy? Run them with Docker:

```bash
docker run --rm -v "$PWD:/data" -w /data --entrypoint sh ghcr.io/terraform-linters/tflint:v0.64.0 \
  -c 'tflint --init && tflint --recursive --config /data/.tflint.hcl'
docker run --rm -v "$PWD:/data" aquasec/trivy:0.75.0 config /data
```

## Updating providers

After changing a version in `versions.tf`, refresh the lock file for every platform CI and contributors use, then commit it:

```bash
cd infra/envs/dev
terraform init -backend=false -upgrade
terraform providers lock -platform=linux_amd64 -platform=windows_amd64 -platform=darwin_amd64 -platform=darwin_arm64
```
