import { MAX_UPLOAD_BYTES, UPLOAD_CONTENT_TYPES } from '@wehobby/shared';
import type { FastifyPluginCallback, FastifyReply } from 'fastify';
import { sendError } from '../errors.js';
import type { FakePhotoStorage } from '../storage/index.js';

export interface DevStorageRouteOptions {
  storage: FakePhotoStorage;
}

/**
 * Stands in for Blob Storage when STORAGE=fake, so the whole upload flow works
 * on a laptop: PUT saves a blob, GET reads it. Only registered with the fake
 * storage, which config refuses in production.
 */
export const devStorageRoute: FastifyPluginCallback<DevStorageRouteOptions> = (
  app,
  { storage },
  done,
) => {
  app.addContentTypeParser(
    [...UPLOAD_CONTENT_TYPES],
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_request, body, parsed) => {
      parsed(null, body);
    },
  );

  const pathOf = (params: unknown) => (params as { '*': string })['*'];

  // The fake rejects anything that is not a photo path, such as `../`.
  const invalidPath = (reply: FastifyReply) => sendError(reply, 'not_found', 'No such blob');

  app.put('/dev-storage/*', async (request, reply) => {
    if (!Buffer.isBuffer(request.body)) {
      return sendError(reply, 'validation', 'Send the photo as the request body');
    }
    try {
      await storage.put(pathOf(request.params), request.body);
    } catch {
      return invalidPath(reply);
    }
    return reply.code(201).send();
  });

  app.get('/dev-storage/*', async (request, reply) => {
    const path = pathOf(request.params);
    let data;
    try {
      data = await storage.get(path);
    } catch {
      return invalidPath(reply);
    }
    if (!data) return invalidPath(reply);
    const type = path.endsWith('.webp') ? 'image/webp' : 'application/octet-stream';
    return reply.type(type).send(data);
  });

  done();
};
