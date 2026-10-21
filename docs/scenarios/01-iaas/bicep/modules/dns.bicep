// Deployed into the shared resource group (rg-wehobby-shared).
// The zone already exists and is protected by a delete lock, so it is referenced, not created.

param zoneName string
param recordName string
param publicIpId string

resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' existing = {
  name: zoneName
}

resource aliasRecord 'Microsoft.Network/dnsZones/A@2018-05-01' = {
  parent: dnsZone
  name: recordName
  properties: {
    TTL: 3600
    targetResource: {
      id: publicIpId
    }
  }
}

output fqdn string = '${recordName}.${zoneName}'