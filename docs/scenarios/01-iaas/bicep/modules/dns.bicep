// Deployed into the shared resource group (rg-wehobby-shared).
// The zone already exists and is protected by a delete lock, so it is referenced, not created.

param zoneName string

@description('Record names in the zone. Use @ for the apex.')
param recordNames array

param publicIpId string

resource dnsZone 'Microsoft.Network/dnsZones@2018-05-01' existing = {
  name: zoneName
}

resource aliasRecords 'Microsoft.Network/dnsZones/A@2018-05-01' = [
  for recordName in recordNames: {
    parent: dnsZone
    name: recordName
    properties: {
      TTL: 3600
      targetResource: {
        id: publicIpId
      }
    }
  }
]

output fqdns array = [for recordName in recordNames: recordName == '@' ? zoneName : '${recordName}.${zoneName}']
