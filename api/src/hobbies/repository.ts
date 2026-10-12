import type { Hobby, SetUserHobbies, UserHobby } from '@wehobby/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { hobbies, hobbyTypes, userHobbies, userHobbyTypes } from '../db/schema.js';

/** The user picked a hobby or type that does not exist or is no longer active. */
export class UnknownHobbyError extends Error {}

/**
 * Data access for the hobby catalog and the hobbies each user picked. Writes
 * take the internal user id, which callers resolve from the verified token.
 */
export function createHobbyRepository(db: Database) {
  async function catalog(): Promise<Hobby[]> {
    const rows = await db
      .select({ hobbyId: hobbies.id, typeId: hobbyTypes.id, typeActive: hobbyTypes.active })
      .from(hobbies)
      .leftJoin(hobbyTypes, eq(hobbyTypes.hobbyId, hobbies.id))
      .where(eq(hobbies.active, true))
      .orderBy(asc(hobbies.sortOrder), asc(hobbyTypes.sortOrder));

    const byId = new Map<string, Hobby>();
    for (const row of rows) {
      let hobby = byId.get(row.hobbyId);
      if (!hobby) {
        hobby = { id: row.hobbyId, types: [] };
        byId.set(row.hobbyId, hobby);
      }
      if (row.typeId && row.typeActive) hobby.types.push({ id: row.typeId });
    }
    return [...byId.values()];
  }

  async function forUser(userId: string): Promise<UserHobby[]> {
    const rows = await db
      .select({ hobbyId: userHobbies.hobbyId, typeId: userHobbyTypes.typeId })
      .from(userHobbies)
      .innerJoin(hobbies, eq(hobbies.id, userHobbies.hobbyId))
      .leftJoin(
        userHobbyTypes,
        and(
          eq(userHobbyTypes.userId, userHobbies.userId),
          eq(userHobbyTypes.hobbyId, userHobbies.hobbyId),
        ),
      )
      .where(eq(userHobbies.userId, userId))
      .orderBy(asc(hobbies.sortOrder), asc(userHobbyTypes.typeId));

    const byId = new Map<string, UserHobby>();
    for (const row of rows) {
      let hobby = byId.get(row.hobbyId);
      if (!hobby) {
        hobby = { hobbyId: row.hobbyId, typeIds: [] };
        byId.set(row.hobbyId, hobby);
      }
      if (row.typeId) hobby.typeIds.push(row.typeId);
    }
    return [...byId.values()];
  }

  return {
    catalog,
    forUser,

    /** Replaces all of the user's hobbies in one transaction. */
    async setForUser(userId: string, input: SetUserHobbies): Promise<UserHobby[]> {
      // Only active hobbies and types can be picked.
      const available = new Map(
        (await catalog()).map((hobby) => [hobby.id, new Set(hobby.types.map((type) => type.id))]),
      );
      for (const { hobbyId, typeIds } of input.hobbies) {
        const types = available.get(hobbyId);
        if (!types) throw new UnknownHobbyError(`Unknown hobby: ${hobbyId}`);
        const unknown = typeIds.find((typeId) => !types.has(typeId));
        if (unknown) throw new UnknownHobbyError(`Unknown type for ${hobbyId}: ${unknown}`);
      }

      await db.transaction(async (tx) => {
        // Cascades to user_hobby_types.
        await tx.delete(userHobbies).where(eq(userHobbies.userId, userId));
        await tx
          .insert(userHobbies)
          .values(input.hobbies.map(({ hobbyId }) => ({ userId, hobbyId })));
        const types = input.hobbies.flatMap(({ hobbyId, typeIds }) =>
          typeIds.map((typeId) => ({ userId, hobbyId, typeId })),
        );
        if (types.length > 0) await tx.insert(userHobbyTypes).values(types);
      });
      return forUser(userId);
    },
  };
}

export type HobbyRepository = ReturnType<typeof createHobbyRepository>;
