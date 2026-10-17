ALTER TABLE "orders" ADD COLUMN "checkout_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_checkout_key_idx" ON "orders" USING btree ("checkout_key");