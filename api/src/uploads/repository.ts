import type { CreateUpload } from '@wehobby/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { jobs, uploads, users, type UploadRow } from '../db/schema.js';

/** Job kind the worker runs for each completed upload. */
export const PROCESS_UPLOAD_JOB = 'process_upload';

/**
 * Photo uploads. Every method is keyed by the Entra object id from the
 * verified token and only ever sees that user's uploads: another user's
 * upload looks exactly like one that does not exist.
 */
export function createUploadRepository(db: Database) {
  const ownedBy = (oid: string) =>
    sql`${uploads.userId} = (select ${users.id} from ${users} where ${users.entraOid} = ${oid})`;

  return {
    /** A new pending upload, or 'no_profile' when the user has not signed up yet. */
    async create(oid: string, input: CreateUpload): Promise<UploadRow | 'no_profile'> {
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.entraOid, oid))
        .limit(1);
      if (!user) return 'no_profile';

      const [row] = await db
        .insert(uploads)
        .values({ userId: user.id, contentType: input.contentType, sizeBytes: input.size })
        .returning();
      if (!row) throw new Error('Insert returned no row');
      return row;
    },

    async findOwned(oid: string, id: string): Promise<UploadRow | undefined> {
      const [row] = await db
        .select()
        .from(uploads)
        .where(and(eq(uploads.id, id), ownedBy(oid)))
        .limit(1);
      return row;
    },

    /**
     * Moves a pending upload to processing and queues its job, in one
     * transaction. Returns undefined when the upload is not this user's or is
     * no longer pending, so a repeated call never queues a second job.
     */
    async complete(oid: string, id: string): Promise<UploadRow | undefined> {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(uploads)
          .set({ status: 'processing', completedAt: sql`now()` })
          .where(and(eq(uploads.id, id), eq(uploads.status, 'pending'), ownedBy(oid)))
          .returning();
        if (!row) return undefined;
        await tx.insert(jobs).values({ kind: PROCESS_UPLOAD_JOB, payload: { uploadId: row.id } });
        return row;
      });
    },
  };
}

export type UploadRepository = ReturnType<typeof createUploadRepository>;
