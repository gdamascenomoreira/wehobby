import type { Config } from '../config.js';
import { createAzureMapsGeocoder, type TokenSource } from './azure-maps.js';
import { createFakeGeocoder } from './fake.js';
import type { Geocoder } from './geocoder.js';

export { GeocoderError, type GeocodedPlace, type Geocoder } from './geocoder.js';

/** Loads @azure/identity on the first token request, so the fake geocoder never needs it. */
function lazyMapsCredential(nodeEnv: string): TokenSource {
  let credential: Promise<TokenSource> | undefined;
  return {
    async getToken(scope) {
      credential ??= import('./credential.js').then((module) =>
        module.createMapsCredential(nodeEnv),
      );
      return (await credential).getToken(scope);
    },
  };
}

export function createGeocoder(config: Config): Geocoder {
  if (config.geocoder.kind === 'fake') {
    return createFakeGeocoder();
  }
  return createAzureMapsGeocoder({
    clientId: config.geocoder.mapsClientId,
    credential: lazyMapsCredential(config.NODE_ENV),
  });
}
