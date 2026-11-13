/** A link the browser can use without credentials, valid until `expiresAt`. */
export interface SignedUrl {
  url: string;
  expiresAt: Date;
}

/**
 * The photos container. Paths are blob names inside it, for example
 * `incoming/<uploadId>`. Implementations: Blob Storage with the VM managed
 * identity in production, a local folder in development and tests.
 */
export interface PhotoStorage {
  /** A write only link for one blob, plus the headers the PUT request must send. */
  createUploadUrl(
    path: string,
    contentType: string,
  ): Promise<SignedUrl & { headers: Record<string, string> }>;
  /** A read only link for one blob. */
  createReadUrl(path: string): Promise<SignedUrl>;
  /** Size in bytes, or undefined when the blob does not exist. */
  getSize(path: string): Promise<number | undefined>;
}

/** How long the browser has to start sending a photo. */
export const UPLOAD_URL_TTL_MS = 5 * 60 * 1000;
/** How long a photo link works. Clients ask for new links after that. */
export const READ_URL_TTL_MS = 60 * 60 * 1000;

export type StorageErrorReason = 'credential' | 'http' | 'network' | 'parse';

/** A storage call failed. Messages never contain SAS signatures, so they are safe to log. */
export class StorageError extends Error {
  constructor(
    readonly reason: StorageErrorReason,
    message: string,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, { cause: options?.cause });
    this.status = options?.status;
  }

  readonly status: number | undefined;
}

/** Blob names this app creates: `incoming/<uuid>` or `processed/<uuid>/<name>.<ext>`. */
const PATH_PATTERN = /^(incoming\/[0-9a-f-]{36}|processed\/[0-9a-f-]{36}\/[a-z]+\.(webp|jpg))$/;

/** Throws on anything that is not a blob name this app creates, such as `../`. */
export function assertPhotoPath(path: string): void {
  if (!PATH_PATTERN.test(path)) {
    throw new Error('Invalid photo path');
  }
}

export const incomingPath = (uploadId: string) => `incoming/${uploadId}`;
export const processedPath = (uploadId: string, name: 'full' | 'thumb') =>
  `processed/${uploadId}/${name}.webp`;
