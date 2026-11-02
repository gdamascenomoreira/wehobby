import type { Hobby, MyHobby, TypeSuggestion, UpdateMyHobbies } from '@wehobby/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import {
  hobbies,
  hobbyTypes,
  typeSuggestions,
  userHobbies,
  userHobbyTypes,
  users,
} from '../db/schema.js';

export type ReplaceSelectionResult =
  | { ok: true; hobbies: MyHobby[] }
  | { ok: false; reason: 'no_profile' | 'invalid_hobby' | 'invalid_type'; id?: string };

export type SuggestTypeResult = 'stored' | 'no_profile' | 'invalid_hobby';

type Reader = Pick<Database, 'select'>;

/** Active hobbies with their active types, in display order. */
async function activeHobbies(db: Reader): Promise<Hobby[]> {
  const rows = await db
    .select({ hobbyId: hobbies.id, typeId: hobbyTypes.id })
    .from(hobbies)
    .leftJoin(hobbyTypes, and(eq(hobbyTypes.hobbyId, hobbies.id), eq(hobbyTypes.active, true)))
    .where(eq(hobbies.active, true))
    .orderBy(asc(hobbies.sortOrder), asc(hobbyTypes.sortOrder));

  const byId = new Map<string, Hobby>();
  for (const row of rows) {
    let hobby = byId.get(row.hobbyId);
    if (!hobby) {
      hobby = { id: row.hobbyId, types: [] };
      byId.set(row.hobbyId, hobby);
    }
    if (row.typeId) hobby.types.push({ id: row.typeId });
  }
  return [...byId.values()];
}

/**
 * The user's selection, limited to hobbies and types that are still active,
 * in display order. A retired type disappears here and the next save drops it.
 */
async function selectionOf(db: Reader, userId: string): Promise<MyHobby[]> {
  const catalog = await activeHobbies(db);
  const picked = await db
    .select({ hobbyId: userHobbies.hobbyId })
    .from(userHobbies)
    .where(eq(userHobbies.userId, userId));
  const pickedTypes = await db
    .select({ hobbyId: userHobbyTypes.hobbyId, typeId: userHobbyTypes.typeId })
    .from(userHobbyTypes)
    .where(eq(userHobbyTypes.userId, userId));

  const pickedHobbies = new Set(picked.map((row) => row.hobbyId));
  const pickedTypeKeys = new Set(pickedTypes.map((row) => `${row.hobbyId}/${row.typeId}`));
  return catalog
    .filter((hobby) => pickedHobbies.has(hobby.id))
    .map((hobby) => ({
      hobbyId: hobby.id,
      typeIds: hobby.types
        .map((type) => type.id)
        .filter((typeId) => pickedTypeKeys.has(`${hobby.id}/${typeId}`)),
    }));
}

/**
 * Data access for hobbies. Everything that touches a user's selection is keyed
 * by the Entra object id from the verified token, as in the user repository,
 * so a user can only ever reach their own rows.
 */
export function createHobbyRepository(db: Database) {
  async function userIdOf(reader: Reader, oid: string): Promise<string | undefined> {
    const [row] = await reader
      .select({ id: users.id })
      .from(users)
      .where(eq(users.entraOid, oid))
      .limit(1);
    return row?.id;
  }

  return {
    listActive: () => activeHobbies(db),

    /** Undefined when the user has no profile yet. */
    async findSelection(oid: string): Promise<MyHobby[] | undefined> {
      const userId = await userIdOf(db, oid);
      return userId ? selectionOf(db, userId) : undefined;
    },

    /** Replaces the whole selection in one transaction, after checking it against active rows. */
    async replaceSelection(oid: string, input: UpdateMyHobbies): Promise<ReplaceSelectionResult> {
      return db.transaction(async (tx) => {
        // Locking the user row serializes concurrent saves from the same account.
        const [user] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.entraOid, oid))
          .for('update');
        if (!user) return { ok: false, reason: 'no_profile' };

        const catalog = new Map(
          (await activeHobbies(tx)).map((hobby) => [
            hobby.id,
            new Set(hobby.types.map((type) => type.id)),
          ]),
        );
        for (const { hobbyId, typeIds } of input.hobbies) {
          const types = catalog.get(hobbyId);
          if (!types) return { ok: false, reason: 'invalid_hobby', id: hobbyId };
          const invalid = typeIds.find((typeId) => !types.has(typeId));
          if (invalid) return { ok: false, reason: 'invalid_type', id: invalid };
        }

        // Deleting the hobbies cascades to their types.
        await tx.delete(userHobbies).where(eq(userHobbies.userId, user.id));
        await tx
          .insert(userHobbies)
          .values(input.hobbies.map(({ hobbyId }) => ({ userId: user.id, hobbyId })));
        const typeRows = input.hobbies.flatMap(({ hobbyId, typeIds }) =>
          typeIds.map((typeId) => ({ userId: user.id, hobbyId, typeId })),
        );
        if (typeRows.length > 0) {
          await tx.insert(userHobbyTypes).values(typeRows);
        }

        return { ok: true, hobbies: await selectionOf(tx, user.id) };
      });
    },

    /** Stores a pending suggestion. An identical pending one from the same user is ignored. */
    async suggestType(oid: string, input: TypeSuggestion): Promise<SuggestTypeResult> {
      const userId = await userIdOf(db, oid);
      if (!userId) return 'no_profile';
      const [hobby] = await db
        .select({ id: hobbies.id })
        .from(hobbies)
        .where(and(eq(hobbies.id, input.hobbyId), eq(hobbies.active, true)))
        .limit(1);
      if (!hobby) return 'invalid_hobby';

      // The partial unique index on pending suggestions turns a duplicate into a no-op.
      await db
        .insert(typeSuggestions)
        .values({ userId, hobbyId: input.hobbyId, name: input.name })
        .onConflictDoNothing();
      return 'stored';
    },
  };
}

export type HobbyRepository = ReturnType<typeof createHobbyRepository>;
