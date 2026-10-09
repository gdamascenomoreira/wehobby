import { HealthResponseSchema, type HealthResponse } from '@wehobby/shared';
import type { FastifyPluginCallback } from 'fastify';

export interface HealthRouteOptions {
  version: string;
}

export const healthRoute: FastifyPluginCallback<HealthRouteOptions> = (app, { version }, done) => {
  app.get('/health', (_request, reply) => {
    const body: HealthResponse = HealthResponseSchema.parse({ status: 'ok', version });
    return reply.send(body);
  });
  done();
};
