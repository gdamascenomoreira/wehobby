# Milestone 1: hello world on the scenario 01 VM

Replaces the hosting part of [slice 1](slice-1.md) for scenario 01. The Terraform, Container Apps, Static Web Apps and `functions/` parts of slice 1 are on hold until scenario 03.

Paste everything below the line into Claude Code, from the root of the `wehobby` repo.

---

Read `CLAUDE.md`, `docs/PRD.md` and `docs/scenarios/01-iaas/portal-guide.md` (steps 9d to 9f describe what is running on the VM today).

We are building **milestone 1** of the WeHobby MVP: a monorepo that builds and tests in CI, and a "hello world" web app and API running on the scenario 01 VM at `https://wehobby.app`. No product features, no database code yet.

## Decisions already made

| Topic | Decision |
|---|---|
| Hosting | Scenario 01 VM (`vm-wehobby-iaas-dev-01`, North Europe), Docker Compose in `/opt/wehobby`, data on `/datadisk` |
| Domain | `wehobby.app` is the main address, `www.wehobby.app` redirects to it, `iaas.wehobby.app` keeps working. The apex points at the VM until scenario 03 |
| Auto shutdown | Stays on (the schedule is kept). Nightly downtime of the public site is accepted |
| Edge | Caddy serves the web build and proxies `/api/*` to the API container. Same origin on the VM, so no CORS |
| Images | Public packages on ghcr.io: `ghcr.io/gdamascenomoreira/wehobby-web` (Caddy + web build) and `ghcr.io/gdamascenomoreira/wehobby-api` |
| Deploy | Manual in this milestone, through Bastion. Automated deploys (OIDC + `az vm run-command`) are milestone 2 |
| Node | 24 LTS |
| Storage | Public network access from all networks, container private, SAS only (used from milestone 5) |

## Scope

**1. Monorepo**
* npm workspaces: `web`, `api`, `packages/shared`. Root `tsconfig.base.json` (strict), ESLint flat config, Prettier, Vitest.
* Root scripts: `lint`, `typecheck`, `test`, `build`, `format`.
* `engines.node` `>=24`, plus `.nvmrc`. The committed `.npmrc` pins the public registry; the lockfile must only reference `registry.npmjs.org`.
* Extend `.gitignore` if needed (Vite, coverage, Terraform entries for later).

**2. packages/shared**
* A `HealthResponse` Zod schema and type, used by both `api` and `web`.

**3. api**
* Fastify + TypeScript. Routes live under the `/api` prefix inside the app, so no path rewriting is needed behind Caddy or on PaaS later.
* `GET /api/health` returns `{ status: "ok", version }`, validated with the shared schema.
* Configuration read from environment variables and validated with Zod at startup (`PORT`, `HOST`, `LOG_LEVEL`, `APP_VERSION`, optional `CORS_ORIGIN` that is off by default).
* Structured logging (pino), graceful shutdown on `SIGTERM`.
* Multi-stage Dockerfile, small production image, non-root user, `HEALTHCHECK`.
* Vitest tests for `/api/health` and the config validation.

**4. web**
* React + Vite + TypeScript PWA (manifest name "WeHobby", theme color, placeholder icons).
* react-i18next with `pt` and `en`, browser language as default, a language picker.
* Mobile first home page: the WeHobby name, a one line tagline, and the API status from `/api/health` (relative URL; Vite dev server proxies `/api` to `localhost:3000`).
* Vitest tests for the language switch and for the status display (ok and error).

**5. Edge image (`wehobby-web`)**
* Multi-stage Dockerfile: build the web app with Node, then copy `dist` into `caddy:2` with the Caddyfile.
* Caddyfile with the site address from an environment variable (default `wehobby.app, iaas.wehobby.app`), so the same image runs locally on `:80`:
  * `www.wehobby.app` permanently redirects to `https://wehobby.app`
  * `/api/*` → `api:3000`
  * `/health` still answers `ok` (used by monitoring and the load tests)
  * SPA fallback to `index.html`
  * security headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, a basic CSP)
  * hashed assets cached as immutable, `index.html` and the service worker `no-cache`
  * gzip and zstd compression

**6. VM deployment files (`deploy/vm/`)**
* `compose.yaml` for the VM: `caddy` (wehobby-web image), `api`, `db`. Keep the existing `db` settings and the `/datadisk/postgres`, `/datadisk/caddy/data` and `/datadisk/caddy/config` volumes exactly as in the portal guide, so the database and the certificates carry over. Image tags come from `IMAGE_TAG` in `/opt/wehobby/.env`.
* `.env.example` with placeholders only.
* The API is not published on the host; only Caddy has ports.

**7. Local development**
* Root `docker-compose.yml` with PostGIS and Azurite (not used by code yet).
* A way to run the production images locally (for example `SITE_ADDRESS=:80 docker compose -f deploy/vm/compose.yaml up`), documented in the README.
* `.env.example` files with placeholders only.

**8. GitHub Actions**
* `ci.yml`: on pull requests and pushes to `main`: `npm ci`, lint, typecheck, test, build, and build both Docker images (no push on pull requests).
* `images.yml`: on push to `main` (and manual trigger): build and push both images to ghcr.io, tagged `sha-<short sha>` and `main`, with OCI labels linking to the repo.
* Actions pinned to commit SHAs (with a version comment), least privilege `permissions:` in every workflow (`packages: write` only where images are pushed).

**9. Docs**
* A new step in `docs/scenarios/01-iaas/portal-guide.md`, **Step 11: Deploy the app (milestone 1)**, in the same style as the other steps, with every command I need to run myself:
  1. Azure DNS: add `@` and `www` A alias records to `pip-vm-wehobby-iaas-dev-01`, check with `nslookup`. Do this **before** restarting Caddy, so Let's Encrypt can validate the new names.
  2. GitHub: make both ghcr.io packages public after the first image push.
  3. On the VM, through Bastion: back up the current `compose.yaml` and `Caddyfile`, download `deploy/vm/compose.yaml` from the repo at a specific commit, set `IMAGE_TAG` in `.env` (keeping `POSTGRES_PASSWORD`), `docker compose pull`, `docker compose up -d`, remove the old `site/` folder and Caddyfile once it works.
  4. Checks: certificates for all three names in the Caddy logs, `https://wehobby.app` shows "API status: ok", `www` redirects, `/api/health` returns JSON, port 3000 is not listening on the host, the database data is still there.
  5. Rollback: put the previous `IMAGE_TAG` back and run `docker compose up -d`.
* Update the deployment log (step 9) and the README tech stack and architecture sections.

## Out of scope

Drizzle, migrations and any database code, auth, automated deploys, Terraform, Azure Functions, Application Insights.

## Rules

* Follow `CLAUDE.md` (no secrets, branch + pull request, conventional commits). The branch is `feat/m1-hello-world-vm`.
* Do not run any Azure command yourself and do not connect to the VM.
* Keep dependencies to what this milestone needs, and say why for each one.

## Before writing code

Give me a short plan: the folder tree, the main library choices with versions, and any questions. Wait for my approval.

## Done when

* `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass locally.
* Both images build, and the production compose file runs locally and shows "API status: ok" on `http://localhost`.
* CI passes on the pull request.
* After merging and following step 11, `https://wehobby.app` shows "API status: ok" in Portuguese or English, with a valid certificate.
