import { z } from 'zod';

export const LANGUAGES = ['pt', 'en'] as const;
export const LanguageSchema = z.enum(LANGUAGES);
export type Language = z.infer<typeof LanguageSchema>;

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const BIO_MAX_LENGTH = 160;

/** Names that would be confusing in profile links or look official. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'api',
  'help',
  'moderator',
  'onboarding',
  'root',
  'settings',
  'support',
  'system',
  'wehobby',
]);

/** Lowercase letters, digits and underscores. Stored lowercase, so unique regardless of case. */
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(/^[a-z0-9_]+$/, { error: 'Use only letters, digits and underscores' })
  .refine((username) => !RESERVED_USERNAMES.has(username), { error: 'This username is reserved' });

export const DisplayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH);

export const BioSchema = z.string().trim().max(BIO_MAX_LENGTH);

/** Body of `POST /api/me`, sent once at onboarding. */
export const CreateProfileSchema = z.strictObject({
  username: UsernameSchema,
  displayName: DisplayNameSchema,
  bio: BioSchema.optional(),
  language: LanguageSchema,
  /** The user confirms they are 16 or older (minimum age for the EU launch). */
  ageConfirmed: z.literal(true),
});
export type CreateProfile = z.infer<typeof CreateProfileSchema>;

/** Body of `PATCH /api/me`. The username is fixed after onboarding so profile links stay stable. */
export const UpdateProfileSchema = z
  .strictObject({
    displayName: DisplayNameSchema,
    bio: BioSchema,
    language: LanguageSchema,
  })
  .partial()
  .refine((update) => Object.keys(update).length > 0, { error: 'Nothing to update' });
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

/** The signed in user's own profile, returned by `/api/me`. */
export const ProfileSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string(),
  language: LanguageSchema,
  createdAt: z.iso.datetime(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/** Response body of `GET /api/usernames/:username`. */
export const UsernameAvailabilitySchema = z.object({
  username: z.string(),
  available: z.boolean(),
});
export type UsernameAvailability = z.infer<typeof UsernameAvailabilitySchema>;
