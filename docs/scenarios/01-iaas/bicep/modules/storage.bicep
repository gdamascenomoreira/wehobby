param location string
param tags object

@minLength(3)
@maxLength(24)
param storageAccountName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2025-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    defaultToOAuthAuthentication: false
    isHnsEnabled: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
    // Public network access: enabled from all networks
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2025-01-01' = {
  name: 'default'
  parent: storageAccount
  properties: {
    // Lets the web app upload photos straight to Blob Storage with a SAS URL (slice 5)
    cors: {
      corsRules: [
        {
          allowedOrigins: [
            'https://wehobby.app'
          ]
          allowedMethods: [
            'PUT'
            'OPTIONS'
          ]
          allowedHeaders: [
            'x-ms-blob-type'
            'content-type'
            'x-ms-*'
          ]
          exposedHeaders: [
            'x-ms-*'
          ]
          maxAgeInSeconds: 3600
        }
      ]
    }
  }
}

resource photosContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2025-01-01' = {
  name: 'photos'
  parent: blobService
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output blobEndpoint string = storageAccount.properties.primaryEndpoints.blob
output photosContainerName string = photosContainer.name
