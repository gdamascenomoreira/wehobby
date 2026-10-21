targetScope = 'subscription'

// ---------- Parameters ----------

param location string = 'northeurope'
param resourceGroupName string = 'rg-wehobby-iaas-dev-bicep'

@minLength(3)
@maxLength(24)
param storageAccountName string

param adminUsername string = 'azureuser'

@description('SSH public key (the content of the .pub file, starting with ssh-rsa or ssh-ed25519).')
param adminPublicKey string

param vmSize string = 'Standard_B2als_v2'

@description('Auto shutdown time, HHmm, 24h format.')
param autoShutdownTime string = '1900'
param autoShutdownTimeZone string = 'GMT Standard Time'

param sharedResourceGroupName string = 'rg-wehobby-shared'
param dnsZoneName string = 'wehobby.app'
param dnsRecordName string = 'iaas-bicep'

param budgetAmount int
@description('First day of a month, yyyy-MM-dd. Cannot be changed after the budget is created.')
param budgetStartDate string
param budgetContactEmail string

// ---------- Variables ----------

var tags = {
  project: 'wehobby'
  environment: 'dev'
  managed_by: 'bicep'
  scenario: '01-iaas'
}

// ---------- Resource group ----------

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// ---------- Modules ----------

module network './modules/network.bicep' = {
  name: 'networkDeployment'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
  }
}

module storage './modules/storage.bicep' = {
  name: 'storageDeployment'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
    storageAccountName: storageAccountName
  }
}

module compute './modules/compute.bicep' = {
  name: 'computeDeployment'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
    subnetId: network.outputs.subnetId
    adminUsername: adminUsername
    adminPublicKey: adminPublicKey
    vmSize: vmSize
    customData: loadFileAsBase64('cloud-init.yaml')
    autoShutdownTime: autoShutdownTime
    autoShutdownTimeZone: autoShutdownTimeZone
  }
}

module roles './modules/roles.bicep' = {
  name: 'rolesDeployment'
  scope: resourceGroup
  params: {
    storageAccountName: storage.outputs.storageAccountName
    principalId: compute.outputs.principalId
  }
}

module bastion './modules/bastion.bicep' = {
  name: 'bastionDeployment'
  scope: resourceGroup
  params: {
    location: location
    tags: tags
    virtualNetworkId: network.outputs.virtualNetworkId
  }
}

module dns './modules/dns.bicep' = {
  name: 'dnsDeployment'
  scope: az.resourceGroup(sharedResourceGroupName)
  params: {
    zoneName: dnsZoneName
    recordName: dnsRecordName
    publicIpId: compute.outputs.publicIpId
  }
}

module budget './modules/budget.bicep' = {
  name: 'budgetDeployment'
  scope: resourceGroup
  params: {
    budgetName: 'budget-wehobby-iaas-dev-bicep'
    amount: budgetAmount
    startDate: budgetStartDate
    contactEmails: [
      budgetContactEmail
    ]
  }
}

// ---------- Outputs ----------

output resourceGroupName string = resourceGroup.name
output vmName string = compute.outputs.vmName
output publicIpAddress string = compute.outputs.publicIpAddress
output azureFqdn string = compute.outputs.fqdn
output customDomain string = dns.outputs.fqdn
output storageAccountName string = storage.outputs.storageAccountName
