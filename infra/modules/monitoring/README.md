# Module: monitoring

Creates a Log Analytics workspace and a workspace based Application Insights component.

| Resource | Name |
| --- | --- |
| Log Analytics workspace | `log-<name_suffix>` |
| Application Insights | `appi-<name_suffix>` |

Ingestion is capped with `daily_quota_gb` so a noisy deploy cannot run up the bill. The default, 0.15 GB per day, keeps a month of ingestion inside the 5 GB monthly free allowance.

See `variables.tf` for inputs and `outputs.tf` for outputs.
