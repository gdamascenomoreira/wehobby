import type { CreateProfile, Profile, UpdateProfile } from '@wehobby/shared';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { users, type UserRow } from '../db/schema.js';

export class ProfileExistsError extends Error {}
export class UsernameTakenError extends Error {}

const UNIQUE_VIOLATION = '23505';

function uniqueConstraintOf(error: unknown): string | undefined {
  // Drizzle wraps driver errors; the pg error is the cause.
  const candidate = error instanceof Error && error.cause ? error.cause : error;
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'code' in candidate &&
    candidate.code === UNIQUE_VIOLATION &&
    'constraint' in candidate &&
    typeof candidate.constraint === 'string'
  ) {
    return candidate.constraint;
  }
  return undefined;
}

export function toProfile(row: UserRow): Profile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    bio: row.bio,
    language: row.language,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Data access for users. Every method that reads or changes a profile is keyed
 * by the Entra object id from the verified token, so a user can only ever
 * reach their own row.
 */
export function createUserRepository(db: Database) {
  return {
    async findByOid(oid: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(eq(users.entraOid, oid)).limit(1);
      return row;
    },

    async create(oid: string, input: CreateProfile): Promise<UserRow> {
      try {
        const [row] = await db
          .insert(users)
          .values({
            entraOid: oid,
            username: input.username,
            displayName: input.displayName,
            bio: input.bio ?? '',
            language: input.language,
            ageConfirmedAt: new Date(),
          })
          .returning();
        if (!row) throw new Error('Insert returned no row');
        return row;
      } catch (error) {
        const constraint = uniqueConstraintOf(error);
        if (constraint === 'users_entra_oid_unique') throw new ProfileExistsError();
        if (constraint === 'users_username_unique') throw new UsernameTakenError();
        throw error;
      }
    },

    async update(oid: string, patch: UpdateProfile): Promise<UserRow | undefined> {
      const [row] = await db
        .update(users)
        .set({ ...patch, updatedAt: sql`now()` })
        .where(eq(users.entraOid, oid))
        .returning();
      return row;
    },

    async isUsernameTaken(username: string): Promise<boolean> {
      const [row] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return row !== undefined;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
