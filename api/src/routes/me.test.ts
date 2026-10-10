import { ApiErrorSchema, ProfileSchema, UsernameAvailabilitySchema } from '@wehobby/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { bearer, createTestTokens } from '../test/auth.js';
import { testConfig } from '../test/config.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../test/database.js';

const newProfile = (username: string) => ({
  username,
  displayName: 'Giovanna',
  language: 'pt',
  ageConfirmed: true,
});

describe.skipIf(!TEST_DATABASE_URL)('profile routes', () => {
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

  /** A signed in user with their own token. */
  async function user() {
    const headers = bearer(await sign({ oid: crypto.randomUUID() }));
    return {
      get: (url: string) => app.inject({ method: 'GET', url, headers }),
      post: (url: string, payload: object) => app.inject({ method: 'POST', url, headers, payload }),
      patch: (url: string, payload: object) =>
        app.inject({ method: 'PATCH', url, headers, payload }),
    };
  }

  describe('authentication', () => {
    it.each([
      ['GET', '/api/me'],
      ['POST', '/api/me'],
      ['PATCH', '/api/me'],
      ['GET', '/api/usernames/someone'],
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

  describe('onboarding', () => {
    it('has no profile before onboarding', async () => {
      const response = await (await user()).get('/api/me');

      expect(response.statusCode).toBe(404);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('not_found');
    });

    it('creates the profile, then returns it', async () => {
      const giovanna = await user();

      const created = await giovanna.post('/api/me', newProfile('  Giovanna_Crochet '));
      expect(created.statusCode).toBe(201);
      const profile = ProfileSchema.parse(created.json());
      expect(profile).toMatchObject({
        username: 'giovanna_crochet',
        displayName: 'Giovanna',
        bio: '',
        language: 'pt',
      });

      const fetched = await giovanna.get('/api/me');
      expect(fetched.statusCode).toBe(200);
      expect(fetched.json()).toEqual(profile);
    });

    it('creates only one profile per account', async () => {
      const giovanna = await user();
      await giovanna.post('/api/me', newProfile('only_once'));

      const second = await giovanna.post('/api/me', newProfile('only_twice'));

      expect(second.statusCode).toBe(409);
      expect(ApiErrorSchema.parse(second.json()).error).toBe('profile_exists');
    });

    it('rejects a username another user already has, in any case', async () => {
      await (await user()).post('/api/me', newProfile('beatriz_plants'));

      const response = await (await user()).post('/api/me', newProfile('Beatriz_Plants'));

      expect(response.statusCode).toBe(409);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('username_taken');
    });

    it.each([
      ['without the 16+ confirmation', { ...newProfile('too_young'), ageConfirmed: false }],
      ['with an invalid username', newProfile('no spaces')],
      ['with fields the client may not set', { ...newProfile('sneaky'), id: crypto.randomUUID() }],
    ])('rejects a profile %s', async (_case, payload) => {
      const response = await (await user()).post('/api/me', payload);

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('validation');
    });

    it('rejects a body that is not JSON', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/me',
        headers: { ...bearer(await sign()), 'content-type': 'application/json' },
        payload: '{not json',
      });

      expect(response.statusCode).toBe(400);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('validation');
    });
  });

  describe('editing', () => {
    it('updates only the signed in user’s own profile', async () => {
      const giovanna = await user();
      const beatriz = await user();
      await giovanna.post('/api/me', newProfile('giovanna_edit'));
      await beatriz.post('/api/me', newProfile('beatriz_edit'));

      const response = await beatriz.patch('/api/me', { bio: 'Succulents', language: 'en' });

      expect(response.statusCode).toBe(200);
      expect(ProfileSchema.parse(response.json())).toMatchObject({
        username: 'beatriz_edit',
        bio: 'Succulents',
        language: 'en',
      });
      expect(ProfileSchema.parse((await giovanna.get('/api/me')).json())).toMatchObject({
        username: 'giovanna_edit',
        bio: '',
        language: 'pt',
      });
    });

    it('does not let a user change their username', async () => {
      const giovanna = await user();
      await giovanna.post('/api/me', newProfile('fixed_name'));

      const response = await giovanna.patch('/api/me', { username: 'new_name' });

      expect(response.statusCode).toBe(400);
    });

    it('answers 404 when the user has no profile yet', async () => {
      const response = await (await user()).patch('/api/me', { bio: 'Hello' });

      expect(response.statusCode).toBe(404);
    });

    it('rate limits writes per user', async () => {
      const giovanna = await user();
      await giovanna.post('/api/me', newProfile('busy_writer'));

      const statuses: number[] = [];
      for (let i = 0; i < 25; i++) {
        statuses.push((await giovanna.patch('/api/me', { bio: `Edit ${i}` })).statusCode);
      }

      expect(statuses).toContain(429);
      // Another user is not affected.
      const other = await user();
      expect((await other.patch('/api/me', { bio: 'Hi' })).statusCode).toBe(404);
    });
  });

  describe('GET /api/usernames/:username', () => {
    it('reports whether a username is free', async () => {
      const giovanna = await user();
      await giovanna.post('/api/me', newProfile('taken_name'));

      const taken = await giovanna.get('/api/usernames/Taken_Name');
      const free = await giovanna.get('/api/usernames/free_name');

      expect(UsernameAvailabilitySchema.parse(taken.json())).toEqual({
        username: 'taken_name',
        available: false,
      });
      expect(UsernameAvailabilitySchema.parse(free.json())).toEqual({
        username: 'free_name',
        available: true,
      });
    });

    it('rejects an invalid or reserved username', async () => {
      const giovanna = await user();

      expect((await giovanna.get('/api/usernames/ab')).statusCode).toBe(400);
      expect((await giovanna.get('/api/usernames/admin')).statusCode).toBe(400);
    });
  });
});
