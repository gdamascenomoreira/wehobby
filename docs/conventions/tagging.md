# Tagging

Every resource and resource group gets these tags. They make Cost Management reports per scenario possible, which is essential for the comparison.

## Mandatory tags

| Tag | Purpose | Allowed values |
|---|---|---|
| `project` | Groups all WeHobby resources | `wehobby` |
| `environment` | Environment | `dev`, `prod` |
| `managed_by` | How the resource was created | `portal`, `bicep`, `terraform` |
| `scenario` | Infrastructure scenario (comparison deployments only) | `01-iaas`, `02-paas`, `03-aca`, `04-aks`, `05-serverless` |

`project`, `environment` and `managed_by` match the Terraform conventions in `CLAUDE.md`. `scenario` is added for the comparison deployments.

## Example (scenario 01, manual deployment)

```
project     = wehobby
environment = dev
managed_by  = portal
scenario    = 01-iaas
```

## Notes

- `managed_by` lets the portal, Bicep and Terraform builds be compared on cost and drift.
- Tags on a resource group are **not** inherited by the resources inside it. Apply them to every resource (or use the Azure Policy "Inherit a tag from the resource group if missing" later).
- Keep tag names and values lowercase.
