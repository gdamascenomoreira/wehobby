import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

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
  },
  (table) => [
    check('users_language_check', sql`${table.language} in ('pt', 'en')`),
    check('users_username_format_check', sql`${table.username} ~ '^[a-z0-9_]{3,30}$'`),
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
