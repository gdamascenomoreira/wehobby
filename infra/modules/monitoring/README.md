# Module: monitoring

Creates a Log Analytics workspace and a workspace based Application Insights component.

| Resource | Name |
| --- | --- |
| Log Analytics workspace | `log-<name_suffix>` |
| Application Insights | `appi-<name_suffix>` |

Ingestion is capped with `daily_quota_gb` (1 GB per day by default) so a noisy deploy cannot run up the bill.

See `variables.tf` for inputs and `outputs.tf` for outputs.
