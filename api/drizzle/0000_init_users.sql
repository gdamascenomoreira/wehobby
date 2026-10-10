CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entra_oid" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"language" text NOT NULL,
	"age_confirmed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_entra_oid_unique" UNIQUE("entra_oid"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_language_check" CHECK ("users"."language" in ('pt', 'en')),
	CONSTRAINT "users_username_format_check" CHECK ("users"."username" ~ '^[a-z0-9_]{3,30}$')
);
