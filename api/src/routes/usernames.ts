import { UsernameSchema, type UsernameAvailability } from '@wehobby/shared';
import type { FastifyPluginCallback } from 'fastify';
import { requireAuth, type TokenVerifier } from '../auth.js';
import { parseOrReply } from '../errors.js';
import type { UserRepository } from '../users/repository.js';
import { LOOKUP_RATE_LIMIT } from './rate-limits.js';

export interface UsernamesRouteOptions {
  users: UserRepository;
  verifyToken: TokenVerifier;
}

/** Lets onboarding check a username before submitting. Signed in users only, to limit scraping. */
export const usernamesRoute: FastifyPluginCallback<UsernamesRouteOptions> = (
  app,
  { users, verifyToken },
  done,
) => {
  app.get<{ Params: { username: string } }>(
    '/usernames/:username',
    { onRequest: requireAuth(verifyToken), config: { rateLimit: LOOKUP_RATE_LIMIT } },
    async (request, reply) => {
      const username = parseOrReply(UsernameSchema, request.params.username, reply);
      if (username === undefined) return reply;

      const body: UsernameAvailability = {
        username,
        available: !(await users.isUsernameTaken(username)),
      };
      return reply.send(body);
    },
  );
  done();
};
