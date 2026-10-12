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

/** Platform owned hobbies. Rows are seeded by migrations; `id` is a stable slug. */
export const hobbies = pgTable('hobbies', {
  id: text('id').primaryKey(),
  /** Inactive hobbies are hidden from the catalog and cannot be picked. */
  active: boolean('active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** Platform owned types inside a hobby (for example amigurumi in crochet). */
export const hobbyTypes = pgTable(
  'hobby_types',
  {
    hobbyId: text('hobby_id')
      .notNull()
      .references(() => hobbies.id),
    id: text('id').notNull(),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
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
 * Types a user picked. The foreign keys make sure a type belongs to the hobby
 * and that the user picked that hobby.
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
