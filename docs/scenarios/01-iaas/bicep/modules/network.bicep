param location string
param tags object

var virtualNetworkName = 'vnet-wehobby-iaas-dev-bicep'
var subnetName = 'snet-app'

resource networkSecurityGroup 'Microsoft.Network/networkSecurityGroups@2025-01-01' = {
  name: 'nsg-wehobby-iaas-dev-bicep'
  location: location
  tags: tags
  properties: {
    // Rules are declared inline. A separate securityRules resource gets
    // removed and re-added every time the NSG itself is redeployed.
    securityRules: [
      {
        name: 'Allow-HTTP-HTTPS'
        properties: {
          description: 'Allow inbound HTTP and HTTPS traffic'
          protocol: 'Tcp'
          sourcePortRange: '*'
          destinationPortRanges: [
            '80'
            '443'
          ]
          sourceAddressPrefix: 'Internet'
          destinationAddressPrefix: '*'
          access: 'Allow'
          priority: 100
          direction: 'Inbound'
        }
      }
    ]
  }
}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2025-01-01' = {
  name: virtualNetworkName
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.10.0.0/16'
      ]
    }
    // Subnets are declared inline. If the VNet is redeployed without them,
    // Azure tries to delete the subnet, which fails once a NIC uses it.
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: '10.10.1.0/24'
          defaultOutboundAccess: false
          networkSecurityGroup: {
            id: networkSecurityGroup.id
          }
          serviceEndpoints: [
            {
              service: 'Microsoft.Storage.Global'
              locations: [
                '*'
              ]
            }
          ]
        }
      }
    ]
  }
}

output virtualNetworkName string = virtualNetwork.name
output virtualNetworkId string = virtualNetwork.id
output subnetName string = subnetName
output subnetId string = resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetworkName, subnetName)
output networkSecurityGroupName string = networkSecurityGroup.name
output networkSecurityGroupId string = networkSecurityGroup.id
