# One time setup (dev)

These are the steps the owner runs once, by hand, before GitHub Actions can plan and deploy the dev environment. Everything else is created by Terraform from `infra/envs/dev`.

What you end up with:

| Thing | Name | Created by |
| --- | --- | --- |
| Resource group for Terraform state | `rg-wehobby-tfstate` | you (step 2) |
| Resource group for the app | `rg-wehobby-dev` | you (step 2) |
| State storage account and container | `stwehobbytfstate` / `tfstate` | you (step 3) |
| Entra app registration used by GitHub Actions | `github-wehobby-deploy` | you (step 4) |
| Everything inside `rg-wehobby-dev` | see `infra/README.md` | Terraform |

None of these has a fixed monthly fee. The state account costs cents per month.

## 0. Prerequisites

* Azure CLI 2.70 or newer, logged in with an account that is **Owner** (or Contributor plus User Access Administrator) on the subscription.
* GitHub CLI (`gh`), logged in with admin rights on the repo. Optional: everything in steps 6 to 8 can also be done in the GitHub web UI.

Run all commands in **bash** (Git Bash, WSL, macOS or Linux). Set these once per shell, replacing the placeholder:

```bash
SUBSCRIPTION_ID="<your-subscription-id>"
LOCATION="westeurope"
GITHUB_REPO="gdamascenomoreira/wehobby"
STATE_ACCOUNT="stwehobbytfstate"

az login
az account set --subscription "$SUBSCRIPTION_ID"
TENANT_ID=$(az account show --query tenantId --output tsv)
```

## 1. Register resource providers

The deployment identity only has rights on one resource group, so it cannot register providers itself (Terraform runs with `resource_provider_registrations = "none"`). Register the ones this slice uses:

```bash
for ns in Microsoft.App Microsoft.OperationalInsights Microsoft.Insights Microsoft.KeyVault Microsoft.Web Microsoft.Storage; do
  az provider register --namespace "$ns"
done

# Wait until all of them show "Registered" (usually under a minute or two).
az provider list --query "[?contains('Microsoft.App Microsoft.OperationalInsights Microsoft.Insights Microsoft.KeyVault Microsoft.Web Microsoft.Storage', namespace)].{ns:namespace, state:registrationState}" --output table
```

## 2. Resource groups

```bash
TAGS="project=wehobby managed_by=manual"

az group create --name rg-wehobby-tfstate --location "$LOCATION" --tags $TAGS environment=shared
az group create --name rg-wehobby-dev     --location "$LOCATION" --tags $TAGS environment=dev
```

## 3. Terraform state storage

The account allows **Entra ID auth only** (shared key access disabled), with blob versioning and soft delete so a bad state write can be undone.

```bash
# Storage account names are global. If this says false, pick another name and
# update storage_account_name in infra/envs/dev/backend.tf to match.
az storage account check-name --name "$STATE_ACCOUNT" --query nameAvailable

az storage account create \
  --name "$STATE_ACCOUNT" \
  --resource-group rg-wehobby-tfstate \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --min-tls-version TLS1_2 \
  --https-only true \
  --allow-blob-public-access false \
  --allow-shared-key-access false \
  --tags project=wehobby environment=shared managed_by=manual

az storage account blob-service-properties update \
  --account-name "$STATE_ACCOUNT" \
  --resource-group rg-wehobby-tfstate \
  --enable-versioning true \
  --enable-delete-retention true \
  --delete-retention-days 30 \
  --enable-container-delete-retention true \
  --container-delete-retention-days 30

# Created through the management plane, so no data plane role is needed yet.
az storage container-rm create \
  --storage-account "$STATE_ACCOUNT" \
  --resource-group rg-wehobby-tfstate \
  --name tfstate \
  --public-access off

STATE_CONTAINER_SCOPE="$(az storage account show --name "$STATE_ACCOUNT" --resource-group rg-wehobby-tfstate --query id --output tsv)/blobServices/default/containers/tfstate"
```

## 4. Entra app registration for GitHub Actions

One app registration, with **no client secret**. GitHub proves its identity with short lived OIDC tokens, which Entra trusts through two federated credentials:

* `environment:dev`: jobs that run in the `dev` GitHub environment (the deploy workflow).
* `pull_request`: pull request jobs (the Terraform plan). OIDC tokens are not issued to pull requests from forks, so only branches in this repo can run a plan.

```bash
APP_ID=$(az ad app create --display-name github-wehobby-deploy --query appId --output tsv)
az ad sp create --id "$APP_ID"
SP_OBJECT_ID=$(az ad sp show --id "$APP_ID" --query id --output tsv)

az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-environment-dev\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_REPO}:environment:dev\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

az ad app federated-credential create --id "$APP_ID" --parameters "{
  \"name\": \"github-pull-request\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GITHUB_REPO}:pull_request\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"
```

