CREATE TYPE "public"."marketing_consent" AS ENUM('opted_in', 'opted_out', 'unknown', 'not_marketing_contact');--> statement-breakpoint
CREATE TYPE "public"."popup_outcome" AS ENUM('shown', 'dismissed', 'submitted');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(254) NOT NULL,
	"email_raw" varchar(254),
	"name" text,
	"source" varchar(40) NOT NULL,
	"source_detail" text,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"purchased" boolean DEFAULT false NOT NULL,
	"purchase_count" integer DEFAULT 0 NOT NULL,
	"customer_status" varchar(32) DEFAULT 'prospect' NOT NULL,
	"marketing_consent" "marketing_consent" DEFAULT 'unknown' NOT NULL,
	"consent_source" text,
	"consent_at" timestamp with time zone,
	"unsubscribed" boolean DEFAULT false NOT NULL,
	"unsubscribed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "popup_impressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"popup" varchar(40) DEFAULT 'newsletter' NOT NULL,
	"visitor_id" varchar(64) NOT NULL,
	"user_id" uuid,
	"contact_id" uuid,
	"outcome" "popup_outcome" DEFAULT 'shown' NOT NULL,
	"source_path" text,
	"shown_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "popup_impressions" ADD CONSTRAINT "popup_impressions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "popup_impressions" ADD CONSTRAINT "popup_impressions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_email_uk" ON "contacts" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contacts_consent_idx" ON "contacts" USING btree ("marketing_consent");--> statement-breakpoint
CREATE INDEX "contacts_source_idx" ON "contacts" USING btree ("source");--> statement-breakpoint
CREATE INDEX "contacts_customer_idx" ON "contacts" USING btree ("purchased");--> statement-breakpoint
CREATE UNIQUE INDEX "popup_impressions_visitor_uk" ON "popup_impressions" USING btree ("popup","visitor_id");--> statement-breakpoint
CREATE INDEX "popup_impressions_user_idx" ON "popup_impressions" USING btree ("popup","user_id");