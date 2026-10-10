import { sql } from 'drizzle-orm';
import { check, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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
