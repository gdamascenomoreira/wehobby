# WeHobby Knowledge Base

Product requirements, infrastructure conventions and deployment notes for WeHobby.

## Product

| Document | What it covers |
|---|---|
| [PRD](PRD.md) | Product requirements for the MVP |
| [Slice prompts](prompts/) | Build instructions per MVP slice |

## Infrastructure comparison

The same app is deployed in several Azure infrastructure scenarios and compared on cost, performance, operational effort, security and resilience. Each scenario is built three times: first manually in the Azure portal, then as a Bicep template, then in Terraform.

### Conventions

Rules that apply to every scenario and every resource.

| Document | What it covers |
|---|---|
| [Naming convention](conventions/naming.md) | How every Azure resource is named |
| [Tagging](conventions/tagging.md) | Mandatory tags and allowed values |
| [Region](conventions/region.md) | Which Azure region is used and why |

### Scenarios

| # | Scenario | Status | Docs |
|---|---|---|---|
| 01 | IaaS (budget version): Linux VM, Docker Compose, PostgreSQL + PostGIS on the VM | In progress | [Deployment log](scenarios/01-iaas/deployment-log.md) |
| 02 | Classic PaaS: App Service, PostgreSQL Flexible Server | Planned | |
| 03 | Serverless containers: Azure Container Apps (the MVP target architecture) | Planned | |
| 04 | Kubernetes: AKS | Planned | |
| 05 | Fully serverless: Static Web Apps, Functions, Cosmos DB (optional) | Planned | |

### Build approach per scenario

1. **Portal:** deploy manually, recording every setting in the deployment log
2. **Bicep:** rebuild the same environment as a Bicep template, using the log as the spec
3. **Terraform:** rebuild it again in Terraform

The deployment log is the single source of truth for what each environment should contain.
