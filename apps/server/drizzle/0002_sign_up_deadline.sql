ALTER TABLE "events" ADD COLUMN "deadline_hours" integer DEFAULT 12 NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "auto_cancel" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_deadline_hours_check" CHECK ("events"."deadline_hours" IN (0, 6, 12, 24));