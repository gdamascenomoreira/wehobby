import { z } from 'zod';

/**
 * Hobby and type ids are stable lowercase slugs, for example `crochet` or
 * `granny_squares`. They double as i18n keys, so names never live in the database.
 */
export const SlugSchema = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/, { error: 'Invalid id' });

/** Upper bound on hobbies in one selection; the platform has far fewer. */
export const MAX_HOBBIES = 10;
/** Upper bound on types per hobby in one selection. */
export const MAX_TYPES_PER_HOBBY = 50;

export const TYPE_SUGGESTION_NAME_MIN_LENGTH = 2;
export const TYPE_SUGGESTION_NAME_MAX_LENGTH = 40;

/** One active hobby with its active types, in display order. */
export const HobbySchema = z.object({
  id: SlugSchema,
  types: z.array(z.object({ id: SlugSchema })),
});
export type Hobby = z.infer<typeof HobbySchema>;

/** Response body of `GET /api/hobbies`. */
export const HobbiesResponseSchema = z.object({ hobbies: z.array(HobbySchema) });
export type HobbiesResponse = z.infer<typeof HobbiesResponseSchema>;

const hasNoDuplicates = (values: readonly string[]) => new Set(values).size === values.length;

/** One hobby the user picked, with the types they picked inside it (can be empty). */
export const MyHobbySchema = z.strictObject({
  hobbyId: SlugSchema,
  typeIds: z
    .array(SlugSchema)
    .max(MAX_TYPES_PER_HOBBY)
    .refine(hasNoDuplicates, { error: 'Each type can be picked only once' }),
});
export type MyHobby = z.infer<typeof MyHobbySchema>;

/** Response body of `GET /api/me/hobbies` and `PUT /api/me/hobbies`. */
export const MyHobbiesSchema = z.object({ hobbies: z.array(MyHobbySchema) });
export type MyHobbies = z.infer<typeof MyHobbiesSchema>;

/** Body of `PUT /api/me/hobbies`: replaces the whole selection. */
export const UpdateMyHobbiesSchema = z.strictObject({
  hobbies: z
    .array(MyHobbySchema)
    .min(1, { error: 'Pick at least one hobby' })
    .max(MAX_HOBBIES)
    .refine((hobbies) => hasNoDuplicates(hobbies.map((hobby) => hobby.hobbyId)), {
      error: 'Each hobby can be picked only once',
    }),
});
export type UpdateMyHobbies = z.infer<typeof UpdateMyHobbiesSchema>;

/** Body of `POST /api/hobby-types/suggestions`. */
export const TypeSuggestionSchema = z.strictObject({
  hobbyId: SlugSchema,
  name: z.string().trim().min(TYPE_SUGGESTION_NAME_MIN_LENGTH).max(TYPE_SUGGESTION_NAME_MAX_LENGTH),
});
export type TypeSuggestion = z.infer<typeof TypeSuggestionSchema>;
