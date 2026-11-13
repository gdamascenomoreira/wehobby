import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { geographyPoint } from './geography.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Object id (`oid` claim) of the user in Entra External ID. */
    entraOid: text('entra_oid').notNull().unique('users_entra_oid_unique'),
    /** Always stored lowercase (see UsernameSchema). */
    username: text('username').notNull().unique('users_username_unique'),
    displayName: text('display_name').notNull(),
    bio: text('bio').notNull().default(''),
    language: text('language', { enum: ['pt', 'en'] }).notNull(),
    ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    /** Approximate point, always rounded to about 1 km (roundCoordinate) or a city centre. */
    location: geographyPoint('location'),
    locationLabel: text('location_label'),
    locationCountryCode: text('location_country_code'),
  },
  (table) => [
    check('users_language_check', sql`${table.language} in ('pt', 'en')`),
    check('users_username_format_check', sql`${table.username} ~ '^[a-z0-9_]{3,30}$'`),
    // The three location columns are set and cleared together.
    check(
      'users_location_complete_check',
      sql`(${table.location} is null) = (${table.locationLabel} is null) and (${table.location} is null) = (${table.locationCountryCode} is null)`,
    ),
    index('users_location_idx').using('gist', table.location),
  ],
);

export type UserRow = typeof users.$inferSelect;

/** The official hobbies. The id is a slug that doubles as the i18n key of the name. */
export const hobbies = pgTable('hobbies', {
  id: text('id').primaryKey(),
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Types inside a hobby, for example amigurumi in crochet. Ids are unique per hobby. */
export const hobbyTypes = pgTable(
  'hobby_types',
  {
    id: text('id').notNull(),
    hobbyId: text('hobby_id')
      .notNull()
      .references(() => hobbies.id),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [primaryKey({ columns: [table.hobbyId, table.id] })],
);

export const userHobbies = pgTable(
  'user_hobbies',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hobbyId: text('hobby_id')
      .notNull()
      .references(() => hobbies.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.hobbyId] })],
);

/**
 * The composite foreign keys make the database itself guarantee that a type
 * belongs to its hobby and that the user picked that hobby.
 */
export const userHobbyTypes = pgTable(
  'user_hobby_types',
  {
    userId: uuid('user_id').notNull(),
    hobbyId: text('hobby_id').notNull(),
    typeId: text('type_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.hobbyId, table.typeId] }),
    foreignKey({
      name: 'user_hobby_types_user_hobby_fk',
      columns: [table.userId, table.hobbyId],
      foreignColumns: [userHobbies.userId, userHobbies.hobbyId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'user_hobby_types_hobby_type_fk',
      columns: [table.hobbyId, table.typeId],
      foreignColumns: [hobbyTypes.hobbyId, hobbyTypes.id],
    }),
  ],
);

export const TYPE_SUGGESTION_STATUSES = ['pending', 'approved', 'rejected'] as const;

/** New hobby types suggested by users, reviewed by the platform. */
export const typeSuggestions = pgTable(
  'type_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    hobbyId: text('hobby_id')
      .notNull()
      .references(() => hobbies.id),
    name: text('name').notNull(),
    status: text('status', { enum: TYPE_SUGGESTION_STATUSES }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'type_suggestions_status_check',
      sql`${table.status} in ('pending', 'approved', 'rejected')`,
    ),
    // One pending suggestion per user, hobby and name, ignoring case.
    uniqueIndex('type_suggestions_pending_unique')
      .on(table.userId, table.hobbyId, sql`lower(${table.name})`)
      .where(sql`${table.status} = 'pending'`),
  ],
);

/**
 * Cities and municipalities returned by the geocoder, cached so the same
 * place is never looked up twice. One row per label and language.
 */
export const places = pgTable(
  'places',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: text('label').notNull(),
    countryCode: text('country_code').notNull(),
    centre: geographyPoint('centre').notNull(),
    language: text('language', { enum: ['pt', 'en'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('places_language_check', sql`${table.language} in ('pt', 'en')`),
    check('places_country_code_check', sql`${table.countryCode} ~ '^[A-Z]{2}$'`),
    uniqueIndex('places_label_country_language_unique').on(
      table.label,
      table.countryCode,
      table.language,
    ),
    index('places_centre_idx').using('gist', table.centre),
  ],
);

export type PlaceRow = typeof places.$inferSelect;

/**
 * Search cache: what the geocoder returned for a normalized query in one
 * language, as ordered place ids. Entries older than PLACE_SEARCH_TTL are
 * looked up again.
 */
export const placeSearches = pgTable(
  'place_searches',
  {
    query: text('query').notNull(),
    language: text('language', { enum: ['pt', 'en'] }).notNull(),
    placeIds: uuid('place_ids').array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.query, table.language] }),
    check('place_searches_language_check', sql`${table.language} in ('pt', 'en')`),
  ],
);

export const UPLOAD_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;

/**
 * One photo sent by a user. The original goes to `incoming/<id>` in the photos
 * container; the worker writes the cleaned versions to `processed/<id>/`.
 * Width and height are those of the full size version, set when ready.
 */
export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status', { enum: UPLOAD_STATUSES }).notNull().default('pending'),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    width: integer('width'),
    height: integer('height'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'uploads_status_check',
      sql`${table.status} in ('pending', 'processing', 'ready', 'failed')`,
    ),
    check('uploads_size_check', sql`${table.sizeBytes} > 0`),
    check(
      'uploads_ready_check',
      sql`(${table.status} = 'ready') = (${table.width} is not null and ${table.height} is not null and ${table.readyAt} is not null)`,
    ),
    index('uploads_user_id_idx').on(table.userId),
  ],
);

export type UploadRow = typeof uploads.$inferSelect;

export const JOB_STATUSES = ['queued', 'running', 'done', 'failed'] as const;

/**
 * Background work for the worker container, used as a queue: workers claim
 * the oldest due job with `FOR UPDATE SKIP LOCKED`, so two workers never run
 * the same job. Failed attempts are retried later through `run_after`.
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    kind: text('kind').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status', { enum: JOB_STATUSES }).notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('jobs_status_check', sql`${table.status} in ('queued', 'running', 'done', 'failed')`),
    index('jobs_due_idx')
      .on(table.runAfter)
      .where(sql`${table.status} = 'queued'`),
  ],
);

export type JobRow = typeof jobs.$inferSelect;
