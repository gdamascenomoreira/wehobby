# Region

All resources for an environment are deployed in a single EU region. All user data stays in the EU (see the privacy section of the main README).

## Decision

| Item | Value |
|---|---|
| Region | West Europe (`westeurope`), the default in `CLAUDE.md` |
| Status | Default, to be confirmed against the criteria below |

## Criteria

- **Latency** to the main audience (Portuguese and English speaking users, starting from Portugal)
- **Price** of the VM sizes and disks used (compare in the [Azure Pricing Calculator](https://azure.microsoft.com/pricing/calculator/))
- **Service availability:** every service planned across all scenarios must exist in the region (Container Apps, AKS, PostgreSQL Flexible Server with PostGIS, Bastion Developer SKU, Azure Load Testing, Azure AI Content Safety)
- **Capacity:** some popular regions occasionally restrict new deployments of certain VM sizes; check quota before deploying
- **Availability zones**, for the resilience comparison in later scenarios

## Candidates

| Region | Name in CLI and Terraform |
|---|---|
| West Europe | `westeurope` |
| North Europe | `northeurope` |
| Sweden Central | `swedencentral` |
| France Central | `francecentral` |
| Spain Central | `spaincentral` |
