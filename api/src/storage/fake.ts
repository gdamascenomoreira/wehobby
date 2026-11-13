import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  assertPhotoPath,
  READ_URL_TTL_MS,
  UPLOAD_URL_TTL_MS,
  type PhotoStorage,
} from './storage.js';

/** Where the API serves the fake container (see routes/dev-storage.ts). */
export const DEV_STORAGE_PREFIX = '/api/dev-storage';

export interface FakePhotoStorage extends PhotoStorage {
  /** Saves a blob, as Blob Storage does on PUT. */
  put(path: string, data: Buffer): Promise<void>;
  /** Reads a blob, or undefined when it does not exist. */
  get(path: string): Promise<Buffer | undefined>;
}

/**
 * Photos in a local folder, for development and tests only (config refuses it
 * in production). Links point at the API itself and are not signed.
 */
export function createFakePhotoStorage(
  directory: string,
  now: () => number = Date.now,
): FakePhotoStorage {
  function file(path: string): string {
    assertPhotoPath(path);
    return join(directory, ...path.split('/'));
  }

  const link = (path: string, ttlMs: number) => {
    assertPhotoPath(path);
    return { url: `${DEV_STORAGE_PREFIX}/${path}`, expiresAt: new Date(now() + ttlMs) };
  };

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- same interface as Blob Storage
    async createUploadUrl(path, contentType) {
      return { ...link(path, UPLOAD_URL_TTL_MS), headers: { 'content-type': contentType } };
    },

    // eslint-disable-next-line @typescript-eslint/require-await -- same interface as Blob Storage
    async createReadUrl(path) {
      return link(path, READ_URL_TTL_MS);
    },

    async getSize(path) {
      try {
        return (await stat(file(path))).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
      }
    },

    async put(path, data) {
      const target = file(path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, data);
    },

    async get(path) {
      try {
        return await readFile(file(path));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
      }
    },
  };
}
