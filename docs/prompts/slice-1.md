# Slice 1: scaffold, CI and hello world on Azure

Paste everything below the line into Claude Code, from the root of the `wehobby` repo.

---

Read `CLAUDE.md` and `docs/PRD.md` first.

We are building **slice 1** of the WeHobby MVP. The goal is a working foundation: a monorepo that builds and tests in CI, and a "hello world" web app and API deployed to the Azure **dev** environment. No product features yet.

## Scope

**1. Monorepo**
* npm workspaces: `web`, `api`, `functions`, `packages/shared`.
* Root TypeScript base config (strict), ESLint, Prettier, Vitest.
* Root scripts: `lint`, `typecheck`, `test`, `build`, `format`.
* Update `.gitignore` for Node, Vite, Azure Functions, `.env.local` and Terraform (`.terraform/`, `*.tfstate*`, `*.tfvars` except `*.tfvars.example`, `crash.log`).

**2. packages/shared**
* A `HealthResponse` Zod schema and type, used by both `api` and `web`, to prove sharing works.

**3. api**
* Fastify + TypeScript.
* `GET /health` returns `{ status: "ok", version }`, validated with the shared schema.
* Structured logging, CORS limited to the web app origin (configurable).
* A Dockerfile (multi stage, small production image, non root user).
* A Vitest test for `/health`.

**4. web**
* React + Vite + TypeScript, set up as a PWA (manifest with name "WeHobby", theme color, placeholder icons).
* react-i18next with `pt` and `en`; language picker; browser language as default.
* A simple mobile first home page: the WeHobby name, a one line tagline in both languages, and the API status fetched from `/health`.
* `staticwebapp.config.json` with SPA fallback routing and basic security headers.
* A Vitest test for the language switch.

**5. functions**
* Empty Azure Functions project (Node.js, TypeScript) that builds. No functions yet.

**6. Local development**
* `docker-compose.yml` with PostGIS and Azurite (not used by code yet, ready for slice 2).
* `.env.example` files with placeholders only.

**7. Infrastructure (Terraform), dev environment only**
* Layout: `infra/modules/` (one module per concern: `monitoring`, `key_vault`, `container_app_api`, `static_web_app`) and `infra/envs/dev/` as the root that composes them. Leave `infra/envs/prod/` as a placeholder README.
* `versions.tf` pinning Terraform and the `azurerm` provider; commit `.terraform.lock.hcl`.
* `backend.tf` using the `azurerm` backend with `use_azuread_auth = true` and `use_oidc = true`. The state storage account is created once by me (see `docs/setup.md`), not by this Terraform.
* Resources:
  * Log Analytics workspace + Application Insights.
  * Key Vault (RBAC authorization).
  * Container Apps environment + container app for the API (consumption, scale to zero, image from ghcr.io, system assigned managed identity).
  * Static Web App (Free plan).
* Variables for region, environment name and API image tag; outputs for the web URL and API URL. A `terraform.tfvars.example`.
* Tags on every resource: `project`, `environment`, `managed_by = "terraform"`.
* A `.tflint.hcl` with the azurerm ruleset.
* No PostgreSQL or app Storage yet (they come in later slices).

**8. GitHub Actions**
* `ci.yml`: on pull requests and pushes to `main`, run lint, typecheck, tests and build for all workspaces.
* `terraform-ci.yml`: on pull requests that touch `infra/`:
  * `terraform fmt -check`, `terraform validate`, `tflint` and `trivy config`,
  * `terraform plan` for dev (OIDC login), with the plan summary posted as a pull request comment.
* `deploy-dev.yml`: on push to `main` (and manual trigger), using the `dev` GitHub environment:
  * build and push the API image to ghcr.io,
  * log in to Azure with OIDC (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` as environment variables),
  * `terraform init` and `terraform apply` for `infra/envs/dev`, passing the new image tag,
  * deploy the web app to Static Web Apps.
* Least privilege `permissions:` blocks in every workflow.

**9. Docs**
* `docs/setup.md`: the exact one time steps I need to do myself, with Azure CLI commands:
  * create the resource groups `rg-wehobby-tfstate` and `rg-wehobby-dev`,
  * create the Terraform state storage account and container (Entra ID auth only, shared key access disabled, versioning and soft delete on),
  * create the Entra app registration for GitHub Actions, with federated credentials for the `dev` environment and for pull requests,
  * the least privilege role assignments (on `rg-wehobby-dev`, and Storage Blob Data Contributor on the state container),
  * the GitHub environment variables, and making the ghcr.io package public.
* `infra/README.md`: how the Terraform is organised and how to run `plan` locally.

## Rules

* Follow `CLAUDE.md` (no secrets, branch + PR, conventional commits).
* Do not run any Azure command yourself.
* Pin action versions and keep dependencies to what this slice needs.

## Before writing code

Give me a short plan: the folder tree you will create, the main library choices with versions, and any questions. Wait for my approval.

## Done when

* `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` all pass locally.
* `terraform fmt`, `validate`, `tflint` and `trivy config` pass for `infra/`.
* CI passes on the pull request, including a Terraform plan comment.
* After I complete `docs/setup.md` and merge, the dev web app shows "API status: ok" in Portuguese or English.
