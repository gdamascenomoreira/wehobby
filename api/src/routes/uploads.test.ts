import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ApiErrorSchema,
  CreateUploadResponseSchema,
  MAX_UPLOAD_BYTES,
  UploadSchema,
} from '@wehobby/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { jobs, uploads } from '../db/schema.js';
import { createFakePhotoStorage, type FakePhotoStorage } from '../storage/fake.js';
import { StorageError } from '../storage/storage.js';
import { bearer, createTestTokens } from '../test/auth.js';
import { testConfig } from '../test/config.js';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../test/database.js';
import { PROCESS_UPLOAD_JOB } from '../uploads/repository.js';

const JPEG = Buffer.from('not really a jpeg, the API never reads it');

describe.skipIf(!TEST_DATABASE_URL)('upload routes', () => {
  const config = testConfig();
  let database: TestDatabase;
  let app: FastifyInstance;
  let storage: FakePhotoStorage;
  let directory: string;
  let tokens: Awaited<ReturnType<typeof createTestTokens>>;
  let ipCounter = 0;

  beforeAll(async () => {
    database = await createTestDatabase();
    directory = await mkdtemp(join(tmpdir(), 'wehobby-uploads-'));
    storage = createFakePhotoStorage(directory);
    tokens = await createTestTokens(config);
    app = await buildApp(config, {
      db: database.db,
      getSigningKey: tokens.getSigningKey,
      photoStorage: { kind: 'fake', storage },
    });
  });

  afterAll(async () => {
    await app.close();
    await database.drop();
    await rm(directory, { recursive: true, force: true });
  });

  /** A signed in user, with a profile unless told otherwise. */
  async function user({ withProfile = true } = {}) {
    const oid = crypto.randomUUID();
    const headers = bearer(await tokens.sign({ oid }));
    const remoteAddress = `10.1.${String(Math.floor(ipCounter / 250))}.${String((ipCounter++ % 250) + 1)}`;
    const send = (method: 'GET' | 'POST', url: string, payload?: object) =>
      app.inject({ method, url, headers, remoteAddress, ...(payload && { payload }) });
    if (withProfile) {
      const created = await send('POST', '/api/me', {
        username: `u_${oid.slice(0, 8)}`,
        displayName: 'Tester',
        language: 'en',
        ageConfirmed: true,
      });
      expect(created.statusCode).toBe(201);
    }
    return {
      create: (payload: object = { contentType: 'image/jpeg', size: JPEG.length }) =>
        send('POST', '/api/uploads', payload),
      complete: (id: string) => send('POST', `/api/uploads/${id}/complete`),
      get: (id: string) => send('GET', `/api/uploads/${id}`),
    };
  }

  /** Creates an upload and sends the photo through the dev storage route, like the browser. */
  async function uploaded(me: Awaited<ReturnType<typeof user>>, data = JPEG) {
    const created = CreateUploadResponseSchema.parse(
      (await me.create({ contentType: 'image/jpeg', size: data.length })).json(),
    );
    const put = await app.inject({
      method: 'PUT',
      url: created.uploadUrl,
      headers: created.headers,
      payload: data,
    });
    expect(put.statusCode).toBe(201);
    return created;
  }

  const jobsFor = (uploadId: string) =>
    database.db
      .select()
      .from(jobs)
      .where(eq(jobs.kind, PROCESS_UPLOAD_JOB))
      .then((rows) =>
        rows.filter((row) => (row.payload as { uploadId: string }).uploadId === uploadId),
      );

  describe('POST /api/uploads', () => {
    it('creates a pending upload and returns a write link for its incoming blob', async () => {
      const me = await user();
      const response = await me.create();
      expect(response.statusCode).toBe(201);
      const body = CreateUploadResponseSchema.parse(response.json());
      expect(body.uploadUrl).toBe(`/api/dev-storage/incoming/${body.id}`);
      expect(body.headers).toEqual({ 'content-type': 'image/jpeg' });
      expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());

      const [row] = await database.db.select().from(uploads).where(eq(uploads.id, body.id));
      expect(row).toMatchObject({
        status: 'pending',
        contentType: 'image/jpeg',
        sizeBytes: JPEG.length,
      });
    });

    it('validates the body with the shared schema', async () => {
      const me = await user();
      for (const payload of [
        { contentType: 'image/heic', size: 100 },
        { contentType: 'image/jpeg', size: MAX_UPLOAD_BYTES + 1 },
        { contentType: 'image/jpeg' },
        { contentType: 'image/jpeg', size: 100, userId: crypto.randomUUID() },
      ]) {
        const response = await me.create(payload);
        expect(response.statusCode).toBe(400);
        expect(ApiErrorSchema.parse(response.json()).error).toBe('validation');
      }
    });

    it('needs a signed in user with a profile', async () => {
      const anonymous = await app.inject({
        method: 'POST',
        url: '/api/uploads',
        payload: { contentType: 'image/jpeg', size: 10 },
      });
      expect(anonymous.statusCode).toBe(401);

      const noProfile = await user({ withProfile: false });
      expect((await noProfile.create()).statusCode).toBe(404);
    });

    it('answers 502 when storage cannot sign a link', async () => {
      const failing = await buildApp(config, {
        db: database.db,
        getSigningKey: tokens.getSigningKey,
        photoStorage: {
          kind: 'azure',
          storage: {
            ...storage,
            createUploadUrl: () =>
              Promise.reject(new StorageError('http', 'nope', { status: 403 })),
          },
        },
      });
      const oid = crypto.randomUUID();
      const headers = bearer(await tokens.sign({ oid }));
      const profile = await failing.inject({
        method: 'POST',
        url: '/api/me',
        headers,
        payload: {
          username: `u_${oid.slice(0, 8)}`,
          displayName: 'Tester',
          language: 'en',
          ageConfirmed: true,
        },
      });
      expect(profile.statusCode).toBe(201);
      const response = await failing.inject({
        method: 'POST',
        url: '/api/uploads',
        headers,
        payload: { contentType: 'image/jpeg', size: 10 },
      });
      expect(response.statusCode).toBe(502);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('storage_unavailable');
      expect(response.body).not.toContain('nope');
      await failing.close();
    });
  });

  describe('POST /api/uploads/:id/complete', () => {
    it('queues one processing job once the photo has arrived', async () => {
      const me = await user();
      const { id } = await uploaded(me);

      const response = await me.complete(id);
      expect(response.statusCode).toBe(200);
      expect(UploadSchema.parse(response.json())).toEqual({
        id,
        status: 'processing',
        photo: null,
      });
      expect(await jobsFor(id)).toHaveLength(1);

      // Calling it again is harmless: same state, still one job.
      const again = await me.complete(id);
      expect(again.statusCode).toBe(200);
      expect(UploadSchema.parse(again.json()).status).toBe('processing');
      expect(await jobsFor(id)).toHaveLength(1);
    });

    it('refuses to complete before the photo has arrived', async () => {
      const me = await user();
      const { id } = CreateUploadResponseSchema.parse((await me.create()).json());
      const response = await me.complete(id);
      expect(response.statusCode).toBe(409);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('upload_not_received');
      expect(await jobsFor(id)).toHaveLength(0);
    });

    it('refuses a photo that is not the announced size', async () => {
      const me = await user();
      const created = CreateUploadResponseSchema.parse(
        (await me.create({ contentType: 'image/jpeg', size: 10 })).json(),
      );
      await storage.put(`incoming/${created.id}`, Buffer.alloc(5000));
      const response = await me.complete(created.id);
      expect(response.statusCode).toBe(409);
      expect(ApiErrorSchema.parse(response.json()).error).toBe('upload_size_mismatch');
      expect(await jobsFor(created.id)).toHaveLength(0);
    });

    it("never completes another user's upload", async () => {
      const owner = await user();
      const other = await user();
      const { id } = await uploaded(owner);

      const response = await other.complete(id);
      expect(response.statusCode).toBe(404);
      expect(await jobsFor(id)).toHaveLength(0);
      const [row] = await database.db.select().from(uploads).where(eq(uploads.id, id));
      expect(row?.status).toBe('pending');
    });

    it('answers 404 for an unknown id and 400 for a malformed one', async () => {
      const me = await user();
      expect((await me.complete(crypto.randomUUID())).statusCode).toBe(404);
      expect((await me.complete('not-a-uuid')).statusCode).toBe(400);
    });
  });

  describe('GET /api/uploads/:id', () => {
    it('shows the status, and read links only once the photo is ready', async () => {
      const me = await user();
      const { id } = await uploaded(me);
      await me.complete(id);
      expect(UploadSchema.parse((await me.get(id)).json())).toEqual({
        id,
        status: 'processing',
        photo: null,
      });

      // What the worker will do in the next PR.
      await database.db
        .update(uploads)
        .set({ status: 'ready', width: 1600, height: 1200, readyAt: new Date() })
        .where(eq(uploads.id, id));

      const ready = UploadSchema.parse((await me.get(id)).json());
      expect(ready).toEqual({
        id,
        status: 'ready',
        photo: {
          fullUrl: `/api/dev-storage/processed/${id}/full.webp`,
          thumbUrl: `/api/dev-storage/processed/${id}/thumb.webp`,
          width: 1600,
          height: 1200,
        },
      });
    });

    it("hides another user's upload", async () => {
      const owner = await user();
      const other = await user();
      const { id } = await uploaded(owner);
      const response = await other.get(id);
      expect(response.statusCode).toBe(404);
      expect(response.body).not.toContain('dev-storage');
    });
  });

  describe('dev storage', () => {
    it('stores and serves blobs, and rejects paths outside the photo layout', async () => {
      const me = await user();
      const { id } = await uploaded(me, Buffer.from('hello'));
      expect(await storage.get(`incoming/${id}`)).toEqual(Buffer.from('hello'));

      for (const url of [
        '/api/dev-storage/../secret',
        '/api/dev-storage/incoming/abc',
        '/api/dev-storage/x',
      ]) {
        const response = await app.inject({
          method: 'PUT',
          url,
          headers: { 'content-type': 'image/jpeg' },
          payload: Buffer.from('x'),
        });
        expect(response.statusCode, url).not.toBe(201);
      }
    });

    it('is not registered with real Blob Storage', async () => {
      const azure = await buildApp(config, {
        db: database.db,
        photoStorage: { kind: 'azure', storage },
      });
      const response = await azure.inject({ method: 'GET', url: '/api/dev-storage/incoming/x' });
      expect(response.statusCode).toBe(404);
      expect(response.headers['content-type']).not.toContain('octet-stream');
      await azure.close();
    });
  });
});
