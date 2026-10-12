import type { HobbyCatalog } from '@wehobby/shared';
import type { FastifyPluginCallback } from 'fastify';
import type { HobbyRepository } from '../hobbies/repository.js';

export interface HobbiesRouteOptions {
  hobbies: HobbyRepository;
}

/** The public hobby catalog. It changes only with a migration, so browsers may cache it. */
export const hobbiesRoute: FastifyPluginCallback<HobbiesRouteOptions> = (
  app,
  { hobbies },
  done,
) => {
  app.get('/hobbies', async (_request, reply) => {
    const body: HobbyCatalog = { hobbies: await hobbies.catalog() };
    return reply.header('cache-control', 'public, max-age=300').send(body);
  });
  done();
};
