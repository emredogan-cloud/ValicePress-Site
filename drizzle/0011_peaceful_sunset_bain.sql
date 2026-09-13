CREATE TYPE "public"."payment_provider" AS ENUM('paddle', 'lemonsqueezy');--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "provider_price_id" text;--> statement-breakpoint
ALTER TABLE "commerce_events" ADD COLUMN "provider" "payment_provider" DEFAULT 'paddle' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_provider" "payment_provider" DEFAULT 'paddle' NOT NULL;