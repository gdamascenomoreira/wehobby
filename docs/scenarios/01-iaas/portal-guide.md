# Scenario 01: IaaS portal guide

Step by step guide for building scenario 01 manually in the Azure portal. Settings and decisions are recorded in the [deployment log](deployment-log.md); this page shows **how** to do it, with screenshots.

> Before adding screenshots, hide subscription ID, tenant ID, email addresses and public IPs.

**Date built:*2026 October*
---

## Step 1: Resource group

1. Search **Resource groups** → **Create**
2. **Basics**
   - Subscription: _your subscription_
   - Resource group: `rg-wehobby-iaas-dev`
   - Region: North Europe
3. **Tags**

   | Name | Value |
   |---|---|
   | project | wehobby |
   | environment | dev |
   | managed_by | portal |
   | scenario | 01-iaas |

4. **Review + create** → **Create**

![Resource group basics](images/creatingRG.png)

---

## Step 2: Budget alert

1. Open `rg-wehobby-iaas-dev` → **Cost Management** → **Budgets** → **Add**
2. **Create a budget**
   - Name: `budget-wehobby-iaas-dev`
   - Reset period: Billing Month
   - Amount: _€_
3. **Set alerts**
   - Actual: 50%, 80%
   - Forecasted: 100%
   - Recipients: _your email 
4. **Create**

![Creating Budget alert](images/creatingbudget.png)

> **Good to know:** a budget only alerts, it never stops spending. Cost data can lag by several hours.

> **My notes:**
>As I am using a  Visual Studio subscription, it is important to use Billing Month instead of Monthly as the invoice period may be different.

Documentation related:
[Use cost alerts to monitor usage and spending](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/cost-mgt-alerts-monitor-usage-spending)
[Tutorial: Create and manage budgets](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets?tabs=psbudget)

---

## Step 3: Virtual network

1. Search **Virtual networks** → **Create**
2. **Basics**
   - Resource group: `rg-wehobby-iaas-dev`
   - Name: `vnet-wehobby-iaas-dev`
   - Region: North Europe
3. **Security**: leave Bastion, Firewall and DDoS Protection off (cost)
4. **IP addresses**
   - Address space: `10.10.0.0/16`
   - Edit the default subnet:
     - Name: `snet-app`
     - Range: `10.10.1.0/24`
     - Service endpoints: `Microsoft.Storage.Global`
5. **Tags**: same four tags as step 1
6. **Review + create** → **Create**

![VNet basics](images/creatingvnet.png)
![Subnet with service endpoint](images/addingserviceendpoint.png)


---

## Step 4: Network security group

1. Search **Network security groups** → **Create**
   - Resource group: `rg-wehobby-iaas-dev`
   - Name: `nsg-wehobby-iaas-dev`
   - Region: North Europe
   - Tags: same four tags

![Creating NSG](images/creatingnsg.png)

2. Open the NSG → **Inbound security rules** → **Add**

   | Name | Source | Destination ports | Protocol | Action | Priority |
   |---|---|---|---|---|---|
   | Allow-HTTP-HTTPS | Service Tag: Internet | 80, 443 | TCP | Allow | 100 |
   | Allow-SSH-MyIP | IP addresses: _my public IP_ | 22 | TCP | Allow | 110 |


   ![Creating Inbound rule Allow HTTP](images/nsgallowhttp.png)

   ![Creating Inbound rule Allow SSH](images/nsgallowssh.png)

3. **Subnets** → **Associate** → `vnet-wehobby-iaas-dev` / `snet-app`

![Associating subnet](images/associatesubnet.png)

---

## Step 5: Storage account

1. Search **Storage accounts** → **Create**
2. **Basics**
   - Resource group: `rg-wehobby-iaas-dev`
   - Name: `stwehobbyiaasdev`
   - Region: North Europe
   - Performance: Standard
   - Redundancy: LRS
3. **Advanced**
   - Allow enabling anonymous access on containers: off
   - Enable storage account key access: on
   - Minimum TLS version: 1.2
   - Access tier: Hot
4. **Networking**
   - Public network access: enabled from selected virtual networks and IP addresses
   - Virtual network: `vnet-wehobby-iaas-dev` / `snet-app`
   - Add your client IP address
5. **Tags**: same four tags
6. **Review + create** → **Create**

![Storage Account basics](images/creatingsa.png)

7. Open the account → **Containers** → **+ Container** → name `photos`, private access

![Creating container](images/creatingcontainer.png)

> **Good to know:** if key access is disabled, you need a data role (e.g. Storage Blob Data Contributor) on your own account to browse blobs in the portal.

> **My notes:**
>  I did not enable hierarchical namespace. It's designed for analytics workloads: real directories with atomic rename and delete, and POSIX style ACLs per file and folder, used by Spark, Databricks, Synapse and so on. WeHobby just stores photos and reads and writes them through the Blob API.

---

## Step 6: Virtual machine

1. Search **Virtual machines** → **Create** → **Azure virtual machine**
2. **Basics**
   - Resource group: `rg-wehobby-iaas-dev`
   - Name: `vm-wehobby-iaas-dev-01`
   - Region: West Europe
   - Availability options: no infrastructure redundancy required
   - Image: Ubuntu Server 24.04 LTS
   - Size: B2als v2
   - Authentication: SSH public key, username `azureuser`, generate new key pair
   - Public inbound ports: None (the subnet NSG controls access)
3. **Disks**
   - OS disk type: Standard SSD
   - **Create and attach a new disk**: name `disk-vm-wehobby-iaas-dev-01-data`, Standard SSD, 32 GiB
4. **Networking**
   - Virtual network: `vnet-wehobby-iaas-dev`, subnet `snet-app`
   - Public IP: create new, name `pip-vm-wehobby-iaas-dev-01`, Standard SKU, static
   - NIC network security group: None
5. **Management**
   - System assigned managed identity: on
   - Auto shutdown: on, time _:_, time zone _ _
6. **Monitoring**
   - Boot diagnostics: enable with managed storage account
7. **Tags**: same four tags
8. **Review + create** → **Create** → download the private key and keep it safe (never commit it)
9. Open the public IP → **Configuration** → set a DNS name label

<!-- ![VM basics](images/06-vm-basics.png) -->
<!-- ![VM disks](images/06-vm-disks.png) -->
<!-- ![VM networking](images/06-vm-networking.png) -->
<!-- ![VM management](images/06-vm-management.png) -->

> **Good to know:** some generated names (e.g. OS disk, NIC) may not be editable in the wizard. Write down the names Azure created.

> **My notes:**
>

---

## Step 7: Role assignment

1. Open `stwehobbyiaasdev` → **Access control (IAM)** → **Add** → **Add role assignment**
2. Role: **Storage Blob Data Contributor**
3. Members: **Managed identity** → Virtual machine → `vm-wehobby-iaas-dev-01`
4. **Review + assign**

<!-- ![Role assignment](images/07-role-assignment.png) -->

> **My notes:**
>

---

## Step 8: DNS record

1. In the DNS provider for `wehobby.app`, add:

   | Type | Name | Value | TTL |
   |---|---|---|---|
   | A | iaas | _VM public IP_ | 3600 |

2. Test: `nslookup iaas.wehobby.app`

<!-- ![DNS record](images/08-dns-record.png) -->

> **My notes:**
>

---

## Step 9: VM configuration

_Coming next: mount the data disk, install Docker, run the Compose stack (app, PostGIS, Caddy)._

## Step 10: Backups

_Coming next: disk snapshots, `pg_dump` to Blob Cool tier, restore test._

---

## Surprises and lessons learned

-
