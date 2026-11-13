import { describe, expect, it, vi } from 'vitest';
import type { TokenSource } from '../azure/credential.js';
import { createAzureBlobStorage, STORAGE_SCOPE } from './azure-blob.js';
import { STORAGE_API_VERSION } from './sas.js';
import { StorageError } from './storage.js';

const NOW = Date.parse('2026-11-13T10:00:00Z');
const UPLOAD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function keyXml(expiry = '2026-11-14T10:00:00Z') {
  return `<?xml version="1.0" encoding="utf-8"?><UserDelegationKey><SignedOid>11111111-1111-4111-8111-111111111111</SignedOid><SignedTid>22222222-2222-4222-8222-222222222222</SignedTid><SignedStart>2026-11-13T09:55:00Z</SignedStart><SignedExpiry>${expiry}</SignedExpiry><SignedService>b</SignedService><SignedVersion>2022-11-02</SignedVersion><Value>${Buffer.from('placeholder').toString('base64')}</Value></UserDelegationKey>`;
}

interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function setup(respond: () => Response, credential?: TokenSource) {
  let now = NOW;
  const fetchMock = vi.fn<(url: string, init?: FetchInit) => Promise<Response>>(() =>
    Promise.resolve(respond()),
  );
  const getToken = vi.fn<TokenSource['getToken']>(() => Promise.resolve({ token: 'test-token' }));
  const storage = createAzureBlobStorage({
    accountName: 'stwehobbytest',
    container: 'photos',
    credential: credential ?? { getToken },
    fetch: fetchMock as unknown as typeof fetch,
    now: () => now,
  });
  return {
    storage,
    fetchMock,
    getToken,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

const keyResponse = () => new Response(keyXml(), { status: 200 });

describe('createAzureBlobStorage', () => {
  it('asks for a user delegation key with the managed identity token', async () => {
    const { storage, fetchMock, getToken } = setup(keyResponse);
    await storage.createUploadUrl(`incoming/${UPLOAD_ID}`, 'image/jpeg');

    expect(getToken).toHaveBeenCalledWith(STORAGE_SCOPE);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://stwehobbytest.blob.core.windows.net/?restype=service&comp=userdelegationkey',
    );
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer test-token',
      'x-ms-version': STORAGE_API_VERSION,
    });
    expect(init?.body ?? '').toContain('<Start>2026-11-13T09:55:00Z</Start>');
    expect(init?.body ?? '').toContain('<Expiry>2026-11-14T10:00:00Z</Expiry>');
  });

  it('gives a create and write link for one blob, valid 5 minutes', async () => {
    const { storage } = setup(keyResponse);
    const signed = await storage.createUploadUrl(`incoming/${UPLOAD_ID}`, 'image/png');

    const url = new URL(signed.url);
    expect(url.origin + url.pathname).toBe(
      `https://stwehobbytest.blob.core.windows.net/photos/incoming/${UPLOAD_ID}`,
    );
    expect(url.searchParams.get('sp')).toBe('cw');
    expect(url.searchParams.get('sr')).toBe('b');
    expect(url.searchParams.get('spr')).toBe('https');
    expect(url.searchParams.get('se')).toBe('2026-11-13T10:05:00Z');
    expect(signed.expiresAt.toISOString()).toBe('2026-11-13T10:05:00.000Z');
    expect(signed.headers).toEqual({ 'x-ms-blob-type': 'BlockBlob', 'content-type': 'image/png' });
  });

  it('gives a read only link valid one hour', async () => {
    const { storage } = setup(keyResponse);
    const signed = await storage.createReadUrl(`processed/${UPLOAD_ID}/thumb.webp`);
    const url = new URL(signed.url);
    expect(url.pathname).toBe(`/photos/processed/${UPLOAD_ID}/thumb.webp`);
    expect(url.searchParams.get('sp')).toBe('r');
    expect(url.searchParams.get('se')).toBe('2026-11-13T11:00:00Z');
  });

  it('reuses the key and renews it before links could outlive it', async () => {
    const { storage, fetchMock, advance } = setup(keyResponse);
    await storage.createReadUrl(`processed/${UPLOAD_ID}/full.webp`);
    await storage.createReadUrl(`processed/${UPLOAD_ID}/thumb.webp`);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    advance(21 * 60 * 60 * 1000); // 3 hours left on a 24 hour key
    await storage.createReadUrl(`processed/${UPLOAD_ID}/full.webp`);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    advance(2 * 60 * 60 * 1000); // 1 hour left: a 1 hour link would outlive it
    await storage.createReadUrl(`processed/${UPLOAD_ID}/full.webp`);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refuses paths this app never creates', async () => {
    const { storage, fetchMock } = setup(keyResponse);
    await expect(storage.createReadUrl('../other/blob')).rejects.toThrow(/Invalid photo path/);
    await expect(storage.createUploadUrl('incoming/x?comp=list', 'image/jpeg')).rejects.toThrow();
    await expect(storage.getSize(`processed/${UPLOAD_ID}/../../x`)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reads the size of a blob with HEAD', async () => {
    const { storage, fetchMock } = setup(
      () => new Response(null, { status: 200, headers: { 'content-length': '12345' } }),
    );
    await expect(storage.getSize(`incoming/${UPLOAD_ID}`)).resolves.toBe(12345);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`https://stwehobbytest.blob.core.windows.net/photos/incoming/${UPLOAD_ID}`);
    expect(init?.method).toBe('HEAD');
  });

  it('says a missing blob has no size', async () => {
    const { storage } = setup(() => new Response(null, { status: 404 }));
    await expect(storage.getSize(`incoming/${UPLOAD_ID}`)).resolves.toBeUndefined();
  });

  it('turns failures into StorageError', async () => {
    const forbidden = setup(() => new Response('denied', { status: 403 }));
    await expect(forbidden.storage.getSize(`incoming/${UPLOAD_ID}`)).rejects.toMatchObject({
      reason: 'http',
      status: 403,
    });
    await expect(
      forbidden.storage.createReadUrl(`processed/${UPLOAD_ID}/full.webp`),
    ).rejects.toBeInstanceOf(StorageError);

    const garbage = setup(() => new Response('<Error/>', { status: 200 }));
    await expect(
      garbage.storage.createReadUrl(`processed/${UPLOAD_ID}/full.webp`),
    ).rejects.toMatchObject({ reason: 'parse' });

    const noToken = setup(keyResponse, { getToken: () => Promise.reject(new Error('no IMDS')) });
    await expect(noToken.storage.getSize(`incoming/${UPLOAD_ID}`)).rejects.toMatchObject({
      reason: 'credential',
    });
  });
});
