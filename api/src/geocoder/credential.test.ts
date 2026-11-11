import { describe, expect, it, vi } from 'vitest';
import { AZURE_MAPS_SCOPE } from './azure-maps.js';
import { createManagedIdentityCredential, IMDS_TOKEN_URL } from './credential.js';

const NOW = Date.UTC(2026, 10, 11, 12, 0, 0);
const IN_ONE_HOUR = String(NOW / 1000 + 3600);

function setup(...responses: Response[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockResolvedValueOnce(response);
  let now = NOW;
  const credential = createManagedIdentityCredential({ fetch: fetchMock, now: () => now });
  return {
    credential,
    fetchMock,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const token = (value: string, expiresOn = IN_ONE_HOUR) =>
  Response.json({ access_token: value, expires_on: expiresOn, token_type: 'Bearer' });

describe('managed identity credential', () => {
  it('asks IMDS for a token for the Maps resource', async () => {
    const { credential, fetchMock } = setup(token('maps-token'));

    await expect(credential.getToken(AZURE_MAPS_SCOPE)).resolves.toEqual({ token: 'maps-token' });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    const requested = new URL(url instanceof URL ? url.href : (url as string));
    expect(`${requested.origin}${requested.pathname}`).toBe(IMDS_TOKEN_URL);
    expect(requested.searchParams.get('resource')).toBe('https://atlas.microsoft.com/');
    expect(requested.searchParams.get('api-version')).toBe('2018-02-01');
    expect(new Headers(init?.headers).get('metadata')).toBe('true');
  });

  it('reuses the token until 5 minutes before it expires', async () => {
    const { credential, fetchMock, advance } = setup(token('first'), token('second'));

    await credential.getToken(AZURE_MAPS_SCOPE);
    advance(54 * 60 * 1000);
    await expect(credential.getToken(AZURE_MAPS_SCOPE)).resolves.toEqual({ token: 'first' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    advance(2 * 60 * 1000);
    await expect(credential.getToken(AZURE_MAPS_SCOPE)).resolves.toEqual({ token: 'second' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails when IMDS refuses', async () => {
    const { credential } = setup(new Response('no identity', { status: 400 }));
    await expect(credential.getToken(AZURE_MAPS_SCOPE)).rejects.toThrow(/400/);
  });

  it('fails on an unexpected body', async () => {
    const { credential } = setup(Response.json({ token: 'x' }));
    await expect(credential.getToken(AZURE_MAPS_SCOPE)).rejects.toThrow(/Unexpected/);
  });

  it('fails when IMDS is unreachable, for example outside Azure', async () => {
    const { credential, fetchMock } = setup();
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(credential.getToken(AZURE_MAPS_SCOPE)).rejects.toThrow('fetch failed');
  });
});