If login later fails with `AADSTS700213` (no matching federated identity record), compare the `subject` in the error with the ones above. Repos with a customised OIDC subject claim (`gh api repos/$GITHUB_REPO/actions/oidc/customization/sub`) need the subject in that format.

## 5. Role assignments (least privilege)

| Role | Scope | Why |
| --- | --- | --- |
| Contributor | `rg-wehobby-dev` | Create and update the app resources, and read the Static Web Apps deployment token. Nothing outside this resource group. |
| Storage Blob Data Contributor | the `tfstate` **container** only | Read, write and lock the Terraform state. |

The identity cannot create role assignments. When a later slice needs one (for example the API reading Key Vault), it will be added here first.

```bash
az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
  --role Contributor \
  --scope "$(az group show --name rg-wehobby-dev --query id --output tsv)"

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" --assignee-principal-type ServicePrincipal \
  --role "Storage Blob Data Contributor" \
  --scope "$STATE_CONTAINER_SCOPE"
```

Optional, to run `terraform plan` from your own machine (see `infra/README.md`):

```bash
az role assignment create \
  --assignee "$(az ad signed-in-user show --query id --output tsv)" \
  --role "Storage Blob Data Contributor" \
  --scope "$STATE_CONTAINER_SCOPE"
```

## 6. GitHub environment and variables

Create the `dev` environment, limited to the `main` branch:

```bash
gh api --method PUT "repos/$GITHUB_REPO/environments/dev" \
  --input - <<'EOF'
{ "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true } }
EOF

gh api --method POST "repos/$GITHUB_REPO/environments/dev/deployment-branch-policies" \
  -f name=main -f type=branch
```

Set the Azure ids as **repository variables**. The deploy jobs run in the `dev` environment and see them, and so does the pull request plan job, which runs outside any environment. They are identifiers, not credentials: there is no secret to store.

```bash
gh variable set AZURE_CLIENT_ID       --repo "$GITHUB_REPO" --body "$APP_ID"
gh variable set AZURE_TENANT_ID       --repo "$GITHUB_REPO" --body "$TENANT_ID"
gh variable set AZURE_SUBSCRIPTION_ID --repo "$GITHUB_REPO" --body "$SUBSCRIPTION_ID"
```

Optional variables:

| Variable | When to set it |
| --- | --- |
| `KEY_VAULT_NAME` | Only if the plan or apply fails because `kv-wehobby-dev` is taken. Use for example `kv-wehobby-dev-01`. |
| `WEB_CUSTOM_DOMAIN` | After the first deploy, see step 9. |

When `prod` is added later, it gets its own environment with required reviewers, its own federated credential, and environment level variables that override these.

## 7. First pull request and merge

1. Open the pull request (or re-run its **Terraform CI** workflow if it was opened before steps 1 to 6). The plan job posts the plan as a comment.
2. Merge it. **Deploy dev** starts: it builds and pushes `ghcr.io/gdamascenomoreira/wehobby-api`, and the **Terraform apply** job then stops at "Check the API image is public". That failure is expected on the very first run.

## 8. Make the ghcr.io package public

Container Apps pulls the API image without credentials, so the package must be public. That's fine here: the image contains only code that is already in this public repo.

1. Open `https://github.com/users/gdamascenomoreira/packages/container/wehobby-api/settings`.
2. Under **Danger Zone**, choose **Change visibility**, then **Public**.
3. Under **Manage Actions access**, check that the `wehobby` repository has the **Write** role (it is linked automatically through the image's `org.opencontainers.image.source` label).
4. Go back to the failed **Deploy dev** run and choose **Re-run failed jobs**.

When it finishes, the run summary links to the web app, which should show **"API status: ok"** (or **"Estado da API: ok"** in Portuguese).

## 9. Custom domain `dev.wehobby.app`

Static Web Apps validates the domain by checking the CNAME record, so the record must exist **before** Terraform adds the domain.

1. Get the default hostname:

   ```bash
   az staticwebapp show --name swa-wehobby-dev --resource-group rg-wehobby-dev --query defaultHostname --output tsv
   ```

2. At the DNS provider for `wehobby.app`, add a record:

   | Type | Name | Value | TTL |
   | --- | --- | --- | --- |
   | CNAME | `dev` | the hostname from step 1 | 3600 |

3. Check that it resolves: `nslookup dev.wehobby.app` should return the `azurestaticapps.net` name.
4. Set the variable and run **Deploy dev** again (Actions tab, **Run workflow**):

   ```bash
   gh variable set WEB_CUSTOM_DOMAIN --repo "$GITHUB_REPO" --body "dev.wehobby.app"
   ```

Terraform adds the domain to the Static Web App and adds `https://dev.wehobby.app` to the API's CORS origins. Azure issues the TLS certificate for free; it can take up to about 15 minutes.

The apex domain `wehobby.app` is kept for prod.
