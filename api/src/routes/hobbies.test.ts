import { readFile } from 'node:fs/promises';
import { ApiErrorSchema, HobbiesResponseSchema, MyHobbiesSchema } from '@wehobby/shared';
import { count, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { hobbies, hobbyTypes, typeSuggestions, users } from '../db/schema.js';
import { bearer, createTestTokens } from '../test/auth.js';
import { testConfig } from '../test/config.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../test/database.js';

const MIGRATION = new URL('../../drizzle/0001_hobbies.sql', import.meta.url);

describe.skipIf(!TEST_DATABASE_URL)('hobby routes', () => {
  const config = testConfig();
  let database: TestDatabase;
  let app: FastifyInstance;
  let sign: Awaited<ReturnType<typeof createTestTokens>>['sign'];
  let seeded: { hobbies: number; types: number };

  async function countRows() {
    const [hobbyCount] = await database.db.select({ n: count() }).from(hobbies);
    const [typeCount] = await database.db.select({ n: count() }).from(hobbyTypes);
    return { hobbies: hobbyCount?.n ?? 0, types: typeCount?.n ?? 0 };
  }

  beforeAll(async () => {
    database = await createTestDatabase();
    seeded = await countRows();
    // Retired rows, to check that only active ones can be picked.
    await database.db.insert(hobbies).values({ id: 'knitting', active: false, sortOrder: 99 });
    await database.db
      .insert(hobbyTypes)
      .values({ hobbyId: 'crochet', id: 'retired_type', active: false, sortOrder: 99 });
    const tokens = await createTestTokens(config);
    sign = tokens.sign;
    app = await buildApp(config, { db: database.db, getSigningKey: tokens.getSigningKey });
  });

  afterAll(async () => {
    await app.close();
    await database.drop();
  });

  /** A signed in user with their own token, optionally already onboarded. */
  async function user({ withProfile = true } = {}) {
    const oid = crypto.randomUUID();
    const headers = bearer(await sign({ oid }));
    const client = {
      oid,
      get: (url: string) => app.inject({ method: 'GET', url, headers }),
      put: (url: string, payload: object) => app.inject({ method: 'PUT', url, headers, payload }),
      post: (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload }),
    };
    if (withProfile) {
      const created = await client.post('/api/me', {
        username: `u_${oid.slice(0, 8)}`,
        displayName: 'Giovanna',
        language: 'pt',
        ageConfirmed: true,
      });
      expect(created.statusCode).toBe(201);
    }
    return client;
  }

  const select = (...hobbies: [string, string[]][]) => ({
    hobbies: hobbies.map(([hobbyId, typeIds]) => ({ hobbyId, typeIds })),
  });

  describe('migration', () => {
    it('seeds exactly the 3 official hobbies with 7 types each', () => {
      expect(seeded).toEqual({ hobbies: 3, types: 21 });
    });

    it('can run the seed again without changing anything', async () => {
      const migration = await readFile(MIGRATION, 'utf8');
      const seed = migration.slice(migration.indexOf('-- Seed'));
      const before = await countRows();

      for (const statement of seed.split('--> statement-breakpoint')) {
        await database.db.execute(sql.raw(statement));
      }

      expect(await countRows()).toEqual(before);
    });
  });

  describe('authentication', () => {
    it.each([
      ['GET', '/api/hobbies'],
      ['GET', '/api/me/hobbies'],
      ['PUT', '/api/me/hobbies'],
      ['POST', '/api/hobby-types/suggestions'],
    ] as const)('%s %s needs a valid token', async (method, url) => {
      const anonymous = await app.inject({ method, url, payload: {} });
      const forged = await app.inject({
        method,
        url,
        payload: {},
        headers: bearer(await sign({ foreignKey: true })),
      });

      for (const response of [anonymous, forged]) {
        expect(response.statusCode).toBe(401);
        expect(ApiErrorSchema.parse(response.json()).error).toBe('unauthorized');
      }
    });
  });

  describe('GET /api/hobbies', () => {
    it('lists the active hobbies and types in order', async () => {
      const response = await (await user({ withProfile: false })).get('/api/hobbies');

      expect(response.statusCode).toBe(200);
      const { hobbies: list } = HobbiesResponseSchema.parse(response.json());
      expect(list.map((hobby) => hobby.id)).toEqual(['crochet', 'plants', 'photography']);
      const crochet = list[0]?.types.map((type) => type.id);
      expect(crochet?.slice(0, 2)).toEqual(['amigurumi', 'granny_squares']);
      expect(crochet).not.toContain('retired_type');
    });
  });

  describe('selection', () => {
    it('starts empty, then saves and returns the selection', async () => {
      const giovanna = await user();

      const empty = await giovanna.get('/api/me/hobbies');
      expect(empty.statusCode).toBe(200);
      expect(empty.json()).toEqual({ hobbies: [] });

      const saved = await giovanna.put(
        '/api/me/hobbies',
        select(['crochet', ['tapestry', 'amigurumi']], ['plants', []]),
      );
      expect(saved.statusCode).toBe(200);
      // Returned in catalog order, whatever order the client sent.
      const expected = select(['crochet', ['amigurumi', 'tapestry']], ['plants', []]);
      expect(MyHobbiesSchema.parse(saved.json())).toEqual(expected);
      expect((await giovanna.get('/api/me/hobbies')).json()).toEqual(expected);
    });

    it('replaces the selection instead of adding to it', async () => {
      const giovanna = await user();
      await giovanna.put('/api/me/hobbies', select(['crochet', ['amigurumi']], ['plants', []]));

      await giovanna.put('/api/me/hobbies', select(['photography', ['film']]));

      expect((await giovanna.get('/api/me/hobbies')).json()).toEqual(
        select(['photography', ['film']]),
      );
    });

    it.each([
      ['an unknown hobby', select(['knitting_unknown', []]), 'invalid_hobby'],
      ['an inactive hobby', select(['knitting', []]), 'invalid_hobby'],
      ['a type from another hobby', select(['crochet', ['bonsai']]), 'invalid_type'],
      ['an inactive type', select(['crochet', ['retired_type']]), 'invalid_type'],
    ])('rejects %s and keeps the old selection', async (_case, payload, code) => {
      const giovanna = await user();
      await giovanna.put('/api/me/hobbies', select(['crochet', []]));

      const response = await giovanna.put('/api/me/hobbies', payload);

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error).toBe(code);
      expect((await giovanna.get('/api/me/hobbies')).json()).toEqual(select(['crochet', []]));
    });

    it('rejects an empty selection', async () => {
      const response = await (await user()).put('/api/me/hobbies', { hobbies: [] });

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('validation');
    });

    it('needs a profile', async () => {
      const newcomer = await user({ withProfile: false });

      expect((await newcomer.get('/api/me/hobbies')).statusCode).toBe(404);
      expect((await newcomer.put('/api/me/hobbies', select(['crochet', []]))).statusCode).toBe(404);
    });

    it("never touches another user's selection", async () => {
      const giovanna = await user();
      const beatriz = await user();
      await giovanna.put('/api/me/hobbies', select(['crochet', ['amigurumi']]));
      await beatriz.put('/api/me/hobbies', select(['plants', ['orchids']]));

      await beatriz.put('/api/me/hobbies', select(['photography', []]));

      expect((await giovanna.get('/api/me/hobbies')).json()).toEqual(
        select(['crochet', ['amigurumi']]),
      );
    });

    it('is deleted with the user', async () => {
      const giovanna = await user();
      await giovanna.put('/api/me/hobbies', select(['crochet', ['amigurumi']]));

      await database.db.delete(users).where(eq(users.entraOid, giovanna.oid));

      const rows = await database.db.execute(
        sql`select count(*)::int as n from user_hobbies uh left join users u on u.id = uh.user_id where u.id is null`,
      );
      expect(rows.rows[0]).toEqual({ n: 0 });
    });
  });

  describe('type suggestions', () => {
    async function suggestionsOf(oid: string) {
      return database.db
        .select({ name: typeSuggestions.name, status: typeSuggestions.status })
        .from(typeSuggestions)
        .innerJoin(users, eq(users.id, typeSuggestions.userId))
        .where(eq(users.entraOid, oid));
    }

    it('stores a pending suggestion', async () => {
      const giovanna = await user();

      const response = await giovanna.post('/api/hobby-types/suggestions', {
        hobbyId: 'crochet',
        name: '  Tunisian crochet ',
      });

      expect(response.statusCode).toBe(202);
      expect(await suggestionsOf(giovanna.oid)).toEqual([
        { name: 'Tunisian crochet', status: 'pending' },
      ]);
    });

    it('ignores a duplicate pending suggestion, in any case', async () => {
      const giovanna = await user();
      const body = { hobbyId: 'crochet', name: 'Tunisian' };

      await giovanna.post('/api/hobby-types/suggestions', body);
      const again = await giovanna.post('/api/hobby-types/suggestions', {
        ...body,
        name: 'tunisian',
      });

      expect(again.statusCode).toBe(202);
      expect(await suggestionsOf(giovanna.oid)).toHaveLength(1);
    });

    it.each([
      ['an inactive hobby', { hobbyId: 'knitting', name: 'Lace' }, 'invalid_hobby'],
      ['a name that is too long', { hobbyId: 'crochet', name: 'x'.repeat(41) }, 'validation'],
    ])('rejects %s', async (_case, payload, code) => {
      const response = await (await user()).post('/api/hobby-types/suggestions', payload);

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error).toBe(code);
    });

    it('allows 5 suggestions per hour', async () => {
      const giovanna = await user();
      const statuses: number[] = [];
      for (let i = 1; i <= 6; i++) {
        const response = await giovanna.post('/api/hobby-types/suggestions', {
          hobbyId: 'plants',
          name: `Idea ${String(i)}`,
        });
        statuses.push(response.statusCode);
      }

      expect(statuses).toEqual([202, 202, 202, 202, 202, 429]);
      // Other users keep their own limit.
      const other = await user();
      const response = await other.post('/api/hobby-types/suggestions', {
        hobbyId: 'plants',
        name: 'Idea',
      });
      expect(response.statusCode).toBe(202);
    });
  });
});
