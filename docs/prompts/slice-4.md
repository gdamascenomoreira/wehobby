# Slice 4: set location with Azure Maps

Read `CLAUDE.md`, `docs/PRD.md` (feature 3 and "Data model and location privacy") and `docs/plan.md` first. Then look at how slice 3 is built (`packages/shared/src/hobbies.ts`, `api/src/routes/hobbies.ts`, `web/src/pages/HobbyStepPage.tsx`, `web/src/components/HobbyEditor.tsx`) and follow the same patterns.

We are building **slice 4** of the WeHobby MVP: **PRD feature 3, set location**. A user can share their location from the browser, or search and pick a city. We store only an approximate point (about 1 km) plus a city label, and we never return coordinates from the API. Location is optional.

Decisions already made (see `docs/plan.md`):
* City search and reverse geocoding use **Azure Maps** (Gen2), called **only from the API**, never from the browser.
* The API authenticates to Maps with the **VM managed identity** (Entra ID token), not a subscription key.
* The target is scenario 01 (the Bicep VM).

This slice has **three pull requests**, in this order. Start every branch from an up to date `main` (`git checkout main && git pull`). Stop after each PR and wait for me to merge it (and, for PR 1, to deploy it) before starting the next.

## PR 0: docs housekeeping (branch `docs/slice-4-prep`)

* In `CLAUDE.md`, replace the whole **Build order (MVP slices)** section with:

  ```markdown
  ## Build order (MVP slices)

  The plan, slice numbers and status live in `docs/plan.md`. Read it before starting a slice, and update its Status column in the same pull request that finishes a slice.
  ```

* Save this whole prompt (from the `# Slice 4` title to the end) as `docs/prompts/slice-4.md`.
* In `docs/plan.md`, set slice 4 to **In progress**.
* One commit: `docs: point CLAUDE.md to the MVP plan and add the slice 4 prompt`. Do not add `.devcontainer/devcontainer-lock.json`.

## PR 1: infrastructure (branch `infra/azure-maps`)

Change the scenario 01 Bicep in `docs/scenarios/01-iaas/bicep/`:

* New module `modules/maps.bicep`: Azure Maps account `map-wehobby-iaas-dev`, kind Gen2, sku G2, `disableLocalAuth: true` (no keys). Put it in an EU location and tell me which locations Azure Maps supports and why you picked one. Same tags as the other resources.
* Output the account's client id (`properties.uniqueId`) from the module and from `main.bicep`.
* `modules/roles.bicep`: role assignment **Azure Maps Data Reader** for the VM's managed identity, scoped to the Maps account (deterministic `guid()` name like the existing storage role).
* `modules/storage.bicep`: a CORS rule on the blob service for `https://wehobby.app` (methods PUT and OPTIONS; allowed headers `x-ms-blob-type`, `content-type`, `x-ms-*`; max age 3600). This is for slice 5, but goes in the same deploy so there is only one infra change.
* Rebuild `main.json` if the repo keeps it in sync.
* `deploy/vm/.env.example`: add `AZURE_MAPS_CLIENT_ID` (placeholder only).
* Update `bicep-guide.md` with a new section: what changed, the `az deployment group what-if` command to run first (I expect no change to the VM, disks or DNS), the deploy command in incremental mode with the same SSH key as before, and how to get the client id from the outputs and put it in `/opt/wehobby/.env`. Add a change log entry in `deployment-log.md`.

Do not run any Azure command. PR 1 is done when the Bicep builds (`az bicep build` or the CI check, if any) and the guide has the exact commands for me.

## PR 2: the app (branch `feat/location`)

### Shared (`packages/shared`)
* New `location.ts`: Zod schemas and types for the place search query (trimmed, 3 to 80 characters), a place result (`id`, `label`, `countryCode`), and the body of `PUT /me/location`: **either** `{ placeId }` **or** `{ lat, lng }` (valid ranges), never both.
* `roundCoordinate()` helper: round to 2 decimal places (about 1 km). The web app and the API both use it.
* The user's location in API responses is only `{ label, countryCode } | null`.
* Unit tests for the schemas and the rounding.

### Database (one Drizzle migration)
* `CREATE EXTENSION IF NOT EXISTS postgis` at the start of the migration.
* `places`: `id` (uuid), `label` (for example "Vila Franca de Xira, Lisboa"), `country_code` (ISO 3166 alpha 2), `centre geography(Point, 4326)`, `language` (`pt` or `en`), `created_at`; GiST index on `centre`; unique on (`label`, `country_code`, `language`).
* `users`: add `location geography(Point, 4326)` (nullable, always rounded), `location_label`, `location_country_code`; GiST index on `location`.
* Drizzle has no native geography type: use a small `customType` and keep the raw SQL in one place.

