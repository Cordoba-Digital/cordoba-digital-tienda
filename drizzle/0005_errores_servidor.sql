CREATE TABLE IF NOT EXISTS "error_events" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"message" text NOT NULL,
	"stack" text DEFAULT '' NOT NULL,
	"route" text DEFAULT '' NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"method" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
