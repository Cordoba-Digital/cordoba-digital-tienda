CREATE TABLE IF NOT EXISTS "order_refunds" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"method" text NOT NULL,
	"estado" text DEFAULT 'hecho' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"external_id" text,
	"error" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_refunds_order_idx" ON "order_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "order_refunds_external_idx" ON "order_refunds" USING btree ("external_id");