ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "max_uses" integer;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "used_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;