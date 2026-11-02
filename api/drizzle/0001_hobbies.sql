CREATE TABLE "hobbies" (
	"id" text PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hobby_types" (
	"id" text NOT NULL,
	"hobby_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "hobby_types_hobby_id_id_pk" PRIMARY KEY("hobby_id","id")
);
--> statement-breakpoint
CREATE TABLE "type_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hobby_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "type_suggestions_status_check" CHECK ("type_suggestions"."status" in ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "user_hobbies" (
	"user_id" uuid NOT NULL,
	"hobby_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_hobbies_user_id_hobby_id_pk" PRIMARY KEY("user_id","hobby_id")
);
--> statement-breakpoint
CREATE TABLE "user_hobby_types" (
	"user_id" uuid NOT NULL,
	"hobby_id" text NOT NULL,
	"type_id" text NOT NULL,
	CONSTRAINT "user_hobby_types_user_id_hobby_id_type_id_pk" PRIMARY KEY("user_id","hobby_id","type_id")
);
--> statement-breakpoint
ALTER TABLE "hobby_types" ADD CONSTRAINT "hobby_types_hobby_id_hobbies_id_fk" FOREIGN KEY ("hobby_id") REFERENCES "public"."hobbies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_suggestions" ADD CONSTRAINT "type_suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "type_suggestions" ADD CONSTRAINT "type_suggestions_hobby_id_hobbies_id_fk" FOREIGN KEY ("hobby_id") REFERENCES "public"."hobbies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hobbies" ADD CONSTRAINT "user_hobbies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hobbies" ADD CONSTRAINT "user_hobbies_hobby_id_hobbies_id_fk" FOREIGN KEY ("hobby_id") REFERENCES "public"."hobbies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hobby_types" ADD CONSTRAINT "user_hobby_types_user_hobby_fk" FOREIGN KEY ("user_id","hobby_id") REFERENCES "public"."user_hobbies"("user_id","hobby_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hobby_types" ADD CONSTRAINT "user_hobby_types_hobby_type_fk" FOREIGN KEY ("hobby_id","type_id") REFERENCES "public"."hobby_types"("hobby_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "type_suggestions_pending_unique" ON "type_suggestions" USING btree ("user_id","hobby_id",lower("name")) WHERE "type_suggestions"."status" = 'pending';--> statement-breakpoint
-- Seed: the official hobbies and their starter types. ON CONFLICT keeps it idempotent.
INSERT INTO "hobbies" ("id", "sort_order") VALUES
	('crochet', 1),
	('plants', 2),
	('photography', 3)
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "hobby_types" ("hobby_id", "id", "sort_order") VALUES
	('crochet', 'amigurumi', 1),
	('crochet', 'granny_squares', 2),
	('crochet', 'tapestry', 3),
	('crochet', 'garments', 4),
	('crochet', 'accessories', 5),
	('crochet', 'home_decor', 6),
	('crochet', 'blankets', 7),
	('plants', 'houseplants', 1),
	('plants', 'succulents_cacti', 2),
	('plants', 'orchids', 3),
	('plants', 'vegetable_garden', 4),
	('plants', 'herbs', 5),
	('plants', 'bonsai', 6),
	('plants', 'propagation', 7),
	('photography', 'landscape', 1),
	('photography', 'portrait', 2),
	('photography', 'street', 3),
	('photography', 'macro', 4),
	('photography', 'nature_wildlife', 5),
	('photography', 'film', 6),
	('photography', 'mobile', 7)
ON CONFLICT ("hobby_id", "id") DO NOTHING;
