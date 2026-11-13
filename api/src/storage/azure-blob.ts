import type { TokenSource } from '../azure/credential.js';
import {
  createBlobSas,
  parseUserDelegationKey,
  sasTime,
  STORAGE_API_VERSION,
  type UserDelegationKey,
} from './sas.js';
import {
  assertPhotoPath,
  READ_URL_TTL_MS,
  StorageError,
  UPLOAD_URL_TTL_MS,
  type PhotoStorage,
} from './storage.js';

export const STORAGE_SCOPE = 'https://storage.azure.com/.default';
export const STORAGE_TIMEOUT_MS = 5000;

/** A new user delegation key is valid this long (the maximum is 7 days). */
const KEY_LIFETIME_MS = 24 * 60 * 60 * 1000;
/** Tolerates a VM clock a little ahead of the storage service. */
const KEY_START_SKEW_MS = 5 * 60 * 1000;
/** Every link must expire before its key, so keys are renewed this early. */
const KEY_REFRESH_MARGIN_MS = 2 * READ_URL_TTL_MS;

export interface AzureBlobStorageOptions {
  accountName: string;
  container: string;
  credential: TokenSource;
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * The photos container in Blob Storage, reached with the VM managed identity
 * (Storage Blob Data Contributor). Links are user delegation SAS: signed with
 * a key the identity asks for, so there is no account key anywhere.
 */
export function createAzureBlobStorage(options: AzureBlobStorageOptions): PhotoStorage {
  const doFetch = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const endpoint = `https://${options.accountName}.blob.core.windows.net`;
  let cachedKey: { key: UserDelegationKey; expiresAt: number } | undefined;

  async function request(
    url: string,
    init: { method: string; headers?: Record<string, string>; body?: string },
  ): Promise<Response> {
    let token;
    try {
      token = await options.credential.getToken(STORAGE_SCOPE);
    } catch (error) {
      throw new StorageError('credential', 'Could not get a storage token', { cause: error });
    }
    if (!token) throw new StorageError('credential', 'No storage token');

    try {
      return await doFetch(url, {
        ...init,
        headers: {
          ...init.headers,
          authorization: `Bearer ${token.token}`,
          'x-ms-version': STORAGE_API_VERSION,
        },
        signal: AbortSignal.timeout(STORAGE_TIMEOUT_MS),
      });
    } catch (error) {
      throw new StorageError('network', 'Blob Storage did not answer', { cause: error });
    }
  }

  async function delegationKey(): Promise<UserDelegationKey> {
    if (cachedKey && cachedKey.expiresAt - KEY_REFRESH_MARGIN_MS > now()) {
      return cachedKey.key;
    }
    const start = new Date(now() - KEY_START_SKEW_MS);
    const expiry = new Date(now() + KEY_LIFETIME_MS);
    const body = `<?xml version="1.0" encoding="utf-8"?><KeyInfo><Start>${sasTime(start)}</Start><Expiry>${sasTime(expiry)}</Expiry></KeyInfo>`;
    const response = await request(`${endpoint}/?restype=service&comp=userdelegationkey`, {
      method: 'POST',
      headers: { 'content-type': 'application/xml' },
      body,
    });
    if (!response.ok) {
      throw new StorageError('http', 'Get User Delegation Key failed', {
        status: response.status,
      });
    }
    const key = parseUserDelegationKey(await response.text());
    if (!key) throw new StorageError('parse', 'Unexpected user delegation key response');
    cachedKey = { key, expiresAt: Date.parse(key.signedExpiry) };
    return key;
  }

  function blobUrl(path: string): string {
    assertPhotoPath(path);
    return `${endpoint}/${options.container}/${path}`;
  }

  async function signedUrl(path: string, permissions: string, ttlMs: number) {
    const url = blobUrl(path);
    const key = await delegationKey();
    const expiresAt = new Date(now() + ttlMs);
    const sas = createBlobSas({
      accountName: options.accountName,
      container: options.container,
      blob: path,
      permissions,
      expiresOn: expiresAt,
      key,
    });
    return { url: `${url}?${sas}`, expiresAt };
  }

  return {
    async createUploadUrl(path, contentType) {
      // Create and write only: the link cannot read, list or delete anything.
      const signed = await signedUrl(path, 'cw', UPLOAD_URL_TTL_MS);
      return { ...signed, headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': contentType } };
    },

    createReadUrl(path) {
      return signedUrl(path, 'r', READ_URL_TTL_MS);
    },

    async getSize(path) {
      const response = await request(blobUrl(path), { method: 'HEAD' });
      if (response.status === 404) return undefined;
      if (!response.ok) {
        throw new StorageError('http', 'Get Blob Properties failed', { status: response.status });
      }
      const size = Number(response.headers.get('content-length'));
      if (!Number.isInteger(size) || size < 0) {
        throw new StorageError('parse', 'Blob has no valid Content-Length');
      }
      return size;
    },
  };
}
