import { createManagedIdentityCredential } from '../azure/credential.js';
import type { StorageConfig } from '../config.js';
import { createAzureBlobStorage } from './azure-blob.js';
import { createFakePhotoStorage, type FakePhotoStorage } from './fake.js';
import type { PhotoStorage } from './storage.js';

export { DEV_STORAGE_PREFIX, type FakePhotoStorage } from './fake.js';
export {
  incomingPath,
  processedPath,
  StorageError,
  type PhotoStorage,
  type SignedUrl,
} from './storage.js';

/** Blob Storage with the VM managed identity, or a local folder in development. */
export function createPhotoStorage(
  config: StorageConfig,
): { kind: 'azure'; storage: PhotoStorage } | { kind: 'fake'; storage: FakePhotoStorage } {
  if (config.kind === 'fake') {
    return { kind: 'fake', storage: createFakePhotoStorage(config.directory) };
  }
  return {
    kind: 'azure',
    storage: createAzureBlobStorage({
      accountName: config.accountName,
      container: config.container,
      credential: createManagedIdentityCredential(),
    }),
  };
}
