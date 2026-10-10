import type { PublicConfig } from '@wehobby/shared';
import type { FastifyPluginCallback } from 'fastify';

export interface PublicConfigRouteOptions {
  config: PublicConfig;
}

/** Sign in settings for the browser, so one web image works in every environment. */
export const publicConfigRoute: FastifyPluginCallback<PublicConfigRouteOptions> = (
  app,
  { config },
  done,
) => {
  app.get('/config', (_request, reply) => {
    return reply.header('cache-control', 'public, max-age=300').send(config);
  });
  done();
};
