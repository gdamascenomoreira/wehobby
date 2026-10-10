import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { JWTVerifyGetKey } from 'jose';
import { createTokenVerifier } from './auth.js';
import type { Config } from './config.js';
import type { Database } from './db/client.js';
import { sendError } from './errors.js';
import { healthRoute } from './routes/health.js';
import { meRoute } from './routes/me.js';
import { publicConfigRoute } from './routes/public-config.js';
import { usernamesRoute } from './routes/usernames.js';
import { createUserRepository } from './users/repository.js';

/** Every route lives under this prefix, so no proxy needs to rewrite paths. */
export const API_PREFIX = '/api';

export interface AppDependencies {
  db: Database;
  /** Signing keys for access tokens. Defaults to the tenant JWKS; tests pass local keys. */
  getSigningKey?: JWTVerifyGetKey;
}

export async function buildApp(config: Config, deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: config.TRUST_PROXY,
    logger: {
      level: config.LOG_LEVEL,
      // Never log tokens.
      redact: ['req.headers.authorization'],
      ...(config.NODE_ENV === 'development' && { transport: { target: 'pino-pretty' } }),
    },
  });

  app.decorateRequest('auth', null);

  app.setErrorHandler((error, request, reply) => {
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number(error.statusCode)
        : 500;
    if (statusCode === 429) {
      return sendError(reply, 'rate_limited', 'Too many requests, try again in a minute');
    }
    if (statusCode >= 400 && statusCode < 500) {
      // Malformed JSON, unsupported content type, body too large...
      return sendError(reply, 'validation', error instanceof Error ? error.message : 'Bad request');
    }
    request.log.error(error);
    return sendError(reply, 'internal', 'Something went wrong');
  });

  if (config.CORS_ORIGIN) {
    await app.register(cors, {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    });
  }

  // Limits apply only to routes that opt in with `config.rateLimit`. They run
  // after authentication, so signed in users are counted per account.
  await app.register(rateLimit, {
    global: false,
    hook: 'preHandler',
    keyGenerator: (request) => request.auth?.oid ?? request.ip,
  });

  const users = createUserRepository(deps.db);
  const verifyToken = createTokenVerifier(config.auth, deps.getSigningKey);

  await app.register(
    async (api) => {
      await api.register(healthRoute, { version: config.APP_VERSION });
      await api.register(publicConfigRoute, { config: { auth: config.auth.public } });
      await api.register(usernamesRoute, { users, verifyToken });
      await api.register(meRoute, { users, verifyToken });
    },
    { prefix: API_PREFIX },
  );

  return app;
}
