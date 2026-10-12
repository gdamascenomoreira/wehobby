CREATE TABLE "hobbies" (
	"id" text PRIMARY KEY NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hobby_types" (
	"hobby_id" text NOT NULL,
	"id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "hobby_types_hobby_id_id_pk" PRIMARY KEY("hobby_id","id")
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
ALTER TABLE "user_hobbies" ADD CONSTRAINT "user_hobbies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hobbies" ADD CONSTRAINT "user_hobbies_hobby_id_hobbies_id_fk" FOREIGN KEY ("hobby_id") REFERENCES "public"."hobbies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hobby_types" ADD CONSTRAINT "user_hobby_types_user_hobby_fk" FOREIGN KEY ("user_id","hobby_id") REFERENCES "public"."user_hobbies"("user_id","hobby_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hobby_types" ADD CONSTRAINT "user_hobby_types_hobby_type_fk" FOREIGN KEY ("hobby_id","type_id") REFERENCES "public"."hobby_types"("hobby_id","id") ON DELETE no action ON UPDATE no action;