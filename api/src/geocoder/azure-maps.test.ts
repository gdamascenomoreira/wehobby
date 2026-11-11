import { describe, expect, it, vi } from 'vitest';
import {
  AZURE_MAPS_API_VERSION,
  AZURE_MAPS_SCOPE,
  createAzureMapsGeocoder,
  type TokenSource,
} from './azure-maps.js';
import { GeocoderError } from './geocoder.js';

const CLIENT_ID = '00000000-0000-4000-8000-000000000004';

function feature(
  type: string,
  address: object,
  coordinates: [number, number] = [-8.99, 38.96],
): object {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { type, address },
  };
}

const VILA_FRANCA = feature('PopulatedPlace', {
  locality: 'Vila Franca de Xira',
  adminDistricts: [{ name: 'Lisboa' }, { name: 'Vila Franca de Xira' }],
  countryRegion: { ISO: 'PT', name: 'Portugal' },
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/geo+json' },
    ...init,
  });
}

function setup(response: () => Promise<Response> | Response, credential?: TokenSource) {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(response()));
  const getToken = vi.fn<TokenSource['getToken']>(() => Promise.resolve({ token: 'test-token' }));
  const tokenSource: TokenSource = credential ?? { getToken };
  const geocoder = createAzureMapsGeocoder({
    clientId: CLIENT_ID,
    credential: tokenSource,
    fetch: fetchMock,
    timeoutMs: 50,
  });
  const lastRequest = () => {
    const [url, init] = fetchMock.mock.calls.at(-1) ?? [];
    return {
      url: new URL(url instanceof Request ? url.url : url instanceof URL ? url.href : (url ?? '')),
      headers: new Headers(init?.headers),
    };
  };
  return { geocoder, fetchMock, getToken, lastRequest };
}

describe('AzureMapsGeocoder', () => {
  it('searches the EU geocode endpoint with a bearer token and the client id', async () => {
    const { geocoder, getToken, lastRequest } = setup(() =>
      jsonResponse({ type: 'FeatureCollection', features: [VILA_FRANCA] }),
    );

    await geocoder.search('Vila Franca', 'pt');

    const { url, headers } = lastRequest();
    expect(url.origin).toBe('https://eu.atlas.microsoft.com');
    expect(url.pathname).toBe('/geocode');
    expect(url.searchParams.get('api-version')).toBe(AZURE_MAPS_API_VERSION);
    expect(url.searchParams.get('query')).toBe('Vila Franca');
    expect(url.searchParams.get('top')).toBe('20');
    expect(headers.get('authorization')).toBe('Bearer test-token');
    expect(headers.get('x-ms-client-id')).toBe(CLIENT_ID);
    expect(headers.get('accept-language')).toBe('pt-PT');
    expect(getToken).toHaveBeenCalledWith(AZURE_MAPS_SCOPE);
  });

  it('asks for English labels in English', async () => {
    const { geocoder, lastRequest } = setup(() => jsonResponse({ features: [] }));
    await geocoder.search('Lisbon', 'en');
    expect(lastRequest().headers.get('accept-language')).toBe('en-GB');
  });

  it('keeps only towns and municipalities, with a label and longitude/latitude swapped', async () => {
    const { geocoder } = setup(() =>
      jsonResponse({
        features: [
          VILA_FRANCA,
          feature('Address', { locality: 'Lisboa', countryRegion: { ISO: 'PT' } }),
          feature(
            'AdminDivision2',
            {
              adminDistricts: [{ name: 'Lisboa' }, { name: 'Lisboa' }],
              countryRegion: { ISO: 'PT' },
            },
            [-9.14, 38.72],
          ),
          feature('PopulatedPlace', { locality: 'Nowhere' }),
          { broken: true },
        ],
      }),
    );

    await expect(geocoder.search('lis', 'pt')).resolves.toEqual([
      { label: 'Vila Franca de Xira, Lisboa', countryCode: 'PT', lat: 38.96, lng: -8.99 },
      { label: 'Lisboa', countryCode: 'PT', lat: 38.72, lng: -9.14 },
    ]);
  });

  it('reverse geocodes longitude first, at locality level', async () => {
    const { geocoder, lastRequest } = setup(() => jsonResponse({ features: [VILA_FRANCA] }));

    await expect(geocoder.reverse(38.96, -8.99, 'pt')).resolves.toMatchObject({
      label: 'Vila Franca de Xira, Lisboa',
    });

    const { url } = lastRequest();
    expect(url.pathname).toBe('/reverseGeocode');
    expect(url.searchParams.get('coordinates')).toBe('-8.99,38.96');
    expect(url.searchParams.get('resultTypes')).toBe('PopulatedPlace,AdminDivision2');
  });

  it('returns undefined when nothing is found', async () => {
    const { geocoder } = setup(() => jsonResponse({ features: [] }));
    await expect(geocoder.reverse(0, 0, 'en')).resolves.toBeUndefined();
  });

  it('fails with an http error that does not contain the query', async () => {
    const { geocoder } = setup(() =>
      jsonResponse(
        { error: { code: 'Unauthorized' } },
        { status: 401, headers: { 'x-ms-error-code': 'Unauthorized' } },
      ),
    );

    const error = await geocoder.search('Rua Secreta 12', 'pt').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GeocoderError);
    expect(error).toMatchObject({ reason: 'http', status: 401 });
    expect((error as Error).message).not.toContain('Secreta');
  });

  it('times out', async () => {
    const { geocoder, fetchMock } = setup(() => jsonResponse({ features: [] }));
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason as Error);
          });
        }),
    );
    await expect(geocoder.search('Lisboa', 'pt')).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('fails on a network error', async () => {
    const { geocoder, fetchMock } = setup(() => jsonResponse({}));
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(geocoder.search('Lisboa', 'pt')).rejects.toMatchObject({ reason: 'network' });
  });

  it('fails on a body that is not a feature collection', async () => {
    const { geocoder } = setup(() => new Response('<html>', { status: 200 }));
    await expect(geocoder.search('Lisboa', 'pt')).rejects.toMatchObject({ reason: 'parse' });
  });

  it('fails without calling Maps when there is no token', async () => {
    const { geocoder, fetchMock } = setup(() => jsonResponse({ features: [] }), {
      getToken: () => Promise.reject(new Error('Managed identity endpoint unreachable')),
    });
    await expect(geocoder.search('Lisboa', 'pt')).rejects.toMatchObject({ reason: 'credential' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
