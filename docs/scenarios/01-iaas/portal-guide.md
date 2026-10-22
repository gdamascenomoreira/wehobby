# Scenario 01: IaaS portal guide

Step by step guide for building scenario 01 manually in the Azure portal. Settings and decisions are recorded in the [deployment log](deployment-log.md); this page shows **how** to do it, with screenshots.

> **Retired (22 Oct 2026):** the VM built with this guide is stopped and no longer serves `wehobby.app`. The site now runs on the Bicep VM, see the [Bicep guide](bicep-guide.md). This guide stays as the record of the manual build; IP addresses and record targets below are the ones from that time.

> Before adding screenshots, hide subscription ID, tenant ID, email addresses and public IPs.

**Date built: *2026 October*
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
   - Region: North Europe
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

[VM basics](images/creatingvm.png)


> **Good to know:** some generated names (e.g. OS disk, NIC) may not be editable in the wizard. Write down the names Azure created.

---

## Step 7: Role assignment

1. Open `stwehobbyiaasdev` → **Access control (IAM)** → **Add** → **Add role assignment**
2. Role: **Storage Blob Data Contributor**
3. Members: **Managed identity** → Virtual machine → `vm-wehobby-iaas-dev-01`
4. **Review + assign**

![Role assignment](images/assignrole.png)

---

## Step 8: DNS (Azure DNS zone)

The domain `wehobby.app` was bought at Porkbun. DNS is delegated to an Azure DNS zone so records can be managed in Azure, Bicep and Terraform. The zone lives in a shared resource group because it must outlive the scenario resource groups.

### 8a. Shared resource group

1. Search **Resource groups** → **Create**
   - Resource group: `rg-wehobby-shared`
   - Region: North Europe
2. **Tags**

   | Name | Value |
   |---|---|
   | project | wehobby |
   | environment | dev |
   | managed_by | portal |
   | scenario | shared |

3. **Review + create** → **Create**
4. Open `rg-wehobby-shared` → **Settings** → **Locks** → **Add**
   - Lock name: `lock-wehobby-shared`
   - Lock type: Delete

![Shared resource group and lock](images/sharedrglock.png) 


> **Good to know:** the delete lock protects the zone from accidental deletion when tearing down scenarios.



### 8b. DNS zone

1. Search **DNS zones** → **Create**
   - Resource group: `rg-wehobby-shared`
   - Name: `wehobby.app`
2. **Tags**: same as the shared resource group
3. **Review + create** → **Create**
4. Open the zone → **Overview** → copy the 4 name servers

![DNS zone](images/creatingdnszone.png) 


### 8c. Alias record for the VM

1. In the zone → **Recordsets** → **Add**

   | Field | Value |
   |---|---|
   | Name | `iaas` |
   | Type | A |
   | Alias record set | Yes |
   | Alias type | Azure resource |
   | Azure resource | `pip-vm-wehobby-iaas-dev-01` |
   | TTL | 1 hour |

2. **Add**

![Alias record](images/addingrecordset.png)

> **Good to know:** an alias record points to the public IP resource, not a typed IP. It updates if the IP changes and stops resolving when the IP is deleted, which prevents dangling DNS and subdomain takeover.



### 8d. Check Porkbun before switching

1. In Porkbun → **Domain Management** → `wehobby.app` → **Details** → **DNS & Nameservers**
2. Checked:

   | Item | Value | Result |
   |---|---|---|
   | Nameservers | `curitiba`, `fortaleza`, `maceio`, `salvador` `.ns.porkbun.com` | To be replaced in 8e |
   | DNS records | 2 records (Porkbun parking: ALIAS and wildcard CNAME to `pixie.porkbun.com`) | Not needed, not migrated |
   | Registry DNSSEC | 0 records | OK |
   | Porkbun DNSSEC | Off | OK |
   | URL forwarding | Not set | OK |
   | Glue records | None | OK |

![Initial configuration in Porkbun](images/initialconfporkbun.png)

![Initial DNS Set configuration in Porkbun](images/initialdnsset.png)


> **Good to know:** URL forwarding and email forwarding at the registrar depend on the registrar's DNS. Changing nameservers silently breaks them, so check before switching.

> **My notes:**
> These pixie.porkbun.com records can be ignore. I did not move them to Azure.

### 8e. Switch nameservers in Porkbun

1. Azure portal → **DNS zones** → `wehobby.app` → **Overview** → copy Name server 1 to 4
2. Porkbun → **Domain Management** → `wehobby.app` → **Details** → pencil icon next to **Nameservers**
3. Delete the Porkbun nameservers (`curitiba`, `fortaleza`, `maceio`, `salvador` `.ns.porkbun.com`)
4. Enter the 4 Azure nameservers, one per line, without the trailing dot:

   | # | Nameserver |
   |---|---|
   | 1 | `ns1-XX.azure-dns.com` |
   | 2 | `ns2-XX.azure-dns.net` |
   | 3 | `ns3-XX.azure-dns.org` |
   | 4 | `ns4-XX.azure-dns.info` |

5. **Submit**

![Azure DNS zone nameservers added into Porkbun DNS](images/confignameservers.png)

> **Good to know:** Azure assigns a unique set of nameservers per zone, spread across 4 top level domains (.com, .net, .org, .info) for resilience. If you delete and recreate the zone, you may get different nameservers and must update the registrar again. Another reason for the delete lock.


### 8f. Verify

2. Check the public delegation:

```powershell
nslookup iaas.wehobby.app ns1-08.azure-dns.com```
nslookup -type=NS wehobby.app
```

   Expected: the 4 Azure nameservers, and the VM public IP as a non-authoritative answer.

3. Result:

   | Check | Result |
   |---|---|
   | `iaas.wehobby.app` via public resolver | `20.107.217.244` (matches `pip-vm-wehobby-iaas-dev-01`) |
   | NS records for `wehobby.app` | |
   | Propagation time | 3 Minutes |

Expected: the Azure nameservers, and the VM public IP.

![nslookup results](images/nslookupdnstest.png)

> **Good to know:** "Server: UnKnown" in nslookup only means the DNS server's IP has no reverse DNS (PTR) record. It doesn't affect the answer

> **My notes:**
> -type=NS tells nslookup which kind of DNS record to ask for. A DNS zone holds different record types for the same name, and without the option, nslookup asks for the IP address (A or AAAA records) by default.
> NS stands for Name Server. An NS record answers the question "which servers are in charge of this domain?" So nslookup -type=NS wehobby.app means: "who is authoritative for wehobby.app?" That's how you confirmed the delegation moved from Porkbun to Azure.

---

## Step 9: VM configuration

### 9a. Connect with Azure Bastion Developer

SSH from the corporate device was blocked by the company network ("Software caused connection abort"). Bastion Developer connects through the Azure portal over HTTPS, so it works from any network and SSH no longer depends on a source IP.

#### Deploy and connect

1. Open `vm-wehobby-iaas-dev-01` → **Connect** → **Bastion**
2. Deploy **Bastion Developer** (created as `vnet-wehobby-iaas-dev-bastion`)
3. Authentication type: **Private Key from Local File**
4. Username: `azureuser`
5. Local file: the `.pem` private key downloaded when the VM was created
6. **Connect**. A terminal opens in a new browser tab
7. Test:

```bash
   whoami
   hostname
