CREATE TABLE IF NOT EXISTS "photo_suggestion_decisions" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"image" text NOT NULL,
	"decision" text NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL
);
