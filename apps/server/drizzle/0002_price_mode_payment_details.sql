ALTER TABLE "events" ADD COLUMN "price_mode" text DEFAULT 'person' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_details" text;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_price_mode_check" CHECK ("events"."price_mode" IN ('person', 'pitch'));