```

   Result: `azureuser` and `vm-wehobby-iaas-dev-01` ✅

<!-- ![Bastion connect](images/09-bastion-connect.png) -->
<!-- ![Bastion session](images/09-bastion-session.png) -->

#### Clean up the NSG

1. Open `nsg-wehobby-iaas-dev` → **Inbound security rules**
2. Delete `Allow-SSH-MyIP`

> **Good to know:** no NSG rule was needed for Bastion Developer. It connects from the Azure platform IP `168.63.129.16`, which is already allowed by the default rule `AllowAzureLoadBalancerInBound` (the `AzureLoadBalancer` service tag includes it). A custom "deny all inbound" rule would break Bastion.

> **Good to know:** Bastion Developer is free, needs no `AzureBastionSubnet` and no public IP, but allows only one session at a time, no file transfer and no native client. The portal also warns it's not for production.

> **Naming exception:** the portal named the Bastion `vnet-wehobby-iaas-dev-bastion`. Azure resources can't be renamed, so it stays. In Bicep and Terraform it will be `bas-wehobby-iaas-dev`.


![Bastion session](images/testssh.png) 

## Architecture on the VM

| Layer | Technology | Container | Port | Exposed to internet |
|---|---|---|---|---|
| Reverse proxy and HTTPS | Caddy (Let's Encrypt) | `caddy` | 80, 443 | Yes |
| Frontend | React PWA (static files served by Caddy) | `caddy` | | Through Caddy |
| Backend (API) | Node.js + Fastify | `api` | 3000 | No, through Caddy `/api` |
| Database | PostgreSQL + PostGIS (`postgis/postgis`) | `db` | 5432 | No, VM only |
| Photos | Azure Blob Storage `photos` container | Outside the VM | | Through short lived SAS tokens |

- The browser never talks to the database. All data access goes through the API.
- Database files live on the data disk, separate from the OS disk.
- The API reaches Blob Storage with the VM's managed identity (no keys).

### Why PostgreSQL

- **PostGIS** for the "near me" feed: geographic queries and spatial indexes
- **Relational data**: users, posts, follows, likes, comments
- **Same engine in every scenario**: Docker on the VM here, Azure Database for PostgreSQL Flexible Server in PaaS. The app doesn't change between scenarios
- **Open source**: no licence cost

| Alternative | Why not |
|---|---|
| Azure SQL | Higher cost, less suited to self hosting on a Linux VM |
| Cosmos DB | NoSQL, relational features (follows, likes) are awkward. Used in optional scenario 5 as a contrast |
| MySQL | Weaker spatial support than PostGIS |

### 9b. Mount the data disk

The 32 GiB data disk (LUN 0) is attached to the VM but empty: no partition, no file system, not mounted. It will hold the PostgreSQL data and the Caddy certificates.

#### 1. Find the disk

```bash
lsblk -o NAME,SIZE,TYPE,FSTYPE,MOUNTPOINT
ls -l /dev/disk/azure/scsi1/
```

Expected:
- A disk of about **32G** with **no partitions and no mount point** (usually `sdc`, but the name can vary). Here is sdb.
- In `/dev/disk/azure/scsi1/`, an entry `lun0` pointing to that disk

![lsblk and ls -l output](images/findingdisk.png) 


| Check | Result |
|---|---|
| Data disk device name | sdb |
| Size | |
| `lun0` points to it | ../../../sdb |

> **Good to know:** Linux device names like `/dev/sdc` can change between reboots. Azure Ubuntu images add stable paths by LUN in `/dev/disk/azure/scsi1/`, so the commands below use `lun0`, which always matches the LUN set in the portal.

#### 2. Partition and format

```bash
sudo parted /dev/disk/azure/scsi1/lun0 --script mklabel gpt mkpart datadisk ext4 0% 100%
sudo partprobe
sudo mkfs.ext4 -L datadisk /dev/disk/azure/scsi1/lun0-part1
```

| Command | What it does |
|---|---|
| `parted ... mklabel gpt` | Creates a GPT partition table |
| `mkpart datadisk ext4 0% 100%` | One partition using the whole disk |
| `partprobe` | Tells the kernel about the new partition |
| `mkfs.ext4 -L datadisk` | Formats it as ext4 with the label `datadisk` |


![Prepare a new empty data disk in Linux](images/partitionformat.png)

#### 3. Mount it

```bash
sudo mkdir -p /datadisk
sudo mount /dev/disk/azure/scsi1/lun0-part1 /datadisk
df -h /datadisk
```

Expected: `/datadisk` with about 31G available.

![Mounting the disk](images/mountingdisk.png)

#### 4. Mount automatically at boot

Get the partition's UUID:

```bash
sudo blkid /dev/disk/azure/scsi1/lun0-part1
```

Copy the `UUID="..."` value, then add it to `/etc/fstab`: f5aa21ac-8ae6-49e7-aebc-ada0a77590eb

```bash
echo 'UUID=f5aa21ac-8ae6-49e7-aebc-ada0a77590eb /datadisk ext4 defaults,nofail 0 2' | sudo tee -a /etc/fstab
```

Test the fstab entry without rebooting:

```bash
sudo umount /datadisk
sudo mount -a
df -h /datadisk
```

Expected: `/datadisk` is mounted again. If `mount -a` shows an error, fix `/etc/fstab` before rebooting (`sudo nano /etc/fstab`).

| fstab field | Value | Meaning |
|---|---|---|
| Device | `UUID=...` | Identifies the partition reliably |
| Mount point | `/datadisk` | |
| Type | `ext4` | |
| Options | `defaults,nofail` | `nofail`: the VM still boots if the disk is missing |
| Dump | `0` | No legacy backup |
| Pass | `2` | Check the file system at boot, after the OS disk |


![Editing fstab](images/fstabconfig.png)

> **Good to know:** without `nofail`, a detached or failed data disk stops the VM from booting, and the only way in is the serial console. Microsoft recommends `nofail` for every Azure data disk.
>  After editing `/etc/fstab`, `mount -a` shows "your fstab has been modified, but systemd still uses the old version". It's only a hint: run `sudo systemctl daemon-reload` so systemd reloads its generated mount units.

![After refreshing the cache](images/afterrefresh.png)

#### 5. Create the folders

```bash
sudo mkdir -p /datadisk/postgres /datadisk/caddy
ls -l /datadisk
```

Expected: `caddy`, `postgres` and `lost+found` (created by ext4).

![Creating the folders](images/mkdir.png)

#### 6. Reboot test (optional, recommended)

```bash
sudo reboot
```

Reconnect with Bastion after a minute, then:

```bash
df -h /datadisk
```

Expected: still mounted.

![df after mount](images/checkingafterreboot.png)

#### Result

| Check | Result |
|---|---|
| Device | `/dev/sdb1` (via `/dev/disk/azure/scsi1/lun0-part1`) |
| File system | ext4, label `datadisk` |
| UUID | `f5aa21ac-8ae6-49e7-aebc-ada0a77590eb` |
| fstab entry | `UUID=f5aa21ac-8ae6-49e7-aebc-ada0a77590eb /datadisk ext4 defaults,nofail 0 2` |
| `mount -a` test | ✅ mounted, 32G size, 30G available |
| Folders | `/datadisk/postgres`, `/datadisk/caddy` |
| Survives reboot | |


> **Good to know:** a 32 GiB disk shows 30G available after formatting. ext4 reserves about 5% for the root user plus space for its metadata.

> **My notes:**
> These steps are documented here: [Use the portal to attach a data disk to a Linux VM](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/attach-disk-portal?tabs=scsi)

### 9c. Install Docker

Docker Engine and the Compose plugin are installed from Docker's official apt repository (newer than Ubuntu's `docker.io` package and includes `docker compose` v2).

#### 1. Prerequisites

```bash
sudo apt-get update
```

```bash
sudo apt-get install -y ca-certificates curl
```
![Running the prerequisites](images/prerequisitesdocker.png)

#### 2. Add Docker's signing key

```bash
sudo install -m 0755 -d /etc/apt/keyrings
```

```bash
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
```

```bash
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

