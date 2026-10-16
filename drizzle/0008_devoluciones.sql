CREATE TABLE IF NOT EXISTS "order_returns" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"items" jsonb NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_returns_order_idx" ON "order_returns" USING btree ("order_id");