import {
  ApiErrorSchema,
  MyLocationSchema,
  PlaceSearchResponseSchema,
  ProfileSchema,
} from '@wehobby/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import { pointLat, pointLng } from '../db/geography.js';
import { places, users } from '../db/schema.js';
import { createFakeGeocoder } from '../geocoder/fake.js';
import { GeocoderError, type Geocoder } from '../geocoder/index.js';
import { bearer, createTestTokens } from '../test/auth.js';
import { testConfig } from '../test/config.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../test/database.js';

const COORDINATE_KEYS = new Set(['lat', 'lng', 'latitude', 'longitude', 'centre', 'coordinates']);

/** Fails if a response body has any key that could carry a coordinate. */
function expectNoCoordinates(response: LightMyRequestResponse) {
  if (!response.body) return;
  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        walk(item, `${path}[${String(index)}]`);
      });
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      expect(COORDINATE_KEYS.has(key), `${path}.${key} in ${response.body}`).toBe(false);
      if (key === 'location' && child !== null) {
        expect(MyLocationSchema.strict().safeParse(child).success, response.body).toBe(true);
      }
      walk(child, `${path}.${key}`);
    }
  };
  walk(response.json(), 'body');
}

describe.skipIf(!TEST_DATABASE_URL)('location routes', () => {
  const config = testConfig();
  const fake = createFakeGeocoder();
  const geocoder = {
    search: vi.fn<Geocoder['search']>((...args) => fake.search(...args)),
    reverse: vi.fn<Geocoder['reverse']>((...args) => fake.reverse(...args)),
  };
  let database: TestDatabase;
  let app: FastifyInstance;
  let sign: Awaited<ReturnType<typeof createTestTokens>>['sign'];
  const responses: LightMyRequestResponse[] = [];

  beforeAll(async () => {
    database = await createTestDatabase();
    const tokens = await createTestTokens(config);
    sign = tokens.sign;
    app = await buildApp(config, {
      db: database.db,
      getSigningKey: tokens.getSigningKey,
      geocoder,
    });
  });

  afterAll(async () => {
    // Every response any test received, success or error.
    for (const response of responses) expectNoCoordinates(response);
    await app.close();
    await database.drop();
  });

  beforeEach(() => {
    geocoder.search.mockClear();
    geocoder.reverse.mockClear();
  });

  let ipCounter = 0;

  /** A signed in user with a profile, in the given language. */
  async function user(language: 'pt' | 'en' = 'pt', { withProfile = true } = {}) {
    const oid = crypto.randomUUID();
    const headers = bearer(await sign({ oid }));
    // A distinct address per user, like separate devices.
    const remoteAddress = `10.0.${String(Math.floor(ipCounter / 250))}.${String((ipCounter++ % 250) + 1)}`;
    const send = async (
      method: 'GET' | 'PUT' | 'DELETE' | 'POST',
      url: string,
      payload?: object,
    ) => {
      const response = await app.inject({
        method,
        url,
        headers,
        remoteAddress,
        ...(payload && { payload }),
      });
      responses.push(response);
      return response;
    };
    const client = {
      oid,
      search: (q: string) => send('GET', `/api/places/search?q=${encodeURIComponent(q)}`),
      put: (payload: object) => send('PUT', '/api/me/location', payload),
      remove: () => send('DELETE', '/api/me/location'),
      me: () => send('GET', '/api/me'),
    };
    if (withProfile) {
      const created = await send('POST', '/api/me', {
        username: `u_${oid.slice(0, 8)}`,
        displayName: 'Giovanna',
        language,
        ageConfirmed: true,
      });
      expect(created.statusCode).toBe(201);
    }
    return client;
  }

  async function storedRow(oid: string) {
    const [row] = await database.db
      .select({
        lat: pointLat(users.location),
        lng: pointLng(users.location),
        label: users.locationLabel,
        countryCode: users.locationCountryCode,
      })
      .from(users)
      .where(eq(users.entraOid, oid));
    return row;
  }

  describe('GET /api/places/search', () => {
    it('calls the geocoder on a miss and uses the cache after that', async () => {
      const me = await user('pt');
      const first = await me.search('Vila Franca');
      expect(first.statusCode).toBe(200);
      const body = PlaceSearchResponseSchema.parse(first.json());
      expect(body.places).toEqual([
        {
          id: expect.any(String) as string,
          label: 'Vila Franca de Xira, Lisboa',
          countryCode: 'PT',
        },
      ]);

      // Different spacing and case hit the same cache entry.
      const second = await me.search('  vila   FRANCA ');
      expect(second.json()).toEqual(body);
      expect(geocoder.search).toHaveBeenCalledTimes(1);
    });

    it('answers in the user language and caches each language separately', async () => {
      const pt = await (await user('pt')).search('Londres');
      const en = await (await user('en')).search('Londres');
      expect(PlaceSearchResponseSchema.parse(pt.json()).places[0]?.label).toBe('Londres');
      expect(PlaceSearchResponseSchema.parse(en.json()).places[0]?.label).toBe('London');
      expect(geocoder.search).toHaveBeenCalledTimes(2);
      expect(geocoder.search.mock.calls.map(([, language]) => language)).toEqual(['pt', 'en']);
    });

    it('returns at most 5 places', async () => {
      const me = await user('pt');
      geocoder.search.mockResolvedValueOnce(
        Array.from({ length: 8 }, (_, index) => ({
          label: `Place ${String(index)}`,
          countryCode: 'PT',
          lat: 39 + index / 10,
          lng: -8,
        })),
      );
      const capped = await me.search('Place');
      expect(PlaceSearchResponseSchema.parse(capped.json()).places).toHaveLength(5);
    });

    it('validates the query', async () => {
      const me = await user();
      for (const q of ['Li', '   ', 'x'.repeat(81)]) {
        const response = await me.search(q);
        expect(response.statusCode, q).toBe(400);
        expect(ApiErrorSchema.parse(response.json()).error).toBe('validation');
      }
      expect(geocoder.search).not.toHaveBeenCalled();
    });

    it('answers 502 when the geocoder fails, and does not cache the failure', async () => {
      const me = await user();
      geocoder.search.mockRejectedValueOnce(new GeocoderError('timeout', 'Azure Maps timed out'));
      const failed = await me.search('Coimbra');
      expect(failed.statusCode).toBe(502);
      expect(ApiErrorSchema.parse(failed.json()).error).toBe('geocoder_unavailable');

      const retried = await me.search('Coimbra');
      expect(retried.statusCode).toBe(200);
      expect(geocoder.search).toHaveBeenCalledTimes(2);
    });

    it('needs a profile', async () => {
      const response = await (await user('pt', { withProfile: false })).search('Porto');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/me/location', () => {
    it('copies a searched place to the user', async () => {
      const me = await user('pt');
      const [place] = PlaceSearchResponseSchema.parse((await me.search('Porto')).json()).places;
      if (!place) throw new Error('No place');

      const response = await me.put({ placeId: place.id });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ label: 'Porto', countryCode: 'PT' });
      expect(await storedRow(me.oid)).toEqual({
        lat: 41.15,
        lng: -8.61,
        label: 'Porto',
        countryCode: 'PT',
      });
    });

    it('rounds coordinates before geocoding and storing them', async () => {
      const me = await user('pt');
      const response = await me.put({ lat: 38.955471, lng: -8.987234 });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ label: 'Vila Franca de Xira, Lisboa', countryCode: 'PT' });

      expect(geocoder.reverse).toHaveBeenCalledWith(38.96, -8.99, 'pt');
      expect(await storedRow(me.oid)).toMatchObject({ lat: 38.96, lng: -8.99 });
    });

    it('saves the reverse geocoded place so it can be picked later', async () => {
      const me = await user('en');
      await me.put({ lat: 40.21, lng: -8.43 });
      // The place exists even though no search returned it.
      const rows = await database.db
        .select({ id: places.id })
        .from(places)
        .where(and(eq(places.label, 'Coimbra'), eq(places.language, 'en')));
      expect(rows).toHaveLength(1);
    });

    it('answers 422 when there is no town at that point', async () => {
      const response = await (await user()).put({ lat: 0, lng: -30 });
      expect(response.statusCode).toBe(422);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('no_place_here');
    });

    it('answers 404 for an unknown place', async () => {
      const response = await (await user()).put({ placeId: crypto.randomUUID() });
      expect(response.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('place_not_found');
    });

    it('rejects invalid bodies', async () => {
      const me = await user();
      for (const body of [
        {},
        { lat: 91, lng: 0 },
        { lat: 38.7 },
        { placeId: crypto.randomUUID(), lat: 38.7, lng: -9.1 },
      ]) {
        const response = await me.put(body);
        expect(response.statusCode, JSON.stringify(body)).toBe(400);
      }
      expect(geocoder.reverse).not.toHaveBeenCalled();
    });

    it("only ever changes the caller's own location", async () => {
      const alice = await user('pt');
      const bob = await user('pt');
      await alice.put({ lat: 38.72, lng: -9.14 });

      // Extra fields such as a user id are rejected, not used.
      const sneaky = await bob.put({ lat: 41.15, lng: -8.61, userId: alice.oid });
      expect(sneaky.statusCode).toBe(400);
      await bob.put({ lat: 41.15, lng: -8.61 });

      expect(await storedRow(alice.oid)).toMatchObject({ label: 'Lisboa' });
      expect(await storedRow(bob.oid)).toMatchObject({ label: 'Porto' });
    });

    it('answers 502 when reverse geocoding fails', async () => {
      geocoder.reverse.mockRejectedValueOnce(new GeocoderError('http', 'Azure Maps answered 403'));
      const response = await (await user()).put({ lat: 38.72, lng: -9.14 });
      expect(response.statusCode).toBe(502);
    });
  });

  describe('DELETE /api/me/location', () => {
    it('clears the location', async () => {
      const me = await user();
      await me.put({ lat: 38.72, lng: -9.14 });
      const response = await me.remove();
      expect(response.statusCode).toBe(204);
      expect(await storedRow(me.oid)).toEqual({
        lat: null,
        lng: null,
        label: null,
        countryCode: null,
      });
    });
  });

  describe('GET /api/me', () => {
    it('includes the label only', async () => {
      const me = await user('pt');
      expect(ProfileSchema.parse((await me.me()).json()).location).toBeNull();

      await me.put({ lat: 38.72, lng: -9.14 });
      const profile = ProfileSchema.parse((await me.me()).json());
      expect(profile.location).toEqual({ label: 'Lisboa', countryCode: 'PT' });
    });
  });

  describe('auth and rate limits', () => {
    it('answers 401 without a token', async () => {
      for (const [method, url] of [
        ['GET', '/api/places/search?q=Lisboa'],
        ['PUT', '/api/me/location'],
        ['DELETE', '/api/me/location'],
      ] as const) {
        const response = await app.inject({ method, url, payload: { lat: 1, lng: 1 } });
        responses.push(response);
        expect(response.statusCode, `${method} ${url}`).toBe(401);
      }
    });

    it('limits searches', async () => {
      const me = await user();
      const statuses: number[] = [];
      for (let i = 0; i < 61; i++) statuses.push((await me.search('Faro')).statusCode);
      expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
    });

    it('limits location changes', async () => {
      const me = await user();
      const statuses: number[] = [];
      for (let i = 0; i < 21; i++) statuses.push((await me.remove()).statusCode);
      expect(statuses.at(-1)).toBe(429);
    });
  });
});
