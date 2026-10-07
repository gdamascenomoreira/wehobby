# Naming convention

Based on the [Cloud Adoption Framework naming guidance](https://learn.microsoft.com/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming).

## Pattern

```
<resource type>-wehobby[-<scenario>]-<env>[-<instance>]
```

| Part | Meaning | Values |
|---|---|---|
| resource type | CAF abbreviation for the resource | see table below |
| scenario | Infrastructure scenario, only for comparison deployments | `iaas`, `paas`, `aca`, `aks`, `sls` |
| env | Environment | `dev`, `prod` |
| instance | Only when there can be more than one | `01`, `02`, ... |

All names are lowercase. The region is not part of the name; every environment lives in a single region (see [Region](region.md)).

The main MVP environments keep the short form from `CLAUDE.md`, for example `rg-wehobby-dev`, `ca-wehobby-api-dev`. Comparison scenarios add the scenario part so they never collide with the MVP resources.

## Examples for scenario 01 (IaaS)

| Resource | Abbreviation | Name |
|---|---|---|
| Resource group | `rg` | `rg-wehobby-iaas-dev` |
| Virtual network | `vnet` | `vnet-wehobby-iaas-dev` |
| Subnet | `snet` | `snet-app` |
| Network security group | `nsg` | `nsg-wehobby-iaas-dev` |
| Virtual machine | `vm` | `vm-wehobby-iaas-dev-01` |
| OS disk | `osdisk` | `osdisk-vm-wehobby-iaas-dev-01` |
| Data disk | `disk` | `disk-vm-wehobby-iaas-dev-01-data` |
| Network interface | `nic` | `nic-vm-wehobby-iaas-dev-01` |
| Public IP | `pip` | `pip-vm-wehobby-iaas-dev-01` |
| Storage account | `st` | `stwehobbyiaasdev` |
| Budget | `budget` | `budget-wehobby-iaas-dev` |

## Exceptions

- **Storage accounts** allow only lowercase letters and numbers, 3 to 24 characters, globally unique. Hyphens are removed: `stwehobbyiaasdev`. Add a short suffix if the name is taken.
- **Subnets** live inside a VNet, so they only need a role name: `snet-app`, `snet-data`.
- **Disks and NICs** created by the portal get generated names by default. Rename them in the VM creation wizard so the manual build matches the Bicep and Terraform builds.
