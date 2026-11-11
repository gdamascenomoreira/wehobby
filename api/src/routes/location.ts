import {
  MAX_PLACE_RESULTS,
  PlaceSearchQuerySchema,
  roundCoordinate,
  UpdateMyLocationSchema,
  type MyLocation,
  type PlaceSearchResponse,
} from '@wehobby/shared';
import type { FastifyBaseLogger, FastifyPluginCallback, FastifyReply } from 'fastify';
import { authOf, requireAuth, type TokenVerifier } from '../auth.js';
import { parseOrReply, sendError } from '../errors.js';
import { GeocoderError, type Geocoder } from '../geocoder/index.js';
import type { LocationRepository } from '../location/repository.js';
import type { UserRepository } from '../users/repository.js';
import { LOOKUP_RATE_LIMIT, WRITE_RATE_LIMIT } from './rate-limits.js';

export interface LocationRouteOptions {
  users: UserRepository;
  locations: LocationRepository;
  geocoder: Geocoder;
  verifyToken: TokenVerifier;
}

/**
 * Logs a geocoder failure without the query or the coordinates (the error
 * messages never contain them) and answers 502. Other errors go to the
 * global error handler.
 */
function replyGeocoderError(error: unknown, log: FastifyBaseLogger, reply: FastifyReply) {
  if (!(error instanceof GeocoderError)) throw error;
  log.warn({ reason: error.reason, status: error.status, msg: error.message }, 'geocoder failed');
  return sendError(reply, 'geocoder_unavailable', 'City search is unavailable, try again later');
}

/**
 * City search and the signed in user's own approximate location. No response
 * ever contains coordinates: only place ids, labels and country codes.
 */
export const locationRoute: FastifyPluginCallback<LocationRouteOptions> = (
  app,
  { users, locations, geocoder, verifyToken },
  done,
) => {
  app.addHook('onRequest', requireAuth(verifyToken));

  app.get(
    '/places/search',
    { config: { rateLimit: LOOKUP_RATE_LIMIT } },
    async (request, reply) => {
      const input = parseOrReply(PlaceSearchQuerySchema, request.query, reply);
      if (!input) return reply;

      const user = await users.findByOid(authOf(request).oid);
      if (!user) {
        return sendError(reply, 'not_found', 'No profile yet');
      }

      let places = await locations.findCachedSearch(input.q, user.language);
      if (!places) {
        try {
          const results = await geocoder.search(input.q, user.language);
          places = await locations.saveSearch(input.q, user.language, results);
        } catch (error) {
          return replyGeocoderError(error, request.log, reply);
        }
      }
      const body: PlaceSearchResponse = { places: places.slice(0, MAX_PLACE_RESULTS) };
      return reply.send(body);
    },
  );

  app.put('/me/location', { config: { rateLimit: WRITE_RATE_LIMIT } }, async (request, reply) => {
    const input = parseOrReply(UpdateMyLocationSchema, request.body, reply);
    if (!input) return reply;
    const { oid } = authOf(request);

    if ('placeId' in input) {
      const result = await locations.setFromPlace(oid, input.placeId);
      if (result === 'place_not_found') {
        return sendError(reply, 'place_not_found', 'Unknown place');
      }
      if (result === 'no_profile') {
        return sendError(reply, 'not_found', 'No profile yet');
      }
      const body: MyLocation = result;
      return reply.send(body);
    }

    // Round first: the exact position is never geocoded, stored or logged.
    const point = { lat: roundCoordinate(input.lat), lng: roundCoordinate(input.lng) };

    const user = await users.findByOid(oid);
    if (!user) {
      return sendError(reply, 'not_found', 'No profile yet');
    }

    let found;
    try {
      found = await geocoder.reverse(point.lat, point.lng, user.language);
    } catch (error) {
      return replyGeocoderError(error, request.log, reply);
    }
    if (!found) {
      return sendError(reply, 'no_place_here', 'No town or city found here, search for it instead');
    }

    const place = await locations.upsertPlace(found, user.language);
    const result = await locations.setPoint(oid, point, place);
    if (result === 'no_profile') {
      return sendError(reply, 'not_found', 'No profile yet');
    }
    const body: MyLocation = result;
    return reply.send(body);
  });

  app.delete(
    '/me/location',
    { config: { rateLimit: WRITE_RATE_LIMIT } },
    async (request, reply) => {
      const cleared = await locations.clear(authOf(request).oid);
      if (!cleared) {
        return sendError(reply, 'not_found', 'No profile yet');
      }
      return reply.code(204).send();
    },
  );
  done();
};
