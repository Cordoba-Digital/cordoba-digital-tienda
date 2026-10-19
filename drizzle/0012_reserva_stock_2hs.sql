CREATE TABLE IF NOT EXISTS "order_stock_holds" (
	"order_id" integer PRIMARY KEY NOT NULL,
	"released_at" timestamp with time zone DEFAULT now() NOT NULL
);
