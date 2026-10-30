import type { FastifyPluginCallback } from 'fastify';
import type { ReadinessCheck } from '../db/readiness.js';

export interface ReadyRouteOptions {
  check: ReadinessCheck;
}

/** Readiness, unlike /health: answers 503 until the API can really serve requests. */
export const readyRoute: FastifyPluginCallback<ReadyRouteOptions> = (app, { check }, done) => {
  app.get('/ready', async (request, reply) => {
    const result = await check();
    if (result.status !== 'ready') {
      request.log.warn({ reason: result.reason }, 'API is not ready');
      return reply.code(503).send(result);
    }
    return reply.send(result);
  });
  done();
};
