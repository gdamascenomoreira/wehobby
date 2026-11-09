param location string
param tags object

param mapsAccountName string = 'map-wehobby-iaas-dev'

resource mapsAccount 'Microsoft.Maps/accounts@2023-06-01' = {
  name: mapsAccountName
  location: location
  tags: tags
  kind: 'Gen2'
  sku: {
    name: 'G2'
  }
  properties: {
    // No subscription keys: the API signs in with the VM managed identity (Entra ID)
    disableLocalAuth: true
  }
}

output mapsAccountName string = mapsAccount.name
output mapsAccountId string = mapsAccount.id
// Sent by the API as the x-ms-client-id header. Not a secret.
output mapsClientId string = mapsAccount.properties.uniqueId
