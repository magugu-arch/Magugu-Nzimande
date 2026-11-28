CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" uuid,
	"staff_name" text,
	"action" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"sku" text NOT NULL,
	"label" text NOT NULL,
	"slot_date" date,
	"slot_time" varchar(5),
	"resource" text,
	"units" integer DEFAULT 0 NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_zar" integer NOT NULL,
	"total_zar" integer NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" varchar(12) NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"visit_date" date,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"notify_whatsapp" boolean DEFAULT true NOT NULL,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"clip_consent" boolean DEFAULT false NOT NULL,
	"package_id" text,
	"subtotal_zar" integer NOT NULL,
	"discount_zar" integer DEFAULT 0 NOT NULL,
	"voucher_applied_zar" integer DEFAULT 0 NOT NULL,
	"total_zar" integer NOT NULL,
	"voucher_code" text,
	"source" text,
	"partner_code" text,
	"payment_provider" text,
	"payment_ref" text,
	"paid_at" timestamp with time zone,
	"hold_expires_at" timestamp with time zone,
	"ticket_token" text NOT NULL,
	"checked_in_at" timestamp with time zone,
	"checked_in_by" text,
	"waiver" jsonb,
	"notes" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"follow_up_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clips" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_ref" text NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"participant" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"name" text,
	"contact" text,
	"page" text,
	"status" text DEFAULT 'open' NOT NULL,
	"unread_for_staff" integer DEFAULT 0 NOT NULL,
	"unread_for_visitor" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"company" text,
	"group_size" integer,
	"preferred_date" date,
	"message" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"tag" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"image" text NOT NULL,
	"price_zar" integer,
	"capacity" integer NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"staff_name" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"template" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"booking_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"booking_id" uuid NOT NULL,
	"name" text NOT NULL,
	"weight_kg" integer,
	"age_band" text NOT NULL,
	"activities" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"booking_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"source" text,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "table_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"date" date NOT NULL,
	"time" varchar(5) NOT NULL,
	"party_size" integer NOT NULL,
	"notes" text,
	"booking_ref" text,
	"status" text DEFAULT 'requested' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"code" varchar(16) PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"sku" text,
	"label" text NOT NULL,
	"value_zar" integer NOT NULL,
	"balance_zar" integer NOT NULL,
	"purchaser_name" text NOT NULL,
	"purchaser_email" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_email" text,
	"recipient_phone" text,
	"message" text,
	"deliver_on" date,
	"delivered_at" timestamp with time zone,
	"status" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"purchase_booking_id" uuid,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "walk_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"activity_id" text NOT NULL,
	"qty" integer NOT NULL,
	"amount_zar" integer NOT NULL,
	"staff_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_items" ADD CONSTRAINT "booking_items_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "items_slot_idx" ON "booking_items" USING btree ("resource","slot_date","slot_time");--> statement-breakpoint
CREATE INDEX "items_booking_idx" ON "booking_items" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_ref_uq" ON "bookings" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "bookings_visit_idx" ON "bookings" USING btree ("visit_date");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_email_idx" ON "bookings" USING btree ("email");--> statement-breakpoint
CREATE INDEX "clips_ref_idx" ON "clips" USING btree ("booking_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_token_uq" ON "conversations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "conversations_last_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uq" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_start_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "messages_conv_idx" ON "messages" USING btree ("conversation_id","id");--> statement-breakpoint
CREATE INDEX "notifications_created_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "push_endpoint_uq" ON "push_subscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_email_uq" ON "staff" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vouchers_status_idx" ON "vouchers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "walkins_date_idx" ON "walk_ins" USING btree ("date");