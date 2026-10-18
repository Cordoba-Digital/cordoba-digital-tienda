CREATE TABLE IF NOT EXISTS "product_photo_checks" (
	"product_id" integer PRIMARY KEY NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"width" integer,
	"height" integer,
	"flagged" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
