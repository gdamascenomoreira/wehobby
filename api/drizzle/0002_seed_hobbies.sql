-- The launch hobbies and their types (see docs/PRD.md). Names are i18n keys in the web app.
INSERT INTO "hobbies" ("id", "sort_order") VALUES
	('crochet', 1),
	('plants', 2),
	('photography', 3);
--> statement-breakpoint
INSERT INTO "hobby_types" ("hobby_id", "id", "sort_order") VALUES
	('crochet', 'amigurumi', 1),
	('crochet', 'tapestry', 2),
	('crochet', 'granny_squares', 3),
	('crochet', 'garments', 4),
	('crochet', 'accessories', 5),
	('plants', 'succulents', 1),
	('plants', 'houseplants', 2),
	('plants', 'vegetable_garden', 3),
	('plants', 'orchids', 4),
	('plants', 'bonsai', 5),
	('photography', 'landscape', 1),
	('photography', 'portrait', 2),
	('photography', 'street', 3),
	('photography', 'macro', 4),
	('photography', 'film', 5);
