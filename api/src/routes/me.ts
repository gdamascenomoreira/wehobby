import { CreateProfileSchema, UpdateProfileSchema, type Profile } from '@wehobby/shared';
import type { FastifyPluginCallback } from 'fastify';
import { authOf, requireAuth, type TokenVerifier } from '../auth.js';
import { parseOrReply, sendError } from '../errors.js';
import {
  ProfileExistsError,
  toProfile,
  UsernameTakenError,
  type UserRepository,
} from '../users/repository.js';
import { WRITE_RATE_LIMIT } from './rate-limits.js';

export interface MeRouteOptions {
  users: UserRepository;
  verifyToken: TokenVerifier;
}

/**
 * The signed in user's own profile. There is no user id in the path: the
 * profile is always the one that belongs to the token, so ownership is
 * enforced by construction.
 */
export const meRoute: FastifyPluginCallback<MeRouteOptions> = (
  app,
  { users, verifyToken },
  done,
) => {
  app.addHook('onRequest', requireAuth(verifyToken));

  app.get('/me', async (request, reply) => {
    const row = await users.findByOid(authOf(request).oid);
    if (!row) {
      return sendError(reply, 'not_found', 'No profile yet');
    }
    const body: Profile = toProfile(row);
    return reply.send(body);
  });

  app.post('/me', { config: { rateLimit: WRITE_RATE_LIMIT } }, async (request, reply) => {
    const input = parseOrReply(CreateProfileSchema, request.body, reply);
    if (!input) return reply;

    try {
      const row = await users.create(authOf(request).oid, input);
      const body: Profile = toProfile(row);
      return await reply.code(201).send(body);
    } catch (error) {
      if (error instanceof ProfileExistsError) {
        return sendError(reply, 'profile_exists', 'This account already has a profile');
      }
      if (error instanceof UsernameTakenError) {
        return sendError(reply, 'username_taken', 'This username is taken');
      }
      throw error;
    }
  });

  app.patch('/me', { config: { rateLimit: WRITE_RATE_LIMIT } }, async (request, reply) => {
    const patch = parseOrReply(UpdateProfileSchema, request.body, reply);
    if (!patch) return reply;

    const row = await users.update(authOf(request).oid, patch);
    if (!row) {
      return sendError(reply, 'not_found', 'No profile yet');
    }
    const body: Profile = toProfile(row);
    return reply.send(body);
  });
  done();
};