![Adding Docker's signing key](images/AddDockerssigningkey.png)

#### 3. Add Docker's repository

```bash
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list
```

Expected output: a line ending in `noble stable` (Ubuntu 24.04's codename).

#### 4. Install Docker

```bash
sudo apt-get update
```

```bash
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

| Package | What it is |
|---|---|
| `docker-ce` | Docker Engine (the daemon) |
| `docker-ce-cli` | The `docker` command |
| `containerd.io` | Container runtime used by Docker |
| `docker-buildx-plugin` | Image builder |
| `docker-compose-plugin` | `docker compose`, runs multi container stacks |

![Installing Docker](images/installingdocker.png)


#### 5. Test

```bash
sudo docker run hello-world
```

Expected: "Hello from Docker!"

![Hello from Docker](images/hellodocker.png)

```bash
docker compose version
```

```bash
systemctl is-enabled docker
```

Expected: a Compose version (v2.x) and `enabled` (Docker starts at boot).

#### 6. Run docker without sudo

```bash
sudo usermod -aG docker azureuser
```

Close the Bastion tab and reconnect (group changes apply at the next login), then:

```bash
docker ps
```

Expected: an empty list, no "permission denied".

> **Good to know:** members of the `docker` group effectively have root access on the VM. Fine for a single admin VM, but in shared environments keep using `sudo`.

#### 7. Limit container log size

By default Docker keeps container logs forever, which can fill the OS disk. The `local` log driver rotates and compresses them automatically.

```bash
echo '{"log-driver":"local"}' | sudo tee /etc/docker/daemon.json
```

```bash
sudo systemctl restart docker
```

```bash
docker info --format '{{.LoggingDriver}}'
```

Expected: `local`

#### Result

| Check | Result |
|---|---|
| Docker version (`docker --version`) | |
| Compose version | |
| `hello-world` | |
| Starts at boot | |
| `docker ps` without sudo | |
| Log driver | `local` |

> **Good to know:** the VM can download packages because it has a public IP. The subnet is a private subnet (no default outbound access), so a VM without a public IP would need a NAT gateway for `apt` and `docker pull` to work.

> **My notes:**
> [Install Docker Engine on Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
> [Linux post-installation steps for Docker Engine](https://docs.docker.com/engine/install/linux-postinstall/)

### 9d. Docker Compose stack

Caddy (HTTPS), PostgreSQL + PostGIS and a placeholder page, to prove the infrastructure works before the app exists. The real frontend and API are added when Slice 1 is ready.

| Container | Image | Ports | Data |
|---|---|---|---|
| `caddy` | `caddy:2` | 80, 443 (public) | `/datadisk/caddy` |
| `db` | `postgis/postgis:17-3.5` | 5432 (internal only) | `/datadisk/postgres` |

#### 1. Project folder

```bash
sudo mkdir -p /opt/wehobby/site
```

```bash
sudo chown -R azureuser:azureuser /opt/wehobby
```

```bash
cd /opt/wehobby
```

#### 2. Database password

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)" > /opt/wehobby/.env
```

```bash
chmod 600 /opt/wehobby/.env
```

> **Good to know:** `.env` holds the database password. It lives only on the VM, is readable only by `azureuser`, and is never committed to GitHub. Docker Compose reads it automatically from the project folder.

#### 3. compose.yaml
Run:
```bash
nano compose.yaml
```
The editor opens. You'll see GNU nano at the top and a shortcut menu at the bottom (^O Write Out, ^X Exit and so on; ^ means Ctrl)
Paste with Ctrl+Shift+V or right-click. The browser may ask for clipboard permission the first time; allow it
```yaml
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./site:/srv:ro
      - /datadisk/caddy/data:/data
      - /datadisk/caddy/config:/config

  db:
    image: postgis/postgis:17-3.5
    restart: unless-stopped
    environment:
      POSTGRES_DB: wehobby
      POSTGRES_USER: wehobby
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - /datadisk/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U wehobby -d wehobby"]
      interval: 10s
      timeout: 5s
      retries: 5
```
Save: Ctrl+O, then Enter to confirm the file name
Exit: Ctrl+X
Check what was saved:
```bash
cat compose.yaml
```

| Setting | Why |
|---|---|
| `restart: unless-stopped` | Containers start again after a reboot or crash |
| `db` has no `ports` | PostgreSQL is reachable only by other containers, never from the internet |
| Images pinned (`17-3.5`) | Predictable upgrades, same version in every rebuild |
| Volumes on `/datadisk` | Database and certificates survive container and OS disk rebuilds |

#### 4. Caddyfile

```bash
nano Caddyfile
```

Paste:

```text
iaas.wehobby.app {
    encode gzip
    respond /health "ok" 200
    root * /srv
    file_server
}
```

| Line | What it does |
|---|---|
| `iaas.wehobby.app {` | Site address. Caddy requests a Let's Encrypt certificate for it automatically |
| `encode gzip` | Compresses responses |
| `respond /health "ok" 200` | Health endpoint for monitoring and load tests |
| `root * /srv` + `file_server` | Serves the static files from `site/` |

#### 5. Placeholder page

```bash
nano site/index.html
```

Paste:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>WeHobby | Scenario 01 IaaS</title>
</head>
<body>
  <h1>WeHobby</h1>
  <p>Scenario 01: IaaS. Served by Caddy on an Azure VM.</p>
</body>
</html>
```

#### 6. Validate and start

```bash
docker compose config --quiet
```

No output means the file is valid. (Without `--quiet` it would print the password.)

```bash
docker compose up -d
```

```bash
docker compose ps
```

Expected: `caddy` running, `db` running and `healthy` (can take 30 seconds).

![Validation steps](images/validatingdocker.png)

```bash
docker compose logs caddy --tail 30
```

Look for `certificate obtained successfully` for `iaas.wehobby.app`.

![Confirming certificate](images/certificationvalidation.png)


#### 7. Test

From your computer, open `https://iaas.wehobby.app` and `https://iaas.wehobby.app/health`.

![Test WeHobbyApp](images/testv1wehobbyiaas.png)

From the VM:

```bash
curl -I https://iaas.wehobby.app
```

Expected: `HTTP/2 200`.

| Check | Result |
|---|---|
| `docker compose ps` | |
| Certificate obtained | |
| `https://iaas.wehobby.app` | |
| `/health` | |

![Curl results](images/curlresult.png)

> **Good to know:** Caddy gets the certificate through the HTTP-01 challenge: Let's Encrypt calls `http://iaas.wehobby.app/.well-known/acme-challenge/...` on port 80. That's why port 80 stays open in the NSG even though `.app` forces HTTPS in browsers.

---

### 9e. Test the database

#### 1. Connect and check versions

```bash
docker compose exec db psql -U wehobby -d wehobby -c "SELECT version();"
```

```bash
docker compose exec db psql -U wehobby -d wehobby -c "SELECT PostGIS_Version();"
```

The `postgis/postgis` image enables the PostGIS extension in the `wehobby` database automatically.

#### 2. Try a geographic query

Distance between Lisbon and Porto, in km:

```bash
docker compose exec db psql -U wehobby -d wehobby -c "SELECT round((ST_Distance(ST_MakePoint(-9.1393, 38.7223)::geography, ST_MakePoint(-8.6291, 41.1579)::geography) / 1000)::numeric, 1) AS km;"
```

Expected: about 274 km. This is the kind of query the "near me" feed will use.

![Test database and geographic query](images/testdatabase.png)

#### 3. Data is on the data disk

```bash
sudo du -sh /datadisk/postgres
```

Expected: a few dozen MB.

#### 4. Port 5432 is not exposed

```bash
sudo ss -tlnp | grep -E ':(80|443|5432) '
```

Expected: ports 80 and 443 listening, **no** 5432.

#### 5. Data survives a container rebuild

```bash
docker compose exec db psql -U wehobby -d wehobby -c "CREATE TABLE smoke_test (id serial PRIMARY KEY, note text); INSERT INTO smoke_test (note) VALUES ('survived');"
```

```bash
docker compose down
```

```bash
docker compose up -d
```

```bash
docker compose exec db psql -U wehobby -d wehobby -c "SELECT * FROM smoke_test;"
```

Expected: the row `survived`. Then clean up:

```bash
docker compose exec db psql -U wehobby -d wehobby -c "DROP TABLE smoke_test;"
```
![Results](images/datasurvives.png)

| Check | Result |
|---|---|
| PostgreSQL version |  PostgreSQL 17.5 (Debian 17.5-1.pgdg110+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 10.2.1-6) 10.2.1 20210110, 64-bit |
| PostGIS version | 3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1 |
| Lisbon to Porto | 273.9 km |
| Size on `/datadisk/postgres` | 108M |
| 5432 not listening on host | yes |
| Data survives `down` and `up` | up |

> **Good to know:** `docker compose down` deletes the containers, not the data. Because the database files are on `/datadisk`, a new container picks them up. This is the stateless vs stateful split in practice.

---

### 9f. Test the managed identity on Blob Storage

The VM has a system assigned managed identity with **Storage Blob Data Contributor** on `stwehobbyiaasdev`. This test uploads, reads and deletes a blob with no keys or secrets, using a token from the Azure Instance Metadata Service (IMDS).

#### 1. Get a token

```bash
TOKEN=$(curl -s -H Metadata:true "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://storage.azure.com/" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
```

```bash
echo ${#TOKEN}
```

Expected: a number above 1000 (the token length). Never print or commit the token itself.

#### 2. Upload

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PUT -H "Authorization: Bearer $TOKEN" -H "x-ms-version: 2023-11-03" -H "x-ms-blob-type: BlockBlob" -H "Content-Type: text/plain" --data "hello from the VM" "https://stwehobbyiaasdev.blob.core.windows.net/photos/test/hello.txt"
```

Expected: `201`

#### 3. Read

```bash
curl -s -H "Authorization: Bearer $TOKEN" -H "x-ms-version: 2023-11-03" "https://stwehobbyiaasdev.blob.core.windows.net/photos/test/hello.txt"
```

Expected: `hello from the VM`

![Test blob access](images/testblob.png)

#### 4. Delete

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE -H "Authorization: Bearer $TOKEN" -H "x-ms-version: 2023-11-03" "https://stwehobbyiaasdev.blob.core.windows.net/photos/test/hello.txt"
```

Expected: `202`

#### Troubleshooting

| Response | Meaning | Fix |
|---|---|---|
| `403` `AuthorizationPermissionMismatch` | Identity has no data role | Check the role assignment (step 7). New assignments can take a few minutes |
| `403` `AuthorizationFailure` | Blocked by the storage firewall | Check the storage networking allows `snet-app` and the subnet has the `Microsoft.Storage` service endpoint |
| Empty token | Managed identity not enabled | VM → **Security** → **Identity** → System assigned: On |

| Check | Result |
|---|---|
| Token obtained | yes |
| Upload | 201 |
| Read | `hello from the VM` |
| Delete | 202 |

> **Good to know:** `169.254.169.254` is the Instance Metadata Service, reachable only from inside the VM. It hands out tokens for the VM's managed identity, so the app never stores a storage key.

> **My notes:**
> [Configure managed identities on Azure virtual machines (VMs)](https://learn.microsoft.com/en-us/entra/identity/managed-identities-azure-resources/how-to-configure-managed-identities?pivots=qs-configure-portal-windows-vm)

----

## Step 10: Backups (not implemented)

**Decision:** no backups for this environment.

| Reason | Detail |
|---|---|
| Cost | Snapshots and backup storage add a monthly cost for no benefit in dev |
| Dev environment | No real user data. The database can be recreated from scratch |

**What production would need:**

| Layer | Approach |
|---|---|
| Database | Nightly `pg_dump -Fc` to a private Blob container (Cool tier), uploaded with the VM's managed identity, scheduled with cron |
| Retention | Blob lifecycle rule deleting backups after 30 days |
| Disk | Incremental snapshots of the data disk, or Azure Backup for the whole VM |
| Restore test | Regular restore into a separate database to prove backups work |

Result: ⏭️ Not implemented by design

> **Good to know:** on a VM, backups are entirely your responsibility. In Scenario 02, Azure Database for PostgreSQL Flexible Server includes automated backups (7 days retention by default), with backup storage up to the provisioned storage size at no extra cost.

> **My notes:**
>[Overview of Azure Blob backup](https://learn.microsoft.com/en-us/azure/backup/blob-backup-overview?tabs=operational-backup)
>[An overview of Azure VM backup](https://learn.microsoft.com/en-us/azure/backup/blob-backup-overview?tabs=operational-backup)
---

## Step 11: Build the initial WeHobby application (Milestone 1)

Steps 1 to 10 created and validated the infrastructure required to host WeHobby.

At this point the Azure VM, networking, DNS, storage, managed identity, Docker, Caddy and PostgreSQL/PostGIS were working, but the VM was still serving the placeholder page created in step 9d.

Step 11 starts the application-development phase.

The goal of Milestone 1 is deliberately small:

> Build the first deployable version of WeHobby and prove that the frontend and API can run on the Scenario 01 VM at `https://wehobby.app`.

No real product features are implemented in this milestone.

The objective is to validate the complete path:

```text
Source code
    |
    v
Build and test
    |
    v
Docker images
    |
    v
GitHub Container Registry
    |
    v
Azure VM
    |
    v
Caddy
    |
    +----> React web app
    |
    +----> /api/* ----> Fastify API
```

The application was developed with Claude Code as an AI pair-programming tool.

---

### 11a. Start application development with Claude Code

From the root of the `wehobby` repository, Claude Code was asked to first understand the project and propose an implementation plan before changing any code.

Initial prompt:

```text
Read CLAUDE.md and explore the current state of this repo.

I have already deployed the Azure VM and the IaaS infrastructure for scenario 1. Now I want to start building the app itself and deploy it to that VM.

First, do not write code yet. Give me:
1. A short summary of what already exists in the repo
2. A recommended tech stack for the MVP (frontend, backend, database, auth, image storage) that fits a single low cost Linux VM, is easy for one person to maintain, and could later move to PaaS (App Service, Container Apps) for the other infra scenarios. Give me pros and cons and your recommendation
3. A step by step plan to build the MVP in small milestones, where milestone 1 is a "hello world" version of the app running on the VM and reachable at wehobby.app over HTTPS
4. A list of anything you need from me (VM details, credentials, decisions)

Wait for my approval before starting milestone 1.
```

The intention was to use Claude Code as an engineering assistant rather than immediately generate code.

The process was:

```text
Understand repository
        |
        v
Understand existing infrastructure
        |
        v
Review application architecture
        |
        v
Identify inconsistencies
        |
        v
Recommend implementation
        |
        v
Review and approve
        |
        v
Implement Milestone 1
```

---

### 11b. Review the existing repository

Claude Code inspected:

- `CLAUDE.md`
- `README.md`
- the product requirements
- Scenario 01 documentation
- the deployment log
- the portal guide
- application source code
- infrastructure code
- GitHub Actions workflows
- existing branches and Git history

The repository already contained the initial application structure:

```text
wehobby/
├── web/
│   └── React + TypeScript + Vite PWA
│
├── api/
│   └── Node.js + TypeScript + Fastify
│
├── packages/
│   └── shared/
│       └── Shared TypeScript types and validation
│
├── functions/
│   └── Azure Functions code for later scenarios
│
├── infra/
│   └── Terraform for later infrastructure scenarios
│
└── docs/
    └── Product and infrastructure documentation
```

The existing application already contained some useful foundations:

- React frontend
- TypeScript
- PWA support
- Portuguese and English internationalization
- language picker
- API health/status component
- Fastify API
- Zod validation
- shared TypeScript package

Claude Code also compared the repository assumptions with the infrastructure that had actually been deployed.

Some configuration needed to be aligned with Scenario 01, including:

- North Europe as the actual Azure region
- PostgreSQL/PostGIS `17-3.5` as the version running on the VM
- Scenario 01 as the current deployment target
- later PaaS/Terraform infrastructure kept separate from the current VM implementation

---

### 11c. Confirm the application architecture

The decision was to keep the application independent of the infrastructure scenario.

The same application should later be able to move from the Scenario 01 VM to services such as App Service or Azure Container Apps without requiring a rewrite of the application.

The main portability rules are:

- configuration comes from environment variables
- application code does not assume a specific Azure hosting service
- application components are packaged as containers
- the same application images can be used by different infrastructure scenarios
- persistent data is kept outside the replaceable application containers

For Scenario 01, the application architecture is:

```text
                         Internet
                            |
                            | HTTPS
                            v
                     +-------------+
                     |    Caddy    |
                     |             |
                     | React PWA   |
                     +------+------+
                            |
                         /api/*
                            |
                            v
                     +-------------+
                     | Fastify API |
                     | Node.js     |
                     +------+------+
                            |
                            v
                     +-------------+
                     | PostgreSQL  |
                     | + PostGIS   |
                     +------+------+
                            |
                            v
                  /datadisk/postgres
```

Caddy is the only component exposed to the internet.

The API and PostgreSQL remain inside the Docker Compose network.

---

### 11d. Define Milestone 1

Milestone 1 deliberately does not implement the actual social-network features yet.

The purpose is to prove that the complete application delivery architecture works.

Milestone 1 is complete when:

- the React application builds
- the API builds
- both components pass their tests
- Docker images can be created
- the application can run using Docker Compose
- Caddy can serve the web application
- Caddy can forward `/api/*` requests to the API
- the application can eventually be reached at `https://wehobby.app`
- the frontend can successfully call the backend health endpoint

The expected result after deployment is:

```text
https://wehobby.app
        |
        v
   React application
        |
        | /api/health
        v
    Fastify API
        |
        v
{"status":"ok","version":"sha-..."}
```

Database application functionality, authentication and product features remain outside Milestone 1.

---

### 11e. Prepare the frontend

The frontend stack remains:

```text
React
TypeScript
Vite
PWA
react-i18next
```

The first version contains:

- WeHobby name
- a simple mobile-first page
- Portuguese and English support
- language picker
- API status

An important architectural change was how the browser accesses the API.

The frontend uses a relative address:

```text
/api/health
```

instead of needing a separate API hostname.

In production:

```text
Browser
   |
   | https://wehobby.app/api/health
   v
Caddy
   |
   | Docker network
   v
api:3000
```

For local development, the Vite development server proxies `/api` to the local API.

This means the browser sees the frontend and backend as one origin.

---

### 11f. Prepare the API

The backend stack remains:

```text
Node.js
TypeScript
Fastify
Zod
```

API routes were organized underneath:

```text
/api
```

The Milestone 1 health endpoint is:

```text
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "version": "sha-e8d2d8a"
}
```

This endpoint proves that:

- the API container is running
- Caddy can communicate with the API
- routing between the frontend edge and API works
- the deployed application version can be identified

The API container does not expose port `3000` on the VM host.

Only other Docker containers can reach that port.

---

### 11g. Create the web edge image

A production image was created for the frontend:

```text
ghcr.io/gdamascenomoreira/wehobby-web
```

This image contains two things:

```text
wehobby-web
├── built React application
└── Caddy
```

Caddy:

- terminates HTTPS
- serves the React application
- obtains and renews certificates
- proxies `/api/*` to the API container
- keeps `/health` available
- redirects `www.wehobby.app` to `wehobby.app`
- serves `iaas.wehobby.app`
- adds HTTP security headers
- compresses responses
- applies caching rules for static assets

This replaces the manually created placeholder site from step 9d.


Notes:
[Caddy GitHub page](https://github.com/caddyserver/caddy)
[Caddy Documentation](https://caddyserver.com/docs/)
[Caddy Getting Started](https://caddyserver.com/docs/getting-started)
---

### 11h. Create the API image

The API is packaged separately as:

```text
ghcr.io/gdamascenomoreira/wehobby-api
```

The API image contains the built Node.js/Fastify application.

The separation provides:

```text
wehobby-web
    |
    +---- Caddy
    +---- React build

wehobby-api
    |
    +---- Node.js
    +---- Fastify
```

The two components can therefore be upgraded independently while still being versioned from the same Git commit.

---

### 11i. Create the VM Docker Compose definition

A deployment-specific Compose file was added to the repository:

```text
deploy/vm/compose.yaml
```

The VM will run three containers:

| Container | Purpose | Host ports |
|---|---|---|
| `caddy` | HTTPS, React frontend, reverse proxy | 80, 443 |
| `api` | Node.js/Fastify API | None |
| `db` | PostgreSQL + PostGIS | None |

The important design decision is that persistent data remains outside the replaceable containers.

```text
Application containers
    |
    | replaceable
    v

wehobby-web
wehobby-api


Persistent Azure data disk
    |
    +---- /datadisk/postgres
    |
    +---- /datadisk/caddy
```

Therefore updating the application does not delete the PostgreSQL data or the Caddy certificate data.

---

### 11j. Add CI validation

GitHub Actions CI was updated so that changes are checked before deployment.

The CI validates:

```text
Source code
   |
   +---- formatting
   |
   +---- lint
   |
   +---- type checking
   |
   +---- tests
   |
   +---- application build
   |
   +---- API image build
   |
   +---- Web image build
   |
   +---- Docker Compose smoke test
```

The smoke test validates important properties of the production architecture, including:

- `/health`
- `/api/health`
- frontend SPA fallback
- HTTP security headers
- API not directly exposed on the host

This provides a test of the container architecture before the images are deployed to the VM.

---

### 11k. Publish versioned images

A GitHub Actions workflow named `Images` was added.

When Milestone 1 was merged to `main`, the workflow built and pushed:

```text
ghcr.io/gdamascenomoreira/wehobby-web
ghcr.io/gdamascenomoreira/wehobby-api
```

Images are tagged using the Git commit.

For this Milestone 1 deployment:

```text
IMAGE_TAG=sha-e8d2d8a
```

Therefore the application artifacts are:

```text
ghcr.io/gdamascenomoreira/wehobby-web:sha-e8d2d8a
ghcr.io/gdamascenomoreira/wehobby-api:sha-e8d2d8a
```
![API Image Summary from GitHub Actions](images/apiimagesummarygithub.png)

The relationship is:

```text
Git commit
   |
   v
e8d2d8a
   |
   v
GitHub Actions
   |
   +---- wehobby-web:sha-e8d2d8a
   |
   +---- wehobby-api:sha-e8d2d8a
```

> **Good to know:** the image tag is not confidential. It identifies the application version and can be documented in the repository. Secrets such as the PostgreSQL password, access tokens, storage keys or SSH private keys must never be committed.

---

### 11l. Deployment strategy

The application deployment to Scenario 01 remains manual.

GitHub Actions is responsible for:

```text
Build
Test
Create images
Publish images
```

The VM deployment is performed manually through Azure Bastion.

```text
GitHub
   |
   | build and publish
   v
GHCR
   |
   | manual deployment
   v
Azure VM
```

Automated VM deployment was intentionally not added.

The focus after Milestone 1 is application development rather than deployment automation.

When later features require something to change on the VM, such as:

- new environment variables
- database migrations
- additional containers

the required commands are documented and run manually.

---

### Result

| Check | Result |
|---|---|
| Existing repository reviewed | ✅ |
| Scenario 01 architecture confirmed | ✅ |
| Frontend prepared | ✅ |
| API prepared | ✅ |
| `/api/health` implemented | ✅ |
| `wehobby-web` image created | ✅ |
| `wehobby-api` image created | ✅ |
| VM Compose definition created | ✅ |
| CI validation added | ✅ |
| Milestone 1 merged | ✅ |
| Images workflow completed | ✅ |
| Image tag | `sha-e8d2d8a` |
| Application deployed to VM | ⬜ Step 12 |

---

## Step 12: Deploy Milestone 1 to Scenario 01

Step 11 built and packaged the initial application.

Step 12 deploys those artifacts to the Scenario 01 VM and replaces the placeholder site from step 9d.

The target architecture after this step is:

```text
                         Internet
                            |
                   wehobby.app
                   www.wehobby.app
                   iaas.wehobby.app
                            |
                            v
                     VM Public IP
                            |
                            v
                 +--------------------+
                 |       Caddy        |
                 | + React web build  |
                 | ports 80 / 443     |
                 +---------+----------+
                           |
                        /api/*
                           |
                           v
                 +--------------------+
                 |        API         |
                 |     Fastify        |
                 |  port 3000 internal|
                 +---------+----------+
                           |
                           v
                 +--------------------+
                 | PostgreSQL/PostGIS |
                 | 5432 internal      |
                 +---------+----------+
                           |
                           v
                 /datadisk/postgres
```

---

### 12a. DNS for the application

Before starting the new Caddy container, the application DNS names must resolve to the Scenario 01 VM.

Azure DNS contains A alias records for:

```text
iaas.wehobby.app
wehobby.app
www.wehobby.app
```

All records point to:

```text
pip-vm-wehobby-iaas-dev-01
```


![DNS Records updated](images/dnsrecordsupdated.png)

The resulting DNS structure is:

```text
iaas.wehobby.app ───┐
                    |
wehobby.app ─────────┼──> VM public IP
                    |
www.wehobby.app ─────┘
```

Validation from the computer:

```powershell
nslookup wehobby.app
nslookup www.wehobby.app
```

Result:

![Nslookup results](images/nslookupupdated.png)

Both names resolve to the same VM public IP.

| Check | Result |
|---|---|
| `wehobby.app` resolves to VM | ✅ |
| `www.wehobby.app` resolves to VM | ✅ |
| `iaas.wehobby.app` still resolves to VM | ✅ |

> **Good to know:** the `@` A record represents the apex `wehobby.app`. The existing `@` NS and SOA records do not give `wehobby.app` an IP address, so a separate `@` A alias record is required.

---

### 12b. Publish the application images

After the Milestone 1 pull request was merged, GitHub Actions ran the `Images` workflow.

The successful workflow created the deployment tag:

```text
sha-e8d2d8a
```

The corresponding images are:

```text
ghcr.io/gdamascenomoreira/wehobby-web:sha-e8d2d8a
ghcr.io/gdamascenomoreira/wehobby-api:sha-e8d2d8a
```

Both GitHub Container Registry packages were verified under:

```text
GitHub profile
└── Packages
    ├── wehobby-api
    └── wehobby-web
```

Both packages were changed to:

```text
Visibility: Public
```

![Changing package visibility in GitHub](images/changepackagevisibility.png)

This allows the VM to download the images without storing a GitHub token.

| Check | Result |
|---|---|
| `wehobby-api` package exists | ✅ |
| `wehobby-web` package exists | ✅ |
| `wehobby-api` visibility | Public ✅ |
| `wehobby-web` visibility | Public ✅ |
| Image tag | `sha-e8d2d8a` |

> **Good to know:** public container images do not mean the application secrets are public. Secrets such as `POSTGRES_PASSWORD` remain in `/opt/wehobby/.env` on the VM and are not built into the images.

---

### 12c. Switch the VM to the application

Connect to `vm-wehobby-iaas-dev-01` using Azure Bastion Developer.

The objective of this step is to replace:

```text
Step 9
generic caddy:2
+ manually created site/index.html
```

with:

```text
wehobby-web:sha-e8d2d8a
wehobby-api:sha-e8d2d8a
existing PostgreSQL database
```

#### 1. Open the WeHobby directory

```bash
cd /opt/wehobby
```

Check the current files:

```bash
ls -la
```

The existing Step 9 configuration should include files such as:

```text
.env
compose.yaml
Caddyfile
site/
```

Output:

![Opening We Hobby directory](images/openwehobbydirectory.png)

---

#### 2. Back up the Step 9 configuration

Create a backup before changing the running configuration:

```bash
mkdir -p backup-step9
```

Copy the existing files:

```bash
cp -rp compose.yaml Caddyfile site .env backup-step9/
```

Verify:

```bash
ls -la backup-step9
```

Expected:

```text
compose.yaml
Caddyfile
site/
.env
```
Output:

![Backup done](images/backupstep9.png)

The backup provides a path back to the Step 9 placeholder configuration if necessary.

---

#### 3. Get the full merge commit SHA

The container tag uses the short SHA:

```text
sha-e8d2d8a
```

The deployment Compose file should be downloaded from the corresponding full Git commit so the Compose definition and application images represent the same application version.

In GitHub:

```text
wehobby
└── Commits
    └── Milestone 1 merge commit
```

Copy the full SHA.

On the VM:

```bash
COMMIT=ghcr.io/gdamascenomoreira/wehobby-api:sha-e8d2d8a
```

Do not include `<` or `>` when entering the real value.


#### 4. Download the production Compose file

Run:

```bash
curl -fsSL -o compose.yaml "https://raw.githubusercontent.com/gdamascenomoreira/wehobby/$COMMIT/deploy/vm/compose.yaml"
```

Verify the beginning of the file:

```bash
head -5 compose.yaml
```

Expected:

```text
# WeHobby on the scenario 01 VM.
```

Output:
![Results of the head cmdlet](images/commitcurl.png)

Do not continue if the downloaded file is not the expected Scenario 01 Compose file.

---

#### 5. Add the application image tag

The existing `/opt/wehobby/.env` already contains:

```text
POSTGRES_PASSWORD=...
```

Keep this value.

Do not recreate the `.env` file.

Add the application version:

```bash
echo "IMAGE_TAG=sha-e8d2d8a" >> .env
```

Safely verify the required entries without displaying the database password:

```bash
grep -c '^POSTGRES_PASSWORD=' .env
```

Expected:

```text
1
```

Then:

```bash
grep '^IMAGE_TAG=' .env
```

Expected:

```text
IMAGE_TAG=sha-e8d2d8a
```

Output:

![Checking the password and image tag](images/step5output.png)

Do not run:

```bash
cat .env
```

because it would display the PostgreSQL password.

---

#### 6. Validate Docker Compose

Before changing the running containers:

```bash
docker compose config --quiet
```

Expected:

```text
no output
```

No output means Docker Compose successfully parsed the configuration.

If an error appears, fix the configuration before continuing.

---

#### 7. Download the application images

Run:

```bash
docker compose pull
```

This downloads the application containers required by the new Compose configuration.

Conceptually:

```text
GitHub Container Registry
          |
          | docker compose pull
          v
Azure VM
          |
          +---- wehobby-web:sha-e8d2d8a
          |
          +---- wehobby-api:sha-e8d2d8a
```

---

#### 8. Start the new application

Run:

```bash
docker compose up -d
```

Docker Compose compares the desired configuration with the currently running containers and updates the stack.

Check:

```bash
docker compose ps
```

The expected services are:

```text
caddy
api
db
```

Output:

![Results for downloading and starting the new app](images/downloadandstartnewapp.png)

The database continues using the existing data under:

```text
/datadisk/postgres
```

The deployment therefore replaces the application containers without intentionally deleting the database files.

---

#### 9. Check Caddy certificates

Run:

```bash
docker compose logs caddy --tail 50 | grep -i -E 'certificate obtained|error'
```

Check the logs for certificate activity or errors for:

```text
wehobby.app
www.wehobby.app
iaas.wehobby.app
```
Output:
```text
azureuser@vm-wehobby-iaas-dev-01:/opt/wehobby$ docker compose logs caddy --tail 50 | grep -i -E 'certificate obtained|error'
caddy-1  | {"level":"info","ts":1791803288.999106,"logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"www.wehobby.app","issuer":"acme-v02.api.letsencrypt.org-direct
ory"}
caddy-1  | {"level":"info","ts":1791803289.0125635,"logger":"tls.obtain","msg":"certificate obtained successfully","identifier":"wehobby.app","issuer":"acme-v02.api.letsencrypt.org-directory
"}
```

DNS was configured before this deployment so the public names already point to the VM when Caddy requests the new certificates.

---

### 12d. Validate the deployment

After the containers are running, validate each layer instead of checking only the homepage.

#### Test the main website

From Windows PowerShell:

```powershell
curl.exe -sI https://wehobby.app
```

Output result:

```text
PS C:\Users\gdamasceno> curl.exe -sI https://wehobby.app
HTTP/1.1 200 OK
Accept-Ranges: bytes
Alt-Svc: h3=":443"; ma=2592000
Cache-Control: no-cache
Content-Length: 799
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
Content-Type: text/html; charset=utf-8
Cross-Origin-Opener-Policy: same-origin
Etag: "dm196et5v474m7"
Last-Modified: Sat, 10 Oct 2026 15:11:28 GMT
Permissions-Policy: camera=(self), geolocation=(self), microphone=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
Vary: Accept-Encoding
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Date: Mon, 12 Oct 2026 11:10:31 GMT
```


---

#### Test the www redirect

```powershell
curl.exe -sI https://www.wehobby.app
```

Expected:

```text
PS C:\Users\gdamasceno> curl.exe -sI https://www.wehobby.app
HTTP/1.1 301 Moved Permanently
Alt-Svc: h3=":443"; ma=2592000
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'
Cross-Origin-Opener-Policy: same-origin
Location: https://wehobby.app/
Permissions-Policy: camera=(self), geolocation=(self), microphone=(), payment=(), usb=()
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Date: Mon, 12 Oct 2026 11:11:28 GMT
```

The canonical site address is therefore:

```text
https://wehobby.app
```

Result:

![Opening WeHobby.App](images/wehobbypage1.png)

Expected:

- WeHobby page loads
- API status shows `ok`
- English and Portuguese language selection works
- HTTPS certificate is valid

---

#### Test the API

```powershell
curl.exe -s https://wehobby.app/api/health
```

Output:

```json
{"status":"ok","version":"sha-e8d2d8a"}
```

This proves:

```text
Computer
   |
   v
HTTPS
   |
   v
Caddy
   |
   v
/api/health
   |
   v
API container
```

---

#### Test the infrastructure health endpoint

```powershell
curl.exe -s https://iaas.wehobby.app/health
```

Output:

```text
ok
```

---

#### Verify that internal services are not exposed

From the VM:

```bash
sudo ss -tlnp | grep -E ':(80|443|3000|5432) '
```

Result:

```text
azureuser@vm-wehobby-iaas-dev-01:/opt/wehobby$ sudo ss -tlnp | grep -E ':(80|443|3000|5432) '
LISTEN 0      4096         0.0.0.0:80        0.0.0.0:*    users:(("docker-proxy",pid=36906,fd=8))                 
LISTEN 0      4096         0.0.0.0:443       0.0.0.0:*    users:(("docker-proxy",pid=36926,fd=8))                 
LISTEN 0      4096            [::]:80           [::]:*    users:(("docker-proxy",pid=36911,fd=8))                 
LISTEN 0      4096            [::]:443          [::]:*    users:(("docker-proxy",pid=36932,fd=8))          
```

Ports `3000` and `5432` should not be published on the VM host.

The network path should remain:

```text
Internet
   |
   | 80 / 443
   v
Caddy
   |
   | Docker network
   +----------> API :3000
                   |
                   | Docker network
                   v
              PostgreSQL :5432
```

---

#### Verify PostgreSQL/PostGIS

Run:

```bash
docker compose exec db psql -U wehobby -d wehobby -c "SELECT PostGIS_Version();"
```

Output:

```text
            postgis_version            
---------------------------------------
 3.5 USE_GEOS=1 USE_PROJ=1 USE_STATS=1
(1 row)
```

This confirms the existing database is still available after changing the application stack.

---

#### Clean up the old placeholder files

Only after all validation succeeds, remove the old Step 9 files that are no longer required by the new image:

```bash
rm -r site Caddyfile
```

The backup remains under:

```text
backup-step9/
```

---

### 12e. Rollback

Application versions are controlled using:

```text
IMAGE_TAG
```

For example:

```text
IMAGE_TAG=sha-e8d2d8a
```

A future deployment can use another tag:

```text
IMAGE_TAG=sha-xxxxxxx
```

To roll back to a previous application version, change the tag:

```bash
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-<previous-tag>/' .env
```

Then:

```bash
docker compose up -d
```

Docker Compose will restore the application images associated with that version.

The database remains on `/datadisk`, independently of the application container version.


> **Good to know:** with VM auto shutdown enabled, the public website is unavailable while the VM is stopped. When the VM starts again, Docker starts and containers configured with `restart: unless-stopped` start automatically.

---

## Updated Scenario 01 sequence

The Scenario 01 build sequence is now:

```text
Step 1
Resource group
      |
      v
Step 2
Budget
      |
      v
Step 3
Virtual network
      |
      v
Step 4
Network security group
      |
      v
Step 5
Storage account
      |
      v
Step 6
Virtual machine
      |
      v
Step 7
Managed identity role assignment
      |
      v
Step 8
DNS
      |
      v
Step 9
Prepare the VM
  - Bastion
  - data disk
  - Docker
  - Caddy placeholder
  - PostgreSQL/PostGIS
  - managed identity test
      |
      v
Step 10
Backup decision
  - intentionally not implemented in dev
      |
      v
Step 11
Build Milestone 1
  - Claude Code planning
  - React frontend
  - Fastify API
  - Caddy edge image
  - Docker images
  - Docker Compose
  - CI
  - GitHub Container Registry
      |
      v
Step 12
Deploy Milestone 1
  - DNS
  - publish packages
  - deploy to VM
  - HTTPS
  - validation
  - rollback
      |
      v
Next application slices
  - authentication
  - profile
  - hobbies
  - location
  - photos
  - feeds
  - interactions
  - safety
```

The important separation is:

```text
Steps 1-10 = build and validate the infrastructure

Step 11 = build the application artifact

Step 12 = deploy that artifact to Scenario 01

Next steps = build the actual WeHobby product features
```

This keeps the infrastructure learning journey separate from application development while still showing how the two come together in Scenario 01.

