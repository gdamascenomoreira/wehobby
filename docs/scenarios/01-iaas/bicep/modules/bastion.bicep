param location string
param tags object
param virtualNetworkId string

// Developer SKU: free, no AzureBastionSubnet, no public IP
resource bastion 'Microsoft.Network/bastionHosts@2025-01-01' = {
  name: 'bas-wehobby-iaas-dev-bicep'
  location: location
  tags: tags
  sku: {
    name: 'Developer'
  }
  properties: {
    virtualNetwork: {
      id: virtualNetworkId
    }
  }
}