ALTER TABLE "staff" ADD COLUMN "totp_last_step" integer;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;