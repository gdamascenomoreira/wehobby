import { ApiErrorSchema, HobbyCatalogSchema, ProfileSchema } from '@wehobby/shared';
import { sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { bearer, createTestTokens } from '../test/auth.js';
import { testConfig } from '../test/config.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../test/database.js';

describe.skipIf(!TEST_DATABASE_URL)('hobby routes', () => {
  const config = testConfig();
  let database: TestDatabase;
  let app: FastifyInstance;
  let sign: Awaited<ReturnType<typeof createTestTokens>>['sign'];

  beforeAll(async () => {
    database = await createTestDatabase();
    const tokens = await createTestTokens(config);
    sign = tokens.sign;
    app = await buildApp(config, { db: database.db, getSigningKey: tokens.getSigningKey });
  });

  afterAll(async () => {
    await app.close();
    await database.drop();
  });

  /** A signed in user, with a profile when a username is given. */
  async function user(username?: string) {
    const headers = bearer(await sign({ oid: crypto.randomUUID() }));
    const client = {
      get: (url: string) => app.inject({ method: 'GET', url, headers }),
      put: (url: string, payload: object) => app.inject({ method: 'PUT', url, headers, payload }),
    };
    if (username) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/me',
        headers,
        payload: { username, displayName: username, language: 'en', ageConfirmed: true },
      });
      expect(created.statusCode).toBe(201);
    }
    return client;
  }

  describe('GET /api/hobbies', () => {
    it('lists the launch hobbies and their types without signing in', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/hobbies' });

      expect(response.statusCode).toBe(200);
      const { hobbies } = HobbyCatalogSchema.parse(response.json());
      expect(hobbies.map((hobby) => hobby.id)).toEqual(['crochet', 'plants', 'photography']);
      expect(hobbies[0]?.types.map((type) => type.id)).toEqual([
        'amigurumi',
        'tapestry',
        'granny_squares',
        'garments',
        'accessories',
      ]);
    });
  });

  describe('PUT /api/me/hobbies', () => {
    it('needs a valid token', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/me/hobbies',
        payload: { hobbies: [{ hobbyId: 'crochet', typeIds: [] }] },
      });

      expect(response.statusCode).toBe(401);
    });

    it('needs a profile', async () => {
      const response = await (
        await user()
      ).put('/api/me/hobbies', { hobbies: [{ hobbyId: 'crochet', typeIds: [] }] });

      expect(response.statusCode).toBe(404);
    });

    it('starts empty, saves the hobbies, then replaces them', async () => {
      const ana = await user('ana_hobbies');
      expect(ProfileSchema.parse((await ana.get('/api/me')).json()).hobbies).toEqual([]);

      const first = await ana.put('/api/me/hobbies', {
        hobbies: [
          { hobbyId: 'photography', typeIds: ['film'] },
          { hobbyId: 'crochet', typeIds: ['tapestry', 'amigurumi'] },
        ],
      });
      expect(first.statusCode).toBe(200);
      // Sorted like the catalog, types alphabetically.
      expect(ProfileSchema.parse(first.json()).hobbies).toEqual([
        { hobbyId: 'crochet', typeIds: ['amigurumi', 'tapestry'] },
        { hobbyId: 'photography', typeIds: ['film'] },
      ]);

      const second = await ana.put('/api/me/hobbies', {
        hobbies: [{ hobbyId: 'plants', typeIds: [] }],
      });
      expect(ProfileSchema.parse(second.json()).hobbies).toEqual([
        { hobbyId: 'plants', typeIds: [] },
      ]);
      expect(ProfileSchema.parse((await ana.get('/api/me')).json()).hobbies).toEqual([
        { hobbyId: 'plants', typeIds: [] },
      ]);
    });

    it('only changes the hobbies of the signed in user', async () => {
      const bruno = await user('bruno_hobbies');
      const carla = await user('carla_hobbies');
      await bruno.put('/api/me/hobbies', { hobbies: [{ hobbyId: 'crochet', typeIds: [] }] });
      await carla.put('/api/me/hobbies', { hobbies: [{ hobbyId: 'plants', typeIds: [] }] });

      expect(ProfileSchema.parse((await bruno.get('/api/me')).json()).hobbies).toEqual([
        { hobbyId: 'crochet', typeIds: [] },
      ]);
    });

    it.each([
      ['no hobbies', { hobbies: [] }],
      ['an unknown hobby', { hobbies: [{ hobbyId: 'skydiving', typeIds: [] }] }],
      ['a type from another hobby', { hobbies: [{ hobbyId: 'crochet', typeIds: ['bonsai'] }] }],
      ['an unknown type', { hobbies: [{ hobbyId: 'plants', typeIds: ['cacti_2000'] }] }],
    ])('rejects %s and keeps the saved hobbies', async (_case, payload) => {
      const dora = await user(`dora_${crypto.randomUUID().slice(0, 8)}`);
      await dora.put('/api/me/hobbies', { hobbies: [{ hobbyId: 'crochet', typeIds: [] }] });

      const response = await dora.put('/api/me/hobbies', payload);

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('validation');
      expect(ProfileSchema.parse((await dora.get('/api/me')).json()).hobbies).toEqual([
        { hobbyId: 'crochet', typeIds: [] },
      ]);
    });

    it('rejects inactive hobbies and hides them from the catalog', async () => {
      await database.db.execute(sql`UPDATE hobbies SET active = false WHERE id = 'photography'`);
      try {
        const eva = await user('eva_hobbies');
        const response = await eva.put('/api/me/hobbies', {
          hobbies: [{ hobbyId: 'photography', typeIds: [] }],
        });
        expect(response.statusCode).toBe(400);

        const catalog = HobbyCatalogSchema.parse(
          (await app.inject({ method: 'GET', url: '/api/hobbies' })).json(),
        );
        expect(catalog.hobbies.map((hobby) => hobby.id)).not.toContain('photography');
      } finally {
        await database.db.execute(sql`UPDATE hobbies SET active = true WHERE id = 'photography'`);
      }
    });
  });
});
