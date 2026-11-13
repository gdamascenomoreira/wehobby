# WeHobby MVP plan

Last updated: 13 Nov 2026

## Where we are

WeHobby runs on scenario 01 (IaaS): one Ubuntu VM built with Bicep in `rg-wehobby-iaas-dev-bicep`, serving wehobby.app. Sign in, profiles (PRD feature 1), hobby selection (PRD feature 2) and location (PRD feature 3) are deployed. Features 4 to 7 and the safety work are still ahead.

The focus now is the app itself. Terraform and Container Apps (scenario 03) stay on hold, so the running VM and its data never need a migration while the MVP is built.

## Decisions log

Settled decisions, newest first. Reopen one only on purpose.

| Date | Decision | Why |
| --- | --- | --- |
| 13 Nov 2026 | Slice 5 signs SAS links and reads blobs with hand written REST calls, not `@azure/storage-blob`; local development uses a fake storage folder served by the API | Same approach as the IMDS credential, no SDK dependency; Azurite does not support user delegation SAS without OAuth and HTTPS |
| 13 Nov 2026 | Photos accept JPEG, PNG and WebP up to 15 MB and are stored as WebP | The prebuilt `sharp` cannot decode HEIC; iPhone Safari sends library photos as JPEG |
| 2 Nov 2026 | Image processing runs in a `worker` container in `compose.yaml`, with a PostgreSQL job table as the queue | No new service; same API image with another command; closer to the Functions design of scenario 03 |
| 2 Nov 2026 | City search and reverse geocoding use Azure Maps (Gen2), called only from the API with the VM managed identity | 5,000 free search transactions a month covers the MVP; no key in code ([pricing](https://azure.microsoft.com/en-us/pricing/details/azure-maps/)) |
| 2 Nov 2026 | Build the app on scenario 01 now; Terraform and scenario 03 wait | Redeploying infra now would force data migrations |
| 28 Oct 2026 | Sign in with Entra External ID (email and Google) | PRD feature 1 |
| 22 Oct 2026 | Bicep VM is the only VM; portal VM retired; Bicep owns all wehobby.app DNS records | One source of truth for scenario 01 |
| Oct 2026 | Each scenario is built three times: portal, then Bicep, then Terraform | Portfolio and comparison of Azure options |
| Oct 2026 | Container images on GitHub Container Registry, not ACR | Zero cost |
| Sep 2026 | MVP is a mobile first web app (PWA) on Azure, North Europe; native apps in phase 2 | No app store fees; EU region for GDPR |
| Sep 2026 | Name WeHobby, domain wehobby.app, DNS delegated to Azure DNS | No WeHobby trademark found in TMview |
| Sep 2026 | Launch hobbies: crochet, plants, photography; languages pt and en | PRD scope |

## Full plan

Six steps are done and seven remain before launch. Each remaining step is one pull request (a vertical slice) in PRD order. Only slices 4 and 5 touch infra, and both changes are additive in Bicep.

| # | Step | PRD feature | Infra change | Status |
| --- | --- | --- | --- | --- |
| 1 | Slice 1: monorepo scaffold, CI, hello world (PR #5) | | | ✅ Done |
| 2 | Scenario 01 in the portal, steps 1 to 10 (PRs #6 to #18) | | Built by hand | ✅ Done |
| 3 | Milestone 1: app on the VM at wehobby.app (PR #16) | | | ✅ Done |
| 4 | Scenario 01 rebuilt in Bicep, DNS owned by Bicep, portal VM retired (PRs #19 to #21) | | Bicep | ✅ Done |
| 5 | Slice 2: sign in, profile, username, language, age 16+ (PRs #22 to #24) | 1 | | ✅ Done |
| 6 | Slice 3: hobbies and hobby types in onboarding and settings | 2 | None | ✅ Done |
| 7 | Slice 4: location with Azure Maps | 3 | Azure Maps account + Data Reader role for the VM identity | ✅ Deployed |
| 8 | Slice 5: photo upload pipeline with the worker container | 4 (part) | Blob CORS for wehobby.app (deployed); lifecycle rule on `incoming/` | 🟡 In progress (PR 1 of 3) |
| 9 | Slice 6: posts, community feeds, home feed, near me | 4, 5 | None | ⬜ Not started |
| 10 | Slice 7: likes, comments, replies, follows, notification bell | 6 | None | ⬜ Not started |
| 11 | Slice 8: profile portfolio and avatar | 7, 1 (avatar) | None | ⬜ Not started |
| 12 | Slice 9: safety and GDPR (report, block, delete, export, admin page, Content Safety, guidelines, privacy policy) | Safety | Azure AI Content Safety (ask first) | ⬜ Not started |
| 13 | Slice 10: launch prep (seed posts, iPhone Safari tests, web push) | 6 (push) | VAPID keys | ⬜ Not started |

## Next steps

1. **Slice 5, photo pipeline, in three PRs:**
    1. `feat/uploads-api`: upload schemas, `uploads` and `jobs` tables, SAS links signed with a user delegation key, `POST /uploads`, `POST /uploads/:id/complete`, `GET /uploads/:id`. **Changes `deploy/vm/compose.yaml`** (storage settings for the API) and needs `STORAGE_ACCOUNT_NAME` in `/opt/wehobby/.env`.
    2. `feat/image-worker`: `packages/images` with `sharp`, the `worker` container and the lifecycle rule on `incoming/`. **Changes `deploy/vm/compose.yaml`.**
    3. `feat/upload-ui`: photo picker, upload with progress, test page. End to end test on the phone.
2. Slices 6 to 10 in order, one PR each; update the Status column as each merges.

Terraform waits until scenario 03. Port the Maps and CORS resources to Terraform then, using the Bicep as the spec.

## Deploy checklist

After a pull request merges and the images workflow has built the new tag, on the VM (`/opt/wehobby`):

1. **If the PR changed anything under `deploy/vm/`**, update the VM copy of `compose.yaml` first. The VM does not pull the repo, so it keeps the old file otherwise.
    ```bash
    cd /opt/wehobby
    sudo cp compose.yaml compose.yaml.bak-$(date +%Y%m%d-%H%M)
    curl -fsSL https://raw.githubusercontent.com/gdamascenomoreira/wehobby/main/deploy/vm/compose.yaml -o /tmp/compose.yaml
    diff -u compose.yaml /tmp/compose.yaml   # read it: only the changes from the PR
    sudo cp /tmp/compose.yaml compose.yaml
    sudo docker compose config --quiet && echo OK   # also catches .env values the new file requires
    ```
2. **If the PR added settings** (its Deploy section says so), add them to `/opt/wehobby/.env` and compare with `.env.example`.
3. Set `IMAGE_TAG` in `.env` to the new tag, then `sudo docker compose pull && sudo docker compose up -d`.
4. Check `sudo docker compose ps` (every service healthy, `migrate` exited 0) and `sudo docker compose logs migrate api --tail 50`.
5. Test on the phone at wehobby.app, then record the deploy in `deployment-log.md`.

Every PR description has a Deploy section that says whether `deploy/vm/` changed and which `.env` values are new.

## Slice details

Every slice ships with tests for its main paths and permission checks, and all UI text in pt and en. The prompt for each slice lives in [`prompts/`](prompts/).

### Slice 4: location with Azure Maps (PRD feature 3)

- Migration: `CREATE EXTENSION IF NOT EXISTS postgis`; `users.location geography(Point, 4326)` rounded to about 1 km, `users.city_label`, `users.country_code`.
- `places` table caches label, country and centre point (GiST index), so each city is looked up once.
- API calls Maps with a managed identity token (`https://atlas.microsoft.com/.default`) plus the `x-ms-client-id` header; never from the browser.
- `GET /places/search?q=` (minimum 3 characters, debounced in the web app) and `POST /me/location` with `{ placeId }` or `{ lat, lng }`; the API rounds coordinates before reverse geocoding.
- Responses carry only the label, never coordinates. Location stays optional, with "Remove my location" in Settings.

### Slice 5: photo pipeline with the worker (part of PRD feature 4)

1. `POST /uploads` creates an `uploads` row and returns a user delegation SAS: write only, one blob `photos/incoming/<uploadId>`, about 5 minutes.
2. The browser uploads the file straight to Blob Storage.
3. `POST /uploads/:id/complete` checks ownership and inserts a row in `jobs`.
4. The worker claims the job with `SELECT ... FOR UPDATE SKIP LOCKED` and downloads the blob with the VM identity.
5. `sharp` auto rotates, re-encodes (strips EXIF and GPS) and writes `processed/<uploadId>/full` (about 1600 px) and `/thumb` (about 400 px).
6. The worker deletes the incoming blob and marks the upload `ready`; failures retry with backoff, then end as `failed`.

- Processing logic lives in `packages/images` (buffer in, buffers out) so Azure Functions can reuse it in scenario 03.
- `compose.yaml` gets a `worker` service: same `wehobby-api` image, `command: ['node', 'dist/worker.js']`, no ports, a heartbeat healthcheck, starts after `migrate`.
- Photos are served through short lived read SAS links; the container stays private.

## Later

After the MVP launches on scenario 01, the infra comparison and the product roadmap continue.

| Track | What | When |
| --- | --- | --- |
| Scenario 01 | Terraform version of the IaaS build | After the MVP, when a redeploy is acceptable |
| Scenario 02 | Classic PaaS: App Service, PostgreSQL Flexible Server | After scenario 01 |
| Scenario 03 | Container Apps, Static Web Apps, Functions (the `infra/` Terraform on hold today) | After scenario 02 |
| Scenario 04 | Kubernetes (AKS) | Planned |
| Scenario 05 | Fully serverless: Static Web Apps, Functions, Cosmos DB (optional) | Planned |
| Product phase 2 | Native iOS and Android, DMs, saved posts, search, more hobbies, shop partner profiles | When people post and comment regularly |
| Product phase 3 | Meetups and events, marketplace, creator tools | After phase 2 |
| Product phase 4 | Hobby tools (plant timeline, pattern library), recommendations | After phase 3 |

Open question: moving from scenario 01 to another scenario needs a data migration plan (PostgreSQL dump and restore, blob copy). Write it before the first switch.
