import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { healthRoute } from './routes/health.js';

/** Every route lives under this prefix, so no proxy needs to rewrite paths. */
export const API_PREFIX = '/api';

export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
  });

  if (config.CORS_ORIGIN) {
    await app.register(cors, {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });
  }

  await app.register(healthRoute, { prefix: API_PREFIX, version: config.APP_VERSION });

  return app;
}
