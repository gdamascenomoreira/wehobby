# Scenario 01: IaaS deployment log

Manual deployment in the Azure portal. Every resource, every setting chosen and why. This log is the spec for the Bicep and Terraform versions.

## Architecture (budget version)

- One Ubuntu VM (B-series) running Docker Compose: app, PostgreSQL + PostGIS (`postgis/postgis` image, same as local dev), Caddy (HTTPS with Let's Encrypt)
- PostgreSQL data on a separate Standard SSD data disk
- Photos in Blob Storage, reached through a service endpoint, accessed with the VM's managed identity
- SSH only from a trusted IP, no Azure Bastion hourly cost

## Deployment order

| # | Step | Status |
|---|---|---|
| 1 | Resource group | ⬜ |
| 2 | Budget alert | ⬜ |
| 3 | Virtual network and subnet | ⬜ |
| 4 | Network security group | ⬜ |
| 5 | Storage account | ⬜ |
| 6 | Virtual machine | ⬜ |
| 7 | Role assignment (VM identity on storage) | ⬜ |
| 8 | DNS record | ⬜ |
| 9 | VM configuration (disk, Docker, app) | ⬜ |
| 10 | Backups | ⬜ |

---

## 1. Resource group

| Setting | Value | Why |
|---|---|---|
| Name | `rg-wehobby-iaas-dev` | |
| Region | West Europe | See [region](../../conventions/region.md) |
| Tags | project, environment, managed_by, scenario | See [tagging](../../conventions/tagging.md) |

**Notes / issues:**

## 2. Budget alert

| Setting | Value | Why |
|---|---|---|
| Scope | Resource group | |
| Amount | | |
| Alerts | 50%, 80%, 100% (actual) | |

**Notes / issues:**

## 3. Virtual network

| Setting | Value | Why |
|---|---|---|
| Name | `vnet-wehobby-iaas-dev` | |
| Address space | `10.10.0.0/16` | |
| Subnet | `snet-app` `10.10.1.0/24` | |
| Service endpoint | `Microsoft.Storage` on `snet-app` | Free alternative to a private endpoint |

**Notes / issues:**

## 4. Network security group

| Setting | Value | Why |
|---|---|---|
| Name | `nsg-wehobby-iaas-dev` | |
| Inbound 80, 443 | Allow from Internet | Web traffic and Let's Encrypt validation |
| Inbound 22 | Allow from my public IP only | No Bastion cost |
| Associated to | `snet-app` | |

**Notes / issues:**

## 5. Storage account

| Setting | Value | Why |
|---|---|---|
| Name | `stwehobbyiaasdev` | |
| Kind / redundancy | StorageV2, Standard LRS | Cheapest for dev |
| Access tier | Hot | |
| Anonymous blob access | Disabled | |
| Shared key access | | |
| Network | Selected networks: `snet-app` + my IP | |
| Container | `photos` (private) | |

**Notes / issues:**

## 6. Virtual machine

| Setting | Value | Why |
|---|---|---|
| Name | `vm-wehobby-iaas-dev-01` | |
| Image | Ubuntu 24.04 LTS | |
| Size | B2als v2 | Burstable, fits low MVP traffic |
| Authentication | SSH public key | |
| OS disk | Standard SSD | |
| Data disk | Standard SSD, 32 GiB, LUN 0 | PostgreSQL data |
| Subnet | `snet-app` | |
| Public IP | Standard, static, DNS label | |
| NIC NSG | None (subnet NSG applies) | |
| Managed identity | System assigned | Keyless access to Blob |
| Auto shutdown | | Cost control |
| Boot diagnostics | Managed storage | |

**Notes / issues:**

## 7. Role assignment

| Setting | Value | Why |
|---|---|---|
| Scope | Storage account | |
| Role | Storage Blob Data Contributor | |
| Assignee | VM system assigned identity | |

**Notes / issues:**

## 8. DNS

| Setting | Value | Why |
|---|---|---|
| Record | `iaas.wehobby.app` A → VM public IP | |
| DNS hosted at | | |

**Notes / issues:**

## 9. VM configuration

_To be documented: data disk mount, Docker install, Compose stack, Caddy._

## 10. Backups

_To be documented: snapshots, `pg_dump` to Blob Cool tier, restore test._

---

## Measurements

| Metric | Value | How measured |
|---|---|---|
| Time to deploy (manual) | | |
| Monthly cost estimate | | Pricing calculator |
| Actual cost (1 week) | | Cost Management, filtered by tag |
| p95 latency | | Azure Load Testing |

## Lessons learned / post ideas

-
