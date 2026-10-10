# Module: container_app_api

Creates a Container Apps environment (consumption plan) and the API container app.

* Logs go to the Log Analytics workspace passed in `log_analytics_workspace_id`.
* The app scales to zero when idle (`min_replicas = 0`) and up to `max_replicas` on HTTP load. The first request after an idle period has a cold start of a few seconds.
* The image comes from **GitHub Container Registry** and must be public, so no registry credentials are needed.
* External HTTPS ingress on the default `*.azurecontainerapps.io` hostname. `/api/health` is used for the startup, liveness and readiness probes.
* A system assigned managed identity is enabled for later access to Key Vault and other Azure services.
* `CORS_ORIGIN` is set from `cors_origins`, so only the web app can call the API from a browser.

See `variables.tf` for inputs and `outputs.tf` for outputs.
