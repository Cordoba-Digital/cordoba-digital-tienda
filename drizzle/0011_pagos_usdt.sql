CREATE TABLE IF NOT EXISTS "usdt_payments" (
	"order_id" integer PRIMARY KEY NOT NULL,
	"txid" text NOT NULL,
	"transfer" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "usdt_payments_txid_idx" ON "usdt_payments" USING btree ("txid");