import { DefaultAzureCredential, ManagedIdentityCredential } from '@azure/identity';
import type { TokenSource } from './azure-maps.js';

/**
 * The VM's system assigned managed identity in production. Locally,
 * DefaultAzureCredential also accepts an `az login` session, for trying the
 * real Maps account with GEOCODER=azure.
 */
export function createMapsCredential(nodeEnv: string): TokenSource {
  return nodeEnv === 'production' ? new ManagedIdentityCredential() : new DefaultAzureCredential();
}
