import type { Language } from '@wehobby/shared';
import { z } from 'zod';
import { GeocoderError, type GeocodedPlace, type Geocoder } from './geocoder.js';

/** Search v2 geocoding, GA. https://learn.microsoft.com/rest/api/maps/search */
export const AZURE_MAPS_API_VERSION = '2026-01-01';
/** EU geography endpoint: requests and their data stay in Europe. */
export const AZURE_MAPS_ENDPOINT = 'https://eu.atlas.microsoft.com';
export const AZURE_MAPS_SCOPE = 'https://atlas.microsoft.com/.default';
export const AZURE_MAPS_TIMEOUT_MS = 3000;

/** Forward geocoding cannot filter by type, so ask for more and keep localities. */
const SEARCH_TOP = 20;
/** City, town or village, then municipality or county. Never streets. */
const LOCALITY_TYPES = ['PopulatedPlace', 'AdminDivision2'] as const;

const ACCEPT_LANGUAGE: Record<Language, string> = { pt: 'pt-PT', en: 'en-GB' };

/** The subset of `@azure/identity`'s TokenCredential this client needs. */
export interface TokenSource {
  getToken(scope: string): Promise<{ token: string } | null>;
}

export interface AzureMapsGeocoderOptions {
  clientId: string;
  credential: TokenSource;
  fetch?: typeof fetch;
  timeoutMs?: number;
  endpoint?: string;
}

const FeatureSchema = z.object({
  geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]).rest(z.number()) }),
  properties: z.object({
    type: z.string().optional(),
    address: z
      .object({
        locality: z.string().optional(),
        adminDistricts: z
          .array(z.object({ name: z.string().optional(), shortName: z.string().optional() }))
          .optional(),
        countryRegion: z.object({ ISO: z.string().optional() }).optional(),
      })
      .optional(),
  }),
});
type Feature = z.infer<typeof FeatureSchema>;

const ResponseSchema = z.object({ features: z.array(z.unknown()) });

/**
 * "Locality, District", for example "Vila Franca de Xira, Lisboa". The
 * district is left out when it repeats the locality ("Lisboa").
 */
export function placeLabel(feature: Feature): string | undefined {
  const address = feature.properties.address;
  const districts = (address?.adminDistricts ?? [])
    .map((district) => district.name ?? district.shortName)
    .filter((name): name is string => Boolean(name));
  const locality = address?.locality ?? districts.at(-1);
  if (!locality) return undefined;
  const region = districts[0];
  return region && region !== locality ? `${locality}, ${region}` : locality;
}

function toPlace(raw: unknown): GeocodedPlace | undefined {
  const parsed = FeatureSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const feature = parsed.data;
  if (!LOCALITY_TYPES.some((type) => type === feature.properties.type)) return undefined;
  const label = placeLabel(feature);
  const countryCode = feature.properties.address?.countryRegion?.ISO?.toUpperCase();
  if (!label || !countryCode || !/^[A-Z]{2}$/.test(countryCode)) return undefined;
  // GeoJSON order: longitude, latitude.
  const [lng, lat] = feature.geometry.coordinates;
  return { label, countryCode, lat, lng };
}

/**
 * Azure Maps Search v2 with Entra ID: a managed identity token plus the
 * account client id. The account has local auth disabled, so there is no key.
 */
export function createAzureMapsGeocoder(options: AzureMapsGeocoderOptions): Geocoder {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? AZURE_MAPS_TIMEOUT_MS;
  const endpoint = options.endpoint ?? AZURE_MAPS_ENDPOINT;

  async function call(path: string, params: Record<string, string>, language: Language) {
    let token: string;
    try {
      const result = await options.credential.getToken(AZURE_MAPS_SCOPE);
      if (!result) throw new Error('No token');
      token = result.token;
    } catch (error) {
      throw new GeocoderError('credential', 'Could not get an Azure Maps token', { cause: error });
    }

    const url = new URL(path, endpoint);
    url.search = new URLSearchParams({
      'api-version': AZURE_MAPS_API_VERSION,
      ...params,
    }).toString();

    let response: Response;
    try {
      response = await doFetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-ms-client-id': options.clientId,
          'Accept-Language': ACCEPT_LANGUAGE[language],
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GeocoderError('timeout', `Azure Maps did not answer within ${timeoutMs} ms`);
      }
      throw new GeocoderError('network', 'Azure Maps request failed', { cause: error });
    }

    if (!response.ok) {
      const code = response.headers.get('x-ms-error-code') ?? 'unknown';
      throw new GeocoderError('http', `Azure Maps answered ${response.status} (${code})`, {
        status: response.status,
      });
    }

    const body = ResponseSchema.safeParse(await response.json().catch(() => undefined));
    if (!body.success) {
      throw new GeocoderError('parse', 'Unexpected Azure Maps response');
    }
    return body.data.features
      .map(toPlace)
      .filter((place): place is GeocodedPlace => place !== undefined);
  }

  return {
    search(query, language) {
      return call('/geocode', { query, top: String(SEARCH_TOP) }, language);
    },

    async reverse(lat, lng, language) {
      const [place] = await call(
        '/reverseGeocode',
        { coordinates: `${lng},${lat}`, resultTypes: LOCALITY_TYPES.join(',') },
        language,
      );
      return place;
    },
  };
}
