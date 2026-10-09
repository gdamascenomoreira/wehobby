# Scenario 01: IaaS deployment log

Manual deployment in the Azure portal. Every resource, every setting chosen and why. This log is the spec for the Bicep and Terraform versions.

## Architecture (budget version)

- One Ubuntu VM (B-series) running Docker Compose: app, PostgreSQL + PostGIS (`postgis/postgis` image, same as local dev), Caddy (HTTPS with Let's Encrypt)
- PostgreSQL data on a separate Standard SSD data disk
- Photos in Blob Storage, reached through a service endpoint, accessed with the VM's managed identity
- SSH only through Azure Bastion Developer (free), no SSH port open to the internet

## Deployment order

| # | Step | Status |
|---|---|---|
| 1 | Resource group | ✅ |
| 2 | Budget alert | ✅ |
| 3 | Virtual network and subnet | ✅ |
| 4 | Network security group | ✅ |
| 5 | Storage account | ✅ |
| 6 | Virtual machine | ✅ |
| 7 | Role assignment (VM identity on storage) | ✅ |
| 8 | DNS record | ✅ `iaas` · ⬜ apex and `www` |
| 9 | VM configuration (disk, Docker, placeholder site) | ✅ |
| 10 | Backups | ⏭️ Skipped (decision) |

---

## 1. Resource group

| Setting | Value | Why |
|---|---|---|
| Name | `rg-wehobby-iaas-dev` | |
| Region | North Europe | See [region](../../conventions/region.md) |
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
| Inbound 22 | No custom rule. Bastion Developer allowed by default rule `AllowAzureLoadBalancerInBound` (`168.63.129.16`) | No SSH exposed to the internet |
| Associated to | `snet-app` | |

**Notes / issues:**

## 5. Storage account

| Setting | Value | Why |
|---|---|---|
| Name | `stwehobbyiaasdev` | |
| Kind / redundancy | StorageV2, Standard LRS | Cheapest for dev |
| Access tier | Hot | |
| Anonymous blob access | Disabled | |
| Shared key access | Enabled | To review: user delegation SAS (signed with the managed identity) does not need it |
| Network | All networks (public access) | Browsers upload and download photos directly with short lived SAS links. The container stays private. Was `snet-app` + my IP, which blocked browser uploads |
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
| Auto shutdown | On | Cost control. Accepted trade off: the public site is down while the VM is off |
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
| Records | `iaas`, `@` (apex) and `www`: A alias records → `pip-vm-wehobby-iaas-dev-01` | Alias records follow the IP and prevent dangling DNS. The apex points at this VM until scenario 03 |
| DNS hosted at | Azure DNS zone `wehobby.app` in `rg-wehobby-shared`, delegated from Porkbun | Records managed in Azure, Bicep and Terraform |

**Notes / issues:**

## 9. VM configuration

| Setting | Value | Why |
|---|---|---|
| Docker | Docker Engine + Compose plugin from Docker's official apt repo | Newer than Ubuntu's package, includes `docker compose` v2 |
| Docker log driver | `local` (`/etc/docker/daemon.json`) | Rotates logs, protects the OS disk |
| `azureuser` in `docker` group | Yes | Run docker without sudo (root equivalent, single admin VM) |

## 10. Backups

| Setting | Value | Why |
|---|---|---|
| Backups | Not implemented | Dev environment, no real data, cost reduction |
| Accepted risk | Losing the data disk means losing the database | Data is disposable in dev |
| Production plan | Nightly `pg_dump` to Blob via managed identity, 30 day lifecycle rule, data disk snapshots, regular restore tests | |

**Notes / issues:**

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
