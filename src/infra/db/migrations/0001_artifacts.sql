CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"target" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artifacts_kind_valid" CHECK ("artifacts"."kind" in ('doc','image','repo','link','commit')),
	CONSTRAINT "artifacts_label_not_empty" CHECK (char_length("artifacts"."label") >= 1),
	CONSTRAINT "artifacts_target_not_empty" CHECK (char_length("artifacts"."target") >= 1)
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifacts_by_session" ON "artifacts" USING btree ("session_id","created_at");