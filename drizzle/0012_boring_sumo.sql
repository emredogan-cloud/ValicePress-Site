CREATE TYPE "public"."reader_access_outcome" AS ENUM('reader_opened', 'denied_unauthenticated', 'denied_not_owned', 'denied_not_ready', 'denied_malformed', 'asset_unavailable');--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"page" integer NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reader_access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outcome" "reader_access_outcome" NOT NULL,
	"user_id" uuid,
	"book_ref" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entitlements" ADD COLUMN "last_read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_access_events" ADD CONSTRAINT "reader_access_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bookmarks_user_book_page_uk" ON "bookmarks" USING btree ("user_id","book_id","page");--> statement-breakpoint
CREATE INDEX "bookmarks_user_book_idx" ON "bookmarks" USING btree ("user_id","book_id");--> statement-breakpoint
CREATE INDEX "reader_access_events_outcome_created_idx" ON "reader_access_events" USING btree ("outcome","created_at");--> statement-breakpoint
CREATE INDEX "reader_access_events_user_created_idx" ON "reader_access_events" USING btree ("user_id","created_at");