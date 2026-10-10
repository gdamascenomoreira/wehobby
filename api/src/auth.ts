import type { FastifyReply, FastifyRequest } from 'fastify';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { AuthConfig } from './config.js';
import { sendError } from './errors.js';

export interface AuthContext {
  /** Entra object id of the signed in user. */
  oid: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}

export type TokenVerifier = (token: string) => Promise<AuthContext>;

export class InvalidTokenError extends Error {}

/**
 * Verifies Entra External ID access tokens issued for this API: signature
 * (keys from the tenant JWKS), issuer, audience, expiry and the delegated scope.
 */
export function createTokenVerifier(config: AuthConfig, getKey?: JWTVerifyGetKey): TokenVerifier {
  const keys = getKey ?? createRemoteJWKSet(new URL(config.jwksUri));

  return async (token) => {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
      }));
    } catch (error) {
      if (error instanceof errors.JOSEError) {
        throw new InvalidTokenError(error.code);
      }
      throw error;
    }

    const scopes = typeof payload.scp === 'string' ? payload.scp.split(' ') : [];
    if (!scopes.includes(config.requiredScope)) {
      throw new InvalidTokenError('missing scope');
    }
    if (typeof payload.oid !== 'string' || payload.oid.length === 0) {
      throw new InvalidTokenError('missing oid');
    }
    return { oid: payload.oid };
  };
}

/** onRequest hook for routes that need a signed in user. Sets `request.auth`. */
export function requireAuth(verify: TokenVerifier) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token) {
      return sendError(reply, 'unauthorized', 'Sign in required');
    }
    try {
      request.auth = await verify(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        request.log.info({ reason: error.message }, 'rejected access token');
        return sendError(reply, 'unauthorized', 'Invalid or expired token');
      }
      throw error;
    }
  };
}

/** For handlers behind requireAuth: the signed in user. */
export function authOf(request: FastifyRequest): AuthContext {
  if (!request.auth) {
    throw new Error('Route is missing the requireAuth hook');
  }
  return request.auth;
}
