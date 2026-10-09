# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

WeHobby is a hobby only social network: one community per hobby (crochet, plants, photography at launch), a "near me" feed, and low pressure photo posts. The MVP is a **mobile first web app (PWA)** on **Azure**.

The full product spec lives in `docs/PRD.md`. Read it before starting any feature. If a request conflicts with the PRD, stop and ask.

This repo is **public** and is also the owner's portfolio. Code quality, clear commits and a clean history matter.

## Deployment targets

The same app is deployed in several infrastructure scenarios (see `docs/README.md`). Keep the app independent of the hosting: configuration through environment variables, the same container images everywhere, and no code that assumes a specific Azure service.

* **Current target: scenario 01 (IaaS).** One Ubuntu VM running Docker Compose: Caddy (HTTPS, serves the web build, proxies `/api`), the API, and PostgreSQL + PostGIS. Photos in Blob Storage through the VM's managed identity. The VM was built by hand; `docs/scenarios/01-iaas/portal-guide.md` is the source of truth for what exists.
* **On hold until scenario 03 (Container Apps):** the Terraform in `infra/`, Container Apps, Static Web Apps and the `functions/` workspace. The conventions below still apply when that work starts.

## Stack

* **Monorepo** with npm workspaces, TypeScript everywhere, strict mode, ES modules.
* `web/`: React + Vite + TypeScript, PWA (vite-plugin-pwa), react-i18next with `pt` and `en` from day one. Mobile first CSS.
* `api/`: Node.js + Fastify + TypeScript. Zod for validation. Drizzle ORM with drizzle-kit migrations. PostgreSQL + PostGIS.
* `functions/` (scenario 03): Azure Functions (Node.js, TypeScript) for image processing, triggered by Event Grid on blob upload. Keep the processing logic in a shared package so the VM can run it in a worker container.
* `packages/shared/`: shared types and Zod schemas used by `web`, `api` and `functions`. Keep business rules here so a future React Native app can reuse them.
* `infra/` (scenario 03): **Terraform** with the `azurerm` provider. Reusable modules in `infra/modules/`, one root configuration per environment in `infra/envs/dev/` and `infra/envs/prod/`.
* `.github/workflows/`: GitHub Actions. Azure login uses OIDC (`azure/login` with client id, tenant id, subscription id). Never use publish profiles or service principal secrets.
* Container images go to **GitHub Container Registry** (ghcr.io), not Azure Container Registry, to keep costs at zero.

## Azure conventions

* Region: North Europe (`northeurope`), set as a variable in infrastructure code. See `docs/conventions/region.md`.
* Environments: `dev` and `prod`, each in its own resource group: `rg-wehobby-dev`, `rg-wehobby-prod`.
* Naming: `<type>-wehobby-<env>` (for example `ca-wehobby-api-dev`, `kv-wehobby-dev`, `swa-wehobby-dev`). Storage accounts: `stwehobby<env>`.
* Services talk to each other with **managed identities**. Secrets (VAPID keys, connection strings that cannot use identity) live in **Key Vault**.
* Cost matters: prefer Free and consumption tiers (Static Web Apps Free, Container Apps consumption with scale to zero, PostgreSQL Burstable). Ask before adding any service with a fixed monthly fee.

## Terraform conventions

* Pin the Terraform version and provider versions in `versions.tf`. Commit `.terraform.lock.hcl`.
* Remote state in an Azure Storage backend with Entra ID auth (`use_azuread_auth = true`, `use_oidc = true`). Never use storage access keys. One state file per environment.
* Never commit `*.tfstate`, `.terraform/` or real `*.tfvars`. Commit `terraform.tfvars.example` with placeholders only.
* Modules have `variables.tf` (with descriptions and types), `main.tf`, `outputs.tf` and a short `README.md`.
* Tag every resource with `project = "wehobby"`, `environment` and `managed_by = "terraform"`.
* Before every commit: `terraform fmt -recursive`, `terraform validate`, `tflint` and `trivy config` must pass.
* `terraform plan` runs on pull requests; `terraform apply` runs only from the deploy workflow after merge (prod needs manual approval).

## Local development

* Development happens in **GitHub Codespaces** (`.devcontainer/`). The owner's corporate laptop cannot reach the public npm registry, and the lockfile must only reference `registry.npmjs.org`.
* `docker compose up` runs PostGIS (`postgis/postgis`) and Azurite (Blob emulator).
* Local settings go in `.env.local` files, which are git ignored. Commit `.env.example` files with placeholder values only.

## Security and privacy rules (non negotiable)

* **Never commit secrets**, keys, tokens, connection strings, subscription ids or real personal data. Use placeholders in examples and seeds.
* Every write endpoint checks that the authenticated user owns the resource.
* Validate every request body with Zod schemas from `packages/shared`.
* Photo uploads use short lived, write only SAS tokens scoped to a single blob.
* Strip EXIF and GPS data from every image before it is shown.
* Round stored coordinates to about 1 km. Never return exact coordinates from the API; return a city or area label.
* Rate limit write endpoints.
* GDPR: users can export and delete all their data.

## Code conventions

* ESLint + Prettier. Run lint and typecheck before every commit.
* Vitest for unit tests. Every feature ships with tests for its main paths and its permission checks.
* Small, focused modules. No `any` without a comment explaining why.
* All user facing text goes through i18n keys in both `pt` and `en`. No hardcoded strings in components.
* Accessible UI: semantic HTML, labels on inputs, alt text on images.

## Git workflow

* Never push to `main`. Work on a branch (`feat/...`, `fix/...`, `chore/...`, `infra/...`) and open a pull request.
* Conventional commits (`feat: add hobby picker`, `fix: ...`, `infra: ...`).
* One vertical slice per pull request, with a short description of what changed and how it was tested.

## How to work

1. Read the relevant part of `docs/PRD.md`.
2. Propose a short plan (files to create or change, decisions, open questions) and **wait for approval** before writing code.
3. Build the slice end to end, with tests.
4. Run lint, typecheck, tests and build. Fix everything before saying it is done.
5. Do not run Azure deployments or change cloud resources yourself, and never run `terraform apply`. Write the Terraform and workflows, and tell the owner which commands or portal steps are needed.
6. Do not add new dependencies or services without saying why.

## Build order (MVP slices)

1. Monorepo scaffold, CI, "hello world" running on the scenario 01 VM at `https://wehobby.app` (see `docs/prompts/m1-hello-world-vm.md`), then automated deploys to the VM
2. Sign up and log in (Entra External ID)
3. Pick hobbies and set location
4. Post a photo (upload, processing, moderation)
5. Community feed with near me and type filters
6. Likes, comments, follows and notifications
7. Profile, report, block, delete, data export