### API (`api`)
* A `geocoder` module behind an interface with two methods: `search(query, language)` and `reverse(lat, lng, language)`, each returning label, country code and centre point.
  * `AzureMapsGeocoder`: uses `@azure/identity` (`ManagedIdentityCredential` on the VM, `DefaultAzureCredential` locally) for a token with scope `https://atlas.microsoft.com/.default`, and sends `Authorization: Bearer <token>` plus `x-ms-client-id: <AZURE_MAPS_CLIENT_ID>`. Use the current **GA** Azure Maps Search v2 geocoding and reverse geocoding REST APIs; check the docs for the right endpoints and `api-version`, and tell me what you chose. Ask Maps for locality level results (city or municipality), not street addresses. Short timeout, clear error on failure.
  * `FakeGeocoder`: a fixture of about 10 Portuguese and a few other cities, used in tests, in CI and locally when `GEOCODER=fake`.
  * Config: `GEOCODER` (`azure` or `fake`, default `azure` in production, `fake` in development and test), `AZURE_MAPS_CLIENT_ID` required only when `GEOCODER=azure`. Add both to `deploy/vm/compose.yaml` for the `api` service.
* `GET /places/search?q=`: validates the query, checks the `places` cache first, calls the geocoder on a miss, saves every result in `places`, and returns `[{ id, label, countryCode }]` (at most 5) in the user's language. Rate limited with `LOOKUP_RATE_LIMIT`.
* `PUT /me/location`:
  * `{ placeId }`: copy that place's centre, label and country to the user.
  * `{ lat, lng }`: round with `roundCoordinate()` **before** anything else, reverse geocode the rounded point, save the result as a place (cache) and on the user.
  * Rate limited with `WRITE_RATE_LIMIT`. Returns `{ label, countryCode }`.
* `DELETE /me/location`: clears all three columns.
* `GET /me` includes `location: { label, countryCode } | null`.
* **No endpoint ever returns coordinates.** Add a test that checks every location response body has no `lat`, `lng`, `centre` or `location` point.
* Log Maps errors without the query text or coordinates.

### Web (`web`)
* A **location step** after the hobby step in onboarding, with a **Skip** button (location is optional). It has:
  * A short consent text: we keep only your approximate area (about 1 km), we show only the city name, never a map pin, and you can remove it any time in Settings.
  * **Use my current location**: `navigator.geolocation.getCurrentPosition` with `enableHighAccuracy: false`; round with `roundCoordinate()` in the browser before sending. Handle "permission denied" and "unavailable" with a friendly message that points to the city search.
  * **Search for your city**: an accessible combobox; debounce 300 ms, minimum 3 characters, shows up to 5 results; picking one calls `PUT /me/location` with the `placeId`.
* Existing users with no location are **not** forced into the step; Home shows a small, dismissible "Add your area to see people near you" card that opens the same step. Remember the dismissal in `localStorage` (wrapped in try/catch).
* Settings: a "Your area" section showing the label, with **Change** (same component) and **Remove my location** (calls `DELETE /me/location`, with a confirm step inside the page, no `window.confirm`).
* Reuse one `LocationPicker` component in onboarding, Home and Settings.
* All text in `pt` (Portugal) and `en` i18n keys. Mobile first, keyboard and screen reader friendly.

### Tests
* Shared: schemas (both body shapes, neither, both at once, out of range values) and rounding.
* API with `FakeGeocoder`: search cache miss then hit (geocoder called once), language handling, `PUT` with `placeId` and with coordinates (stored point is rounded), unknown `placeId` is 404, `DELETE`, 401 without a token, a user cannot change another user's location, rate limits, and no coordinates in any response.
* `AzureMapsGeocoder` unit test with a mocked `fetch` and credential: correct URL, headers and parsing; timeout and error paths.
* Web: the step shows after the hobby step and can be skipped; permission denied falls back to search; picking a city updates Settings; Remove works; both languages render.

### Finish
* In `docs/plan.md`, set slice 4 to **Done** in this PR.

## Out of scope
* The near me feed filter and any distance query (slice 6).
* Post locations (slice 6).
* Maps in the browser, map tiles or any map view.
* The worker and photo uploads (slice 5), apart from the CORS rule in PR 1.

## Rules
* Follow `CLAUDE.md` (no secrets, branches and PRs, conventional commits).
* Do not run any Azure command or deployment yourself. Tell me exactly what to run.
* New dependencies only where needed (`@azure/identity` is expected); say why for each.
* Business rules (query limits, rounding, schemas) live in `packages/shared`.
* Never stage `.devcontainer/devcontainer-lock.json`.

## Before writing code
Do PR 0 straight away (docs only, no plan needed). Then give me a short plan for **PR 1**: the Bicep changes, the Maps location you picked, and the exact `what-if` and deploy commands. Wait for my approval. After I confirm PR 1 is deployed and `AZURE_MAPS_CLIENT_ID` is in `/opt/wehobby/.env`, give me the plan for **PR 2**: the schema, the Maps endpoints and `api-version` you will use, the API routes with request and response shapes, and the component list. Wait for my approval again.

## Done when
* PR 0: merged, `CLAUDE.md` points to `docs/plan.md`.
* PR 1: the Bicep builds, `what-if` on the real resource group shows only the new Maps account, the role assignment and the CORS change, and the guide is updated.
* PR 2: `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass locally and in CI, and the PR description says what changed and how it was tested.
* After deploying PR 2 to the Bicep VM (new `IMAGE_TAG`, `docker compose pull`, `docker compose up -d`), `docker compose logs migrate` shows the new migration applied.
* On my phone at wehobby.app: "Use my current location" shows my municipality, searching "Lisboa" lets me pick it, Settings shows the label, Remove clears it, in Portuguese and in English. No API response contains coordinates.
