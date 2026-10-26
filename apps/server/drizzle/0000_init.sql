CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_name" text NOT NULL,
	"place" text NOT NULL,
	"date" text NOT NULL,
	"time" text NOT NULL,
	"starts_at" timestamp with time zone,
	"minimum" integer NOT NULL,
	"maximum" integer DEFAULT 0 NOT NULL,
	"repeat" text DEFAULT 'none' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"teams" jsonb,
	"next_created" boolean DEFAULT false NOT NULL,
	"repeat_of" text,
	"players_amount" integer DEFAULT 0 NOT NULL,
	"creator_id" text NOT NULL,
	"location" jsonb,
	"telegram" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_repeat_of_unique" UNIQUE("repeat_of"),
	CONSTRAINT "events_repeat_check" CHECK ("events"."repeat" IN ('none', 'weekly'))
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"date" text NOT NULL,
	"status" boolean NOT NULL,
	"friends" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sure_since" timestamp with time zone,
	"paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_event_user_unique" UNIQUE("event_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text NOT NULL,
	"password_hash" text,
	"password_salt" text,
	"role" text DEFAULT 'user' NOT NULL,
	"token_version" integer DEFAULT 0 NOT NULL,
	"telegram_id" bigint,
	"telegram_username" text,
	"telegram_link_token" text,
	"telegram_link_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('user', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_starts_at_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "events_weekly_due_idx" ON "events" USING btree ("starts_at") WHERE "events"."repeat" = 'weekly' AND NOT "events"."next_created";--> statement-breakpoint
CREATE INDEX "players_user_id_idx" ON "players" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email")) WHERE "users"."email" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_telegram_id_unique" ON "users" USING btree ("telegram_id") WHERE "users"."telegram_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "users_telegram_link_token_idx" ON "users" USING btree ("telegram_link_token") WHERE "users"."telegram_link_token" IS NOT NULL;