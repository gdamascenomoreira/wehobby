-- PostGIS is in the postgis/postgis image but must be enabled once per database.
CREATE EXTENSION IF NOT EXISTS postgis;--> statement-breakpoint
CREATE TABLE "place_searches" (
	"query" text NOT NULL,
	"language" text NOT NULL,
	"place_ids" uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "place_searches_query_language_pk" PRIMARY KEY("query","language"),
	CONSTRAINT "place_searches_language_check" CHECK ("place_searches"."language" in ('pt', 'en'))
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"country_code" text NOT NULL,
	"centre" geography(Point, 4326) NOT NULL,
	"language" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_language_check" CHECK ("places"."language" in ('pt', 'en')),
	CONSTRAINT "places_country_code_check" CHECK ("places"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location" geography(Point, 4326);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_label" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "location_country_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "places_label_country_language_unique" ON "places" USING btree ("label","country_code","language");--> statement-breakpoint
CREATE INDEX "places_centre_idx" ON "places" USING gist ("centre");--> statement-breakpoint
CREATE INDEX "users_location_idx" ON "users" USING gist ("location");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_location_complete_check" CHECK (("users"."location" is null) = ("users"."location_label" is null) and ("users"."location" is null) = ("users"."location_country_code" is null));