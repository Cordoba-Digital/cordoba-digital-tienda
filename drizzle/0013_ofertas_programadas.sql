CREATE TABLE "price_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_slug" text NOT NULL,
	"offer_price" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'programada' NOT NULL,
	"prev_price" integer,
	"prev_compare_at" integer,
	"applied_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "price_schedules_status_starts_idx" ON "price_schedules" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "price_schedules_status_ends_idx" ON "price_schedules" USING btree ("status","ends_at");--> statement-breakpoint
CREATE INDEX "price_schedules_product_idx" ON "price_schedules" USING btree ("product_slug");