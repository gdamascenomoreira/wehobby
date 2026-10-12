import { z } from 'zod';

/** Most types a user can pick in one hobby. */
export const MAX_TYPES_PER_HOBBY = 20;

/**
 * Hobbies and hobby types are identified by stable slugs owned by the
 * platform (for example `crochet` and `amigurumi`). The web app shows names
 * through i18n keys built from these slugs.
 */
export const HobbySlugSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);

export const HobbyTypeSchema = z.object({ id: HobbySlugSchema });
export type HobbyType = z.infer<typeof HobbyTypeSchema>;

export const HobbySchema = z.object({
  id: HobbySlugSchema,
  types: z.array(HobbyTypeSchema),
});
export type Hobby = z.infer<typeof HobbySchema>;

/** Response body of `GET /api/hobbies`: the active hobbies and their types. */
export const HobbyCatalogSchema = z.object({ hobbies: z.array(HobbySchema) });
export type HobbyCatalog = z.infer<typeof HobbyCatalogSchema>;

/** One hobby the user picked, with the types they picked in it (possibly none). */
export const UserHobbySchema = z.strictObject({
  hobbyId: HobbySlugSchema,
  typeIds: z
    .array(HobbySlugSchema)
    .max(MAX_TYPES_PER_HOBBY)
    .refine((ids) => new Set(ids).size === ids.length, { error: 'Types must not repeat' }),
});
export type UserHobby = z.infer<typeof UserHobbySchema>;

/**
 * Body of `PUT /api/me/hobbies`: replaces all of the user's hobbies. At least
 * one hobby, because every feed and post belongs to a hobby. Whether the ids
 * exist (and each type belongs to its hobby) is checked by the API.
 */
export const SetUserHobbiesSchema = z.strictObject({
  hobbies: z
    .array(UserHobbySchema)
    .min(1)
    .max(50)
    .refine((hobbies) => new Set(hobbies.map((hobby) => hobby.hobbyId)).size === hobbies.length, {
      error: 'Hobbies must not repeat',
    }),
});
export type SetUserHobbies = z.infer<typeof SetUserHobbiesSchema>;
