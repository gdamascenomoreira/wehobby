import {
  TypeSuggestionSchema,
  UpdateMyHobbiesSchema,
  type HobbiesResponse,
  type MyHobbies,
} from '@wehobby/shared';
import type { FastifyPluginCallback } from 'fastify';
import { authOf, requireAuth, type TokenVerifier } from '../auth.js';
import { parseOrReply, sendError } from '../errors.js';
import type { HobbyRepository } from '../hobbies/repository.js';
import { SUGGESTION_RATE_LIMIT, WRITE_RATE_LIMIT } from './rate-limits.js';

export interface HobbiesRouteOptions {
  hobbies: HobbyRepository;
  verifyToken: TokenVerifier;
}

/**
 * The hobby catalog, the signed in user's own selection and type suggestions.
 * As with `/me`, there is no user id in any path: the selection always
 * belongs to the token.
 */
export const hobbiesRoute: FastifyPluginCallback<HobbiesRouteOptions> = (
  app,
  { hobbies, verifyToken },
  done,
) => {
  app.addHook('onRequest', requireAuth(verifyToken));

  app.get('/hobbies', async (_request, reply) => {
    const body: HobbiesResponse = { hobbies: await hobbies.listActive() };
    return reply.send(body);
  });

  app.get('/me/hobbies', async (request, reply) => {
    const selection = await hobbies.findSelection(authOf(request).oid);
    if (!selection) {
      return sendError(reply, 'not_found', 'No profile yet');
    }
    const body: MyHobbies = { hobbies: selection };
    return reply.send(body);
  });

  app.put('/me/hobbies', { config: { rateLimit: WRITE_RATE_LIMIT } }, async (request, reply) => {
    const input = parseOrReply(UpdateMyHobbiesSchema, request.body, reply);
    if (!input) return reply;

    const result = await hobbies.replaceSelection(authOf(request).oid, input);
    if (!result.ok) {
      switch (result.reason) {
        case 'no_profile':
          return sendError(reply, 'not_found', 'No profile yet');
        case 'invalid_hobby':
          return sendError(reply, 'invalid_hobby', `Unknown hobby: ${result.id ?? ''}`);
        case 'invalid_type':
          return sendError(
            reply,
            'invalid_type',
            `Unknown type for this hobby: ${result.id ?? ''}`,
          );
      }
    }
    const body: MyHobbies = { hobbies: result.hobbies };
    return reply.send(body);
  });

  app.post(
    '/hobby-types/suggestions',
    { config: { rateLimit: SUGGESTION_RATE_LIMIT } },
    async (request, reply) => {
      const input = parseOrReply(TypeSuggestionSchema, request.body, reply);
      if (!input) return reply;

      const result = await hobbies.suggestType(authOf(request).oid, input);
      if (result === 'no_profile') {
        return sendError(reply, 'not_found', 'No profile yet');
      }
      if (result === 'invalid_hobby') {
        return sendError(reply, 'invalid_hobby', `Unknown hobby: ${input.hobbyId}`);
      }
      // 202 for new and duplicate suggestions alike: both wait for review.
      return reply.code(202).send();
    },
  );
  done();
};
