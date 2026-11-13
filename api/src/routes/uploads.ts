import {
  CreateUploadSchema,
  UploadParamsSchema,
  type CreateUploadResponse,
  type Upload,
} from '@wehobby/shared';
import type { FastifyBaseLogger, FastifyPluginCallback, FastifyReply } from 'fastify';
import { authOf, requireAuth, type TokenVerifier } from '../auth.js';
import type { UploadRow } from '../db/schema.js';
import { parseOrReply, sendError } from '../errors.js';
import { incomingPath, processedPath, StorageError, type PhotoStorage } from '../storage/index.js';
import type { UploadRepository } from '../uploads/repository.js';
import { LOOKUP_RATE_LIMIT, UPLOAD_RATE_LIMIT, WRITE_RATE_LIMIT } from './rate-limits.js';

export interface UploadsRouteOptions {
  uploads: UploadRepository;
  storage: PhotoStorage;
  verifyToken: TokenVerifier;
}

/**
 * Runs a storage call. A StorageError is logged (messages never contain
 * signatures) and turns into undefined, so the route answers 502; anything
 * else goes to the global error handler.
 */
async function attempt<T>(
  work: Promise<T>,
  log: FastifyBaseLogger,
): Promise<{ value: T } | undefined> {
  try {
    return { value: await work };
  } catch (error) {
    if (!(error instanceof StorageError)) throw error;
    log.warn({ reason: error.reason, status: error.status, msg: error.message }, 'storage failed');
    return undefined;
  }
}

const storageUnavailable = (reply: FastifyReply) =>
  sendError(reply, 'storage_unavailable', 'Photo storage is unavailable, try again later');

/** The API view of an upload: read links only once the photo is ready. */
async function toUpload(row: UploadRow, storage: PhotoStorage): Promise<Upload> {
  if (row.status !== 'ready' || row.width === null || row.height === null) {
    return { id: row.id, status: row.status, photo: null };
  }
  const [full, thumb] = await Promise.all([
    storage.createReadUrl(processedPath(row.id, 'full')),
    storage.createReadUrl(processedPath(row.id, 'thumb')),
  ]);
  return {
    id: row.id,
    status: row.status,
    photo: { fullUrl: full.url, thumbUrl: thumb.url, width: row.width, height: row.height },
  };
}

/**
 * Photo uploads, in three steps: ask for a write link, send the photo
 * straight to storage, then say it is complete so the worker processes it.
 * Every route only sees the signed in user's own uploads.
 */
export const uploadsRoute: FastifyPluginCallback<UploadsRouteOptions> = (
  app,
  { uploads, storage, verifyToken },
  done,
) => {
  app.addHook('onRequest', requireAuth(verifyToken));

  app.post('/uploads', { config: { rateLimit: UPLOAD_RATE_LIMIT } }, async (request, reply) => {
    const input = parseOrReply(CreateUploadSchema, request.body, reply);
    if (!input) return reply;

    const row = await uploads.create(authOf(request).oid, input);
    if (row === 'no_profile') {
      return sendError(reply, 'not_found', 'No profile yet');
    }

    const result = await attempt(
      storage.createUploadUrl(incomingPath(row.id), row.contentType),
      request.log,
    );
    if (!result) return storageUnavailable(reply);
    const signed = result.value;
    const body: CreateUploadResponse = {
      id: row.id,
      uploadUrl: signed.url,
      headers: signed.headers,
      expiresAt: signed.expiresAt.toISOString(),
    };
    return reply.code(201).send(body);
  });

  app.post(
    '/uploads/:id/complete',
    { config: { rateLimit: WRITE_RATE_LIMIT } },
    async (request, reply) => {
      const params = parseOrReply(UploadParamsSchema, request.params, reply);
      if (!params) return reply;
      const { oid } = authOf(request);

      const row = await uploads.findOwned(oid, params.id);
      if (!row) {
        return sendError(reply, 'not_found', 'Upload not found');
      }

      // Already completed: answer with its state, without a second job.
      if (row.status !== 'pending') {
        const current = await attempt(toUpload(row, storage), request.log);
        return current ? reply.send(current.value) : storageUnavailable(reply);
      }

      const size = await attempt(storage.getSize(incomingPath(row.id)), request.log);
      if (!size) return storageUnavailable(reply);
      if (size.value === undefined) {
        return sendError(reply, 'upload_not_received', 'The photo has not arrived yet');
      }
      // The SAS link cannot limit the size, so check what really arrived.
      if (size.value !== row.sizeBytes) {
        return sendError(reply, 'upload_size_mismatch', 'The photo is not the announced size');
      }

      const completed =
        (await uploads.complete(oid, row.id)) ?? (await uploads.findOwned(oid, row.id));
      if (!completed) {
        return sendError(reply, 'not_found', 'Upload not found');
      }
      const body = await attempt(toUpload(completed, storage), request.log);
      return body ? reply.send(body.value) : storageUnavailable(reply);
    },
  );

  // Polled by the web app while the worker runs, so it uses the lookup limit.
  app.get('/uploads/:id', { config: { rateLimit: LOOKUP_RATE_LIMIT } }, async (request, reply) => {
    const params = parseOrReply(UploadParamsSchema, request.params, reply);
    if (!params) return reply;

    const row = await uploads.findOwned(authOf(request).oid, params.id);
    if (!row) {
      return sendError(reply, 'not_found', 'Upload not found');
    }
    const body = await attempt(toUpload(row, storage), request.log);
    return body ? reply.send(body.value) : storageUnavailable(reply);
  });

  done();
};
