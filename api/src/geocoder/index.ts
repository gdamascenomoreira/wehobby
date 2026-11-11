import type { Config } from '../config.js';
import { createAzureMapsGeocoder } from './azure-maps.js';
import { createManagedIdentityCredential } from './credential.js';
import { createFakeGeocoder } from './fake.js';
import type { Geocoder } from './geocoder.js';

export { GeocoderError, type GeocodedPlace, type Geocoder } from './geocoder.js';

/**
 * Azure Maps with the VM managed identity, or the fixed city list. With
 * GEOCODER=azure outside an Azure VM, every lookup fails with a credential
 * error, so local development uses the fake.
 */
export function createGeocoder(config: Config): Geocoder {
  if (config.geocoder.kind === 'fake') {
    return createFakeGeocoder();
  }
  return createAzureMapsGeocoder({
    clientId: config.geocoder.mapsClientId,
    credential: createManagedIdentityCredential(),
  });
}